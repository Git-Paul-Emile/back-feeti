import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { authService } from "../services/auth.service.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { verifyRefreshToken, generateToken } from "../config/jwt.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/auth.validator.js";

const REFRESH_COOKIE = "feeti_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = controllerWrapper(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Inscription réussie", data: { user, accessToken } })
  );
});

export const login = controllerWrapper(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Connexion réussie", data: { user, accessToken } })
  );
});

export const logout = controllerWrapper(async (req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Déconnexion réussie" })
  );
});

export const me = controllerWrapper(async (req: Request, res: Response) => {
  const user = await authService.getMe((req as any).user.userId);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Profil récupéré", data: user })
  );
});

export const updateProfile = controllerWrapper(async (req: Request, res: Response) => {
  const result = updateProfileSchema.safeParse(req.body);
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      if (field && !errors[field]) errors[field] = issue.message;
    });
    res.status(StatusCodes.BAD_REQUEST).json({ message: "Données invalides", errors });
    return;
  }
  const user = await authService.updateProfile((req as any).user.userId, result.data);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Profil mis à jour", data: user })
  );
});

export const changePassword = controllerWrapper(async (req: Request, res: Response) => {
  const result = changePasswordSchema.safeParse(req.body);
  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      if (field && !errors[field]) errors[field] = issue.message;
    });
    res.status(StatusCodes.BAD_REQUEST).json({ message: "Données invalides", errors });
    return;
  }
  await authService.changePassword((req as any).user.userId, result.data);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Mot de passe modifié avec succès" })
  );
});

export const deleteAccount = controllerWrapper(async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    res.status(StatusCodes.BAD_REQUEST).json({
      message: "Le mot de passe est requis",
      errors: { password: "Le mot de passe est requis" },
    });
    return;
  }
  await authService.deleteAccount((req as any).user.userId, password);
  res.clearCookie(REFRESH_COOKIE);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Compte supprimé avec succès" })
  );
});

export const refresh = controllerWrapper(async (req: Request, res: Response) => {
  const token = req.cookies[REFRESH_COOKIE];
  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json(
      jsonResponse({ status: "unauthorized", message: "Token de rafraîchissement manquant" })
    );
    return;
  }

  const payload = verifyRefreshToken(token) as { userId: string };
  const user = await authService.getMe(payload.userId);
  const accessToken = generateToken({ userId: user.id, role: user.role });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Token rafraîchi", data: { accessToken } })
  );
});

// ── Firebase Auth Controllers ───────────────────────────────────────────────
export const registerWithFirebase = controllerWrapper(async (req: Request, res: Response) => {
  const { idToken, ...profileData } = req.body;
  const { user, accessToken, refreshToken } = await authService.registerWithFirebase(idToken, profileData);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Inscription Firebase réussie", data: { user, accessToken } })
  );
});

export const loginWithFirebase = controllerWrapper(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  const { user, accessToken, refreshToken } = await authService.loginWithFirebase(idToken);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Connexion Firebase réussie", data: { user, accessToken } })
  );
});

export const verifyFirebaseToken = controllerWrapper(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  const result = await authService.verifyFirebaseToken(idToken);
  
  if (result.valid && result.decoded) {
    res.status(StatusCodes.OK).json(
      jsonResponse({ status: "success", message: "Token valide", data: { 
        uid: result.decoded.uid,
        email: result.decoded.email,
        name: result.decoded.name,
        picture: result.decoded.picture,
      } })
    );
  } else {
    res.status(StatusCodes.UNAUTHORIZED).json(
      jsonResponse({ status: "error", message: "Token Firebase invalide" })
    );
  }
});
