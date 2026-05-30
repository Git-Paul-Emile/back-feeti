/**
 * ═══════════════════════════════════════════════════════════════════════
 *  HELPER TESTS — Application Express de test
 *  Crée une instance Express isolée avec toutes les dépendances
 *  externes mockées (DB, Firebase, Redis, emails, sockets).
 *
 *  Usage: import { buildTestApp } from "./setup/testApp.js";
 * ═══════════════════════════════════════════════════════════════════════
 */

import express from "express";
import cookieParser from "cookie-parser";
import type { Application } from "express";

/**
 * Crée une application Express minimale pour les tests d'intégration.
 * Charge les routes passées en paramètre avec les middlewares de base.
 */
export async function buildTestApp(routers: { path: string; router: express.Router }[]): Promise<Application> {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  for (const { path, router } of routers) {
    app.use(path, router);
  }

  // Gestionnaire d'erreur centralisé
  app.use(
    (
      err: { statusCode?: number; message: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
      });
    }
  );

  return app;
}

/**
 * Génère un token JWT de test (format réel signé avec ACCESS_TOKEN_SECRET de test).
 */
export function makeTestToken(payload: { userId: string; role: string }): string {
  // Simple fake token for test environment
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `test-header.${base64Payload}.test-signature`;
}
