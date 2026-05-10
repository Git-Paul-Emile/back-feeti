import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { authRepository } from "../repositories/auth.repository.js";
import { generateToken, generateRefreshToken, generatePasswordResetToken, verifyPasswordResetToken } from "../config/jwt.js";
import { fbAuth, db, FieldValue } from "../config/firebase-admin.js";
import { addEmailJob } from "../queues/email.queue.js";
import type { RegisterInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from "../validators/auth.validator.js";
import type { Role } from "../generated/prisma/client.js";

function omitPassword<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

/** Normalise un numéro de téléphone au format E.164 si possible. */
function formatPhone(phone: string): string | undefined {
  const cleaned = phone.replace(/\s+/g, "").replace(/^00/, "+");
  return cleaned.startsWith("+") ? cleaned : undefined;
}

export const authService = {
  async register(data: RegisterInput) {
    const existing = await authRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError("Un compte avec cet email existe déjà", StatusCodes.CONFLICT);
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT || "10");
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    const user = await authRepository.createUser({
      name: data.name,
      email: data.email,
      phone: data.phone || undefined,
      passwordHash,
      role: (data.role || "user") as Role,
      interests: data.interests ? JSON.stringify(data.interests) : "[]",
    });

    // Créer un compte Firebase Auth pour uniformiser
    let firebaseUid: string | undefined;
    try {
      const firebaseUser = await fbAuth.createUser({
        email: data.email,
        displayName: data.name,
        phoneNumber: data.phone ? formatPhone(data.phone) : undefined,
        password: data.password, // Utiliser le même mot de passe
      });
      firebaseUid = firebaseUser.uid;

      // Mettre à jour l'utilisateur avec firebaseUid
      await authRepository.updateUser(user.id, { firebaseUid });
      user.firebaseUid = firebaseUid;

      // Définir les custom claims
      await fbAuth.setCustomUserClaims(firebaseUid, { role: user.role });
    } catch (err) {
      console.error("Erreur lors de la création du compte Firebase :", err);
      // Continuer sans Firebase si échec, mais loguer
    }

    try {
      await db.collection("users").doc(firebaseUid || user.id).set({
        uid: firebaseUid || null,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        interests: data.interests || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Erreur lors de l'insertion dans Firestore :", err);
    }

    const accessToken = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    if (user.role === "organizer") {
      addEmailJob({ type: "welcome-organizer", to: user.email, organizerName: user.name }).catch(() => {});
    } else {
      addEmailJob({ type: "welcome-user", to: user.email, userName: user.name }).catch(() => {});
    }

    return { user: omitPassword(user), accessToken, refreshToken };
  },

  async login(data: LoginInput) {
    const user = await authRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError("Email ou mot de passe incorrect", StatusCodes.UNAUTHORIZED);
    }

    const passwordMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatch) {
      throw new AppError("Email ou mot de passe incorrect", StatusCodes.UNAUTHORIZED);
    }

    const accessToken = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return { user: omitPassword(user), accessToken, refreshToken };
  },

  async getMe(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("Utilisateur non trouvé", StatusCodes.NOT_FOUND);
    return omitPassword(user);
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    // Si l'email change, vérifier qu'il n'est pas déjà pris
    if (data.email) {
      const existing = await authRepository.findByEmail(data.email);
      if (existing && existing.id !== userId) {
        throw new AppError("Cet email est déjà utilisé par un autre compte", StatusCodes.CONFLICT);
      }
    }
    const updated = await authRepository.updateUser(userId, {
      ...(data.name      !== undefined && { name: data.name }),
      ...(data.email     !== undefined && { email: data.email }),
      ...(data.phone     !== undefined && { phone: data.phone || null }),
      ...(data.interests !== undefined && { interests: JSON.stringify(data.interests) }),
    });

    // Mettre à jour Firestore
    try {
      const docId = updated.firebaseUid || updated.id;
      await db.collection("users").doc(docId).update({
        ...(data.name      !== undefined && { name: data.name }),
        ...(data.email     !== undefined && { email: data.email }),
        ...(data.phone     !== undefined && { phone: data.phone || null }),
        ...(data.interests !== undefined && { interests: data.interests }),
        updatedAt: FieldValue.serverTimestamp()
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour dans Firestore :", err);
    }

    return omitPassword(updated);
  },

  async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("Utilisateur non trouvé", StatusCodes.NOT_FOUND);

    const match = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!match) {
      throw new AppError("Mot de passe actuel incorrect", StatusCodes.UNAUTHORIZED, {
        currentPassword: "Mot de passe actuel incorrect",
      });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT || "10");
    const passwordHash = await bcrypt.hash(data.newPassword, saltRounds);
    await authRepository.updateUser(userId, { passwordHash });

    addEmailJob({ type: "password-changed", to: user.email, userName: user.name }).catch(() => {});
  },

  async deleteAccount(userId: string, password: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("Utilisateur non trouvé", StatusCodes.NOT_FOUND);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new AppError("Mot de passe incorrect", StatusCodes.UNAUTHORIZED, {
        password: "Mot de passe incorrect",
      });
    }

    // Supprimer de Firestore
    try {
      const docId = user.firebaseUid || user.id;
      await db.collection("users").doc(docId).delete();
    } catch (err) {
      console.error("Erreur lors de la suppression dans Firestore :", err);
    }

    await authRepository.deleteUser(userId);
  },

  // ── Firebase Auth ─────────────────────────────────────────────────────────
  async registerWithFirebase(idToken: string, profileData: Partial<RegisterInput>) {
    // Vérifier le token Firebase
    const decodedToken = await fbAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email;
    const firebaseName = decodedToken.name || profileData.name || "Utilisateur";
    const firebasePhoto = decodedToken.picture;

    if (!firebaseEmail) {
      throw new AppError("Email non trouvé dans le token Firebase", StatusCodes.BAD_REQUEST);
    }

    // Chercher ou créer l'utilisateur en base. On privilégie la liaison par Firebase UID,
    // puis on retombe sur l'adresse e-mail pour gérer les comptes créés précédemment.
    let user = await authRepository.findByFirebaseUid(firebaseUid);
    if (!user) {
      user = await authRepository.findByEmail(firebaseEmail);
    }

    if (!user) {
      // Créer un nouvel utilisateur
      user = await authRepository.createUser({
        name: firebaseName,
        email: firebaseEmail,
        phone: profileData.phone || undefined,
        passwordHash: "", // Pas de mot de passe pour utilisateurs Firebase
        role: (profileData.role || "user") as Role,
        interests: profileData.interests ? JSON.stringify(profileData.interests) : "[]",
        firebaseUid,
        photoUrl: firebasePhoto || null,
      });

      if (user.role === "organizer") {
        addEmailJob({ type: "welcome-organizer", to: user.email, organizerName: user.name }).catch(() => {});
      } else {
        addEmailJob({ type: "welcome-user", to: user.email, userName: user.name }).catch(() => {});
      }
    } else {
      const updates: {
        firebaseUid?: string;
        role?: Role;
        interests?: string;
        name?: string;
        phone?: string | null;
      } = {};

      if (!user.firebaseUid) {
        updates.firebaseUid = firebaseUid;
      }

      if (profileData.role && profileData.role !== user.role) {
        // Autoriser le changement de rôle lors de l'inscription Google, même si c'est une descente
        updates.role = profileData.role as Role;
      }

      if (profileData.interests && profileData.interests.length > 0) {
        updates.interests = JSON.stringify(profileData.interests);
      }

      if (!user.name && firebaseName) {
        updates.name = firebaseName;
      }

      if (!user.phone && profileData.phone) {
        updates.phone = profileData.phone;
      }

      if (Object.keys(updates).length > 0) {
        user = await authRepository.updateUser(user.id, updates);
      }
    }

    try {
      await db.collection("users").doc(firebaseUid).set({
        uid: firebaseUid,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        interests: profileData.interests || [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Erreur lors de l'insertion dans Firestore :", err);
    }

    const accessToken = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return { user: omitPassword(user), accessToken, refreshToken };
  },

  async loginWithFirebase(idToken: string) {
    // Vérifier le token Firebase
    const decodedToken = await fbAuth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email;

    if (!firebaseEmail) {
      throw new AppError("Email non trouvé dans le token Firebase", StatusCodes.BAD_REQUEST);
    }

    // Chercher l'utilisateur par Firebase UID en priorité, puis par e-mail.
    let user = await authRepository.findByFirebaseUid(firebaseUid);
    if (!user) {
      user = await authRepository.findByEmail(firebaseEmail);
    }

    if (!user) {
      // Créer un compte automatiquement pour les nouveaux utilisateurs Google
      user = await authRepository.createUser({
        name: decodedToken.name || "Utilisateur",
        email: firebaseEmail,
        passwordHash: "",
        role: "user" as Role,
        interests: "[]",
        firebaseUid,
        photoUrl: decodedToken.picture || null,
      });
      
      try {
        await db.collection("users").doc(user.id).set({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          interests: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Erreur lors de l'insertion dans Firestore :", err);
      }

      addEmailJob({ type: "welcome-user", to: user.email, userName: user.name }).catch(() => {});
    } else {
      // Mettre à jour le firebaseUid si pas encore lié
      if (!user.firebaseUid) {
        await authRepository.updateUser(user.id, { firebaseUid });
        user.firebaseUid = firebaseUid;
      }
    }

    const accessToken = generateToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return { user: omitPassword(user), accessToken, refreshToken };
  },

  async verifyFirebaseToken(idToken: string) {
    try {
      const decodedToken = await fbAuth.verifyIdToken(idToken);
      return { valid: true, decoded: decodedToken };
    } catch (error) {
      return { valid: false, decoded: null };
    }
  },

  async forgotPassword(email: string) {
    const user = await authRepository.findByEmail(email);
    // Réponse identique que l'email existe ou non (sécurité anti-énumération)
    if (!user) return;

    const resetToken = generatePasswordResetToken(user.id);
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;

    await addEmailJob({ type: "password-reset", to: user.email, userName: user.name, resetUrl });
  },

  async resetPassword(token: string, newPassword: string) {
    let payload: { userId: string };
    try {
      payload = verifyPasswordResetToken(token);
    } catch {
      throw new AppError("Lien de réinitialisation invalide ou expiré", StatusCodes.BAD_REQUEST);
    }

    const user = await authRepository.findById(payload.userId);
    if (!user) throw new AppError("Utilisateur introuvable", StatusCodes.NOT_FOUND);

    const saltRounds = parseInt(process.env.BCRYPT_SALT || "10");
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await authRepository.updateUser(user.id, { passwordHash });

    addEmailJob({ type: "password-changed", to: user.email, userName: user.name }).catch(() => {});
  },
};
