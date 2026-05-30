/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS — AuthService
 *  Couverture: inscription (doublon email, hashage password),
 *              connexion (email inconnu, mauvais mot de passe, succès),
 *              getMe, updateProfile (email pris), changePassword
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";

// ─── Mocks hoistés ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  generateToken: vi.fn().mockReturnValue("fake-access-token"),
  generateRefreshToken: vi.fn().mockReturnValue("fake-refresh-token"),
  generatePasswordResetToken: vi.fn().mockReturnValue("fake-reset-token"),
  verifyPasswordResetToken: vi.fn(),
  fbAuthCreateUser: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  fbAuthSetCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  dbCollectionSet: vi.fn().mockResolvedValue(undefined),
  dbCollectionUpdate: vi.fn().mockResolvedValue(undefined),
  addEmailJob: vi.fn().mockResolvedValue(undefined),
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
}));

vi.mock("../repositories/auth.repository.js", () => ({
  authRepository: {
    findByEmail: mocks.findByEmail,
    findById: mocks.findById,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
  },
}));

vi.mock("../config/jwt.js", () => ({
  generateToken: mocks.generateToken,
  generateRefreshToken: mocks.generateRefreshToken,
  generatePasswordResetToken: mocks.generatePasswordResetToken,
  verifyPasswordResetToken: mocks.verifyPasswordResetToken,
}));

vi.mock("../config/firebase-admin.js", () => ({
  fbAuth: {
    createUser: mocks.fbAuthCreateUser,
    setCustomUserClaims: mocks.fbAuthSetCustomUserClaims,
  },
  db: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: mocks.dbCollectionSet,
        update: mocks.dbCollectionUpdate,
      }),
    }),
  },
  FieldValue: {
    serverTimestamp: vi.fn().mockReturnValue("server-ts"),
  },
}));

vi.mock("../queues/email.queue.js", () => ({
  addEmailJob: mocks.addEmailJob,
}));

vi.mock("../services/email.service.js", () => ({
  emailService: {
    sendWelcomeUser: vi.fn().mockResolvedValue(undefined),
    sendWelcomeOrganizer: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mocks.bcryptHash,
    compare: mocks.bcryptCompare,
  },
  hash: mocks.bcryptHash,
  compare: mocks.bcryptCompare,
}));

import { authService } from "../services/auth.service.js";

// ─── Données de référence ─────────────────────────────────────────────
const REGISTER_INPUT = {
  name: "Kongo Lokali",
  email: "kongo@feeti.cm",
  password: "S3cr3t!2024",
  role: "user" as const,
};

const FAKE_USER = {
  id: "user-uuid-1",
  name: "Kongo Lokali",
  email: "kongo@feeti.cm",
  passwordHash: "$2b$10$hashedpassword",
  role: "user" as const,
  firebaseUid: "firebase-uid-1",
  phone: null,
  country: null,
  city: null,
  interests: "[]",
  photoUrl: null,
  createdAt: new Date(),
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — register : inscription
// ═════════════════════════════════════════════════════════════════════

describe("register — inscription", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bcryptHash.mockResolvedValue("$2b$10$hashed-password");
    mocks.dbCollectionSet.mockResolvedValue(undefined);
    mocks.fbAuthCreateUser.mockResolvedValue({ uid: "firebase-uid-1" });
    mocks.fbAuthSetCustomUserClaims.mockResolvedValue(undefined);
    mocks.addEmailJob.mockResolvedValue(undefined);
  });

  it("lève CONFLICT (409) si l'email existe déjà", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);

    await expect(
      authService.register(REGISTER_INPUT)
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT });
  });

  it("le message d'erreur pour doublon email est explicite", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);

    try {
      await authService.register(REGISTER_INPUT);
    } catch (err: unknown) {
      expect((err as { message: string }).message).toContain("email");
    }
  });

  it("hache le mot de passe avec bcrypt avant de créer l'utilisateur", async () => {
    mocks.findByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ ...FAKE_USER, firebaseUid: undefined });
    mocks.updateUser.mockResolvedValue(FAKE_USER);

    await authService.register(REGISTER_INPUT);

    expect(mocks.bcryptHash).toHaveBeenCalledWith(
      REGISTER_INPUT.password,
      expect.any(Number)
    );
  });

  it("ne retourne jamais le passwordHash dans la réponse", async () => {
    mocks.findByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ ...FAKE_USER, firebaseUid: undefined });
    mocks.updateUser.mockResolvedValue(FAKE_USER);

    const result = await authService.register(REGISTER_INPUT);

    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("retourne un accessToken et un refreshToken", async () => {
    mocks.findByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ ...FAKE_USER, firebaseUid: undefined });
    mocks.updateUser.mockResolvedValue(FAKE_USER);

    const result = await authService.register(REGISTER_INPUT);

    expect(result.accessToken).toBe("fake-access-token");
    expect(result.refreshToken).toBe("fake-refresh-token");
  });

  it("appelle generateToken avec userId et role", async () => {
    mocks.findByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ ...FAKE_USER, firebaseUid: undefined });
    mocks.updateUser.mockResolvedValue(FAKE_USER);

    await authService.register(REGISTER_INPUT);

    expect(mocks.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: FAKE_USER.id, role: FAKE_USER.role })
    );
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — login : connexion
// ═════════════════════════════════════════════════════════════════════

describe("login — connexion", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève UNAUTHORIZED (401) si l'email est inconnu", async () => {
    mocks.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: "inconnu@feeti.cm", password: "pass" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNAUTHORIZED });
  });

  it("le message d'erreur ne distingue pas email inconnu et mauvais mot de passe", async () => {
    mocks.findByEmail.mockResolvedValue(null);

    try {
      await authService.login({ email: "inconnu@feeti.cm", password: "pass" });
    } catch (err: unknown) {
      const msg = (err as { message: string }).message;
      // Sécurité : ne pas révéler si l'email existe
      expect(msg).toMatch(/email|mot de passe/i);
    }
  });

  it("lève UNAUTHORIZED (401) si le mot de passe est incorrect", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(false); // mauvais mot de passe

    await expect(
      authService.login({ email: FAKE_USER.email, password: "mauvais-mdp" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNAUTHORIZED });
  });

  it("retourne user (sans passwordHash), accessToken, refreshToken si succès", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(true);

    const result = await authService.login({ email: FAKE_USER.email, password: "S3cr3t!2024" });

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.accessToken).toBe("fake-access-token");
    expect(result.refreshToken).toBe("fake-refresh-token");
  });

  it("compare le mot de passe avec bcrypt.compare", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(true);

    await authService.login({ email: FAKE_USER.email, password: "S3cr3t!2024" });

    expect(mocks.bcryptCompare).toHaveBeenCalledWith("S3cr3t!2024", FAKE_USER.passwordHash);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — getMe
// ═════════════════════════════════════════════════════════════════════

describe("getMe", () => {

  beforeEach(() => vi.clearAllMocks());

  it("lève NOT_FOUND (404) si l'utilisateur est introuvable", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      authService.getMe("user-unknown")
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("retourne l'utilisateur sans passwordHash", async () => {
    mocks.findById.mockResolvedValue(FAKE_USER);

    const result = await authService.getMe("user-uuid-1");

    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe(FAKE_USER.email);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 4 — updateProfile
// ═════════════════════════════════════════════════════════════════════

describe("updateProfile", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbCollectionUpdate.mockResolvedValue(undefined);
  });

  it("lève CONFLICT (409) si le nouvel email appartient à un autre compte", async () => {
    const otherUser = { ...FAKE_USER, id: "user-other", email: "pris@feeti.cm" };
    mocks.findByEmail.mockResolvedValue(otherUser);

    await expect(
      authService.updateProfile("user-uuid-1", { email: "pris@feeti.cm" })
    ).rejects.toMatchObject({ statusCode: StatusCodes.CONFLICT });
  });

  it("autorise la mise à jour si le nouvel email appartient au même utilisateur", async () => {
    // findByEmail retourne le même utilisateur (pas de conflit)
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.updateUser.mockResolvedValue({ ...FAKE_USER, name: "Nouveau Nom" });

    await expect(
      authService.updateProfile("user-uuid-1", { email: "kongo@feeti.cm", name: "Nouveau Nom" })
    ).resolves.toBeDefined();
  });

  it("retourne l'utilisateur mis à jour sans passwordHash", async () => {
    mocks.findByEmail.mockResolvedValue(null); // email libre
    mocks.updateUser.mockResolvedValue({ ...FAKE_USER, name: "Updated Name" });

    const result = await authService.updateProfile("user-uuid-1", { name: "Updated Name" });

    expect(result).not.toHaveProperty("passwordHash");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 5 — changePassword
// ═════════════════════════════════════════════════════════════════════

describe("changePassword", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bcryptHash.mockResolvedValue("$2b$10$new-hashed");
    mocks.updateUser.mockResolvedValue(FAKE_USER);
  });

  it("lève NOT_FOUND (404) si l'utilisateur est introuvable", async () => {
    mocks.findById.mockResolvedValue(null);

    await expect(
      authService.changePassword("user-unknown", {
        currentPassword: "old",
        newPassword: "new",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.NOT_FOUND });
  });

  it("lève UNAUTHORIZED (401) si le mot de passe actuel est incorrect", async () => {
    mocks.findById.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(false);

    await expect(
      authService.changePassword("user-uuid-1", {
        currentPassword: "mauvais",
        newPassword: "nouveau",
      })
    ).rejects.toMatchObject({ statusCode: StatusCodes.UNAUTHORIZED });
  });

  it("hache le nouveau mot de passe si le changement est valide", async () => {
    mocks.findById.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(true);

    await authService.changePassword("user-uuid-1", {
      currentPassword: "correct",
      newPassword: "nouveau-mdp",
    });

    expect(mocks.bcryptHash).toHaveBeenCalledWith("nouveau-mdp", expect.any(Number));
  });
});
