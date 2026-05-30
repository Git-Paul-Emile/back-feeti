/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS UNITAIRES — AppError
 *  Couverture: classe d'erreur métier centrale
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import { AppError } from "../utils/AppError.js";
import { StatusCodes } from "http-status-codes";

describe("AppError", () => {

  // ─── Construction ─────────────────────────────────────────────────────

  it("crée une erreur avec le message fourni", () => {
    const err = new AppError("Accès refusé", 403);
    expect(err.message).toBe("Accès refusé");
  });

  it("hérite de Error (instanceof Error)", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("est instanceof AppError", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(AppError);
  });

  it("utilise le statusCode passé en paramètre", () => {
    const err = new AppError("Non trouvé", 404);
    expect(err.statusCode).toBe(404);
  });

  it("utilise 500 comme statusCode par défaut", () => {
    const err = new AppError("Erreur interne");
    expect(err.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it("isOperational est true par défaut", () => {
    const err = new AppError("test");
    expect(err.isOperational).toBe(true);
  });

  it("isOperational peut être false", () => {
    const err = new AppError("test", 500, undefined, false);
    expect(err.isOperational).toBe(false);
  });

  // ─── Champ errors (validation par champ) ─────────────────────────────

  it("errors est undefined quand non fourni", () => {
    const err = new AppError("test", 400);
    expect(err.errors).toBeUndefined();
  });

  it("stocke les erreurs par champ", () => {
    const fieldErrors = { email: "Email invalide", password: "Trop court" };
    const err = new AppError("Validation échouée", 422, fieldErrors);
    expect(err.errors).toEqual(fieldErrors);
  });

  it("expose le champ email", () => {
    const err = new AppError("Erreur", 422, { email: "Requis" });
    expect(err.errors?.email).toBe("Requis");
  });

  // ─── Codes HTTP sémantiques ───────────────────────────────────────────

  it("StatusCodes.NOT_FOUND = 404", () => {
    const err = new AppError("Introuvable", StatusCodes.NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });

  it("StatusCodes.CONFLICT = 409", () => {
    const err = new AppError("Conflit", StatusCodes.CONFLICT);
    expect(err.statusCode).toBe(409);
  });

  it("StatusCodes.UNPROCESSABLE_ENTITY = 422", () => {
    const err = new AppError("Transition invalide", StatusCodes.UNPROCESSABLE_ENTITY);
    expect(err.statusCode).toBe(422);
  });

  it("StatusCodes.FORBIDDEN = 403", () => {
    const err = new AppError("Interdit", StatusCodes.FORBIDDEN);
    expect(err.statusCode).toBe(403);
  });

  it("StatusCodes.UNAUTHORIZED = 401", () => {
    const err = new AppError("Non autorisé", StatusCodes.UNAUTHORIZED);
    expect(err.statusCode).toBe(401);
  });

  it("StatusCodes.BAD_REQUEST = 400", () => {
    const err = new AppError("Mauvaise requête", StatusCodes.BAD_REQUEST);
    expect(err.statusCode).toBe(400);
  });

  it("StatusCodes.TOO_MANY_REQUESTS = 429", () => {
    const err = new AppError("Trop de requêtes", StatusCodes.TOO_MANY_REQUESTS);
    expect(err.statusCode).toBe(429);
  });

  // ─── Prototype chain ──────────────────────────────────────────────────

  it("name reste 'AppError' via prototype", () => {
    const err = new AppError("test");
    // Le prototype est correctement établi
    expect(err.constructor.name).toBe("AppError");
  });

  it("peut être capturé avec try/catch", () => {
    expect(() => {
      throw new AppError("Lancée", 400);
    }).toThrow("Lancée");
  });

  it("instanceof fonctionne après throw/catch", () => {
    try {
      throw new AppError("Test throw", 404);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });
});
