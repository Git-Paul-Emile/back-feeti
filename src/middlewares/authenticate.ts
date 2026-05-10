import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyToken } from "../config/jwt.js";
import { AppError } from "../utils/AppError.js";
import { fbAuth } from "../config/firebase-admin.js";
import { authRepository } from "../repositories/auth.repository.js";

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Non authentifié - token manquant", StatusCodes.UNAUTHORIZED));
  }

  const token = authHeader.slice(7);
  try {
    // Essayer de vérifier comme JWT local
    const payload = verifyToken(token) as { userId: string; role: string };
    req.user = payload;
    return next();
  } catch {
    // Si ce n'est pas un JWT local valide, essayer comme token Firebase
    try {
      const decodedToken = await fbAuth.verifyIdToken(token);
      if (!decodedToken.email) {
        return next(new AppError("Email manquant dans le token Firebase", StatusCodes.UNAUTHORIZED));
      }
      const user = await authRepository.findByEmail(decodedToken.email);
      if (!user) {
        return next(new AppError("Utilisateur non trouvé dans la base de données", StatusCodes.UNAUTHORIZED));
      }
      req.user = { userId: user.id, role: user.role };
      return next();
    } catch (fbErr) {
      return next(new AppError("Token invalide ou expiré", StatusCodes.UNAUTHORIZED));
    }
  }
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Accès refusé - permissions insuffisantes", StatusCodes.FORBIDDEN));
    }
    return next();
  };

// Authentification optionnelle : peuple req.user si le token est valide, sinon continue
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token) as { userId: string; role: string };
      req.user = payload;
    } catch {
      try {
        const decodedToken = await fbAuth.verifyIdToken(token);
        if (decodedToken.email) {
          const user = await authRepository.findByEmail(decodedToken.email);
          if (user) {
            req.user = { userId: user.id, role: user.role };
          }
        }
      } catch {
        // token invalide ou expiré : on continue sans utilisateur
      }
    }
  }
  return next();
};
