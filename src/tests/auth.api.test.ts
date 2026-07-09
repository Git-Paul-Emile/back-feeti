/**
 * ═══════════════════════════════════════════════════════════════════════
 *  TESTS D'INTÉGRATION API — Routes Auth (/api/auth)
 *  Couverture HTTP: register, login, me, profile, password
 *  Framework: Vitest + Supertest
 * ═══════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Application } from "express";

// ─── Mocks hoistés (avant tout import de code applicatif) ─────────────
const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  bcryptHash: vi.fn().mockResolvedValue("$2b$10$hashed"),
  bcryptCompare: vi.fn(),
  generateToken: vi.fn().mockReturnValue("access-token-xyz"),
  generateRefreshToken: vi.fn().mockReturnValue("refresh-token-xyz"),
  generatePasswordResetToken: vi.fn().mockReturnValue("reset-token-xyz"),
  verifyPasswordResetToken: vi.fn(),
  verifyToken: vi.fn(),
  fbAuthCreateUser: vi.fn().mockResolvedValue({ uid: "fb-uid" }),
  fbAuthSetCustomUserClaims: vi.fn().mockResolvedValue(undefined),
  fbAuthVerifyIdToken: vi.fn(),
  dbDoc: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) }),
  addEmailJob: vi.fn().mockResolvedValue(undefined),
  emailSendWelcomeUser: vi.fn().mockResolvedValue(undefined),
  emailSendWelcomeOrganizer: vi.fn().mockResolvedValue(undefined),
  emailSendPasswordReset: vi.fn().mockResolvedValue(undefined),
  platformSettingFindMany: vi.fn().mockResolvedValue([]),
  getIO: vi.fn().mockReturnValue(null),
}));

vi.mock("../repositories/auth.repository.js", () => ({
  authRepository: {
    findByEmail: mocks.findByEmail,
    findById: mocks.findById,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
  },
}));

vi.mock("bcrypt", () => ({
  default: { hash: mocks.bcryptHash, compare: mocks.bcryptCompare },
  hash: mocks.bcryptHash,
  compare: mocks.bcryptCompare,
}));

vi.mock("../config/jwt.js", () => ({
  generateToken: mocks.generateToken,
  generateRefreshToken: mocks.generateRefreshToken,
  generatePasswordResetToken: mocks.generatePasswordResetToken,
  verifyPasswordResetToken: mocks.verifyPasswordResetToken,
  verifyToken: mocks.verifyToken,
}));

vi.mock("../config/firebase-admin.js", () => ({
  fbAuth: {
    createUser: mocks.fbAuthCreateUser,
    setCustomUserClaims: mocks.fbAuthSetCustomUserClaims,
    verifyIdToken: mocks.fbAuthVerifyIdToken,
  },
  db: {
    collection: vi.fn().mockReturnValue({ doc: mocks.dbDoc }),
  },
  FieldValue: {
    serverTimestamp: vi.fn().mockReturnValue("ts"),
  },
}));

vi.mock("../queues/email.queue.js", () => ({
  addEmailJob: mocks.addEmailJob,
}));

vi.mock("../services/email.service.js", () => ({
  emailService: {
    sendWelcomeUser: mocks.emailSendWelcomeUser,
    sendWelcomeOrganizer: mocks.emailSendWelcomeOrganizer,
    sendPasswordReset: mocks.emailSendPasswordReset,
  },
}));

vi.mock("../config/database.js", () => ({
  prisma: {
    platformSetting: { findMany: mocks.platformSettingFindMany },
    $transaction: vi.fn(),
    user: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../config/socket.js", () => ({
  getIO: mocks.getIO,
}));

// ─── Import de la vraie app après les mocks ───────────────────────────
import { buildTestApp } from "./setup/testApp.js";
import authRouter from "../routes/auth.routes.js";

let app: Application;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.bcryptHash.mockResolvedValue("$2b$10$hashed");
  mocks.generateToken.mockReturnValue("access-token-xyz");
  mocks.generateRefreshToken.mockReturnValue("refresh-token-xyz");
  mocks.dbDoc.mockReturnValue({
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  });
  app = await buildTestApp([{ path: "/api/auth", router: authRouter }]);
});

// ─── Données de test ─────────────────────────────────────────────────
const REGISTER_PAYLOAD = {
  name: "Mbeki Test",
  email: "mbeki@feeti.cm",
  password: "S3cr3t!2024",
  country: "Cameroun",
  city: "Douala",
};

const FAKE_USER = {
  id: "user-api-1",
  name: "Mbeki Test",
  email: "mbeki@feeti.cm",
  passwordHash: "$2b$10$hashed",
  role: "user",
  firebaseUid: "fb-uid",
  phone: null,
  country: null,
  city: null,
  interests: "[]",
  photoUrl: null,
  createdAt: new Date(),
};

// ═════════════════════════════════════════════════════════════════════
// GROUPE 1 — POST /api/auth/register
// ═════════════════════════════════════════════════════════════════════

describe("POST /api/auth/register", () => {

  it("retourne 201 avec user et tokens si l'inscription réussit", async () => {
    mocks.findByEmail.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ ...FAKE_USER, firebaseUid: undefined });
    mocks.updateUser.mockResolvedValue(FAKE_USER);

    const res = await request(app)
      .post("/api/auth/register")
      .send(REGISTER_PAYLOAD)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("retourne 409 si l'email est déjà pris", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);

    const res = await request(app)
      .post("/api/auth/register")
      .send(REGISTER_PAYLOAD)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(409);
  });

  it("retourne 422 si le corps de la requête est invalide (email manquant)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test", password: "pass123" }) // email manquant
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
  });

  it("retourne 422 si le mot de passe est trop court", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...REGISTER_PAYLOAD, password: "abc" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
  });

  it("retourne 422 si le nom est manquant", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@test.cm", password: "S3cr3t!2024" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 2 — POST /api/auth/login
// ═════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {

  it("retourne 200 avec tokens si les identifiants sont valides", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: FAKE_USER.email, password: "S3cr3t!2024" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data.user).toBeDefined();
  });

  it("retourne 401 si l'email est inconnu", async () => {
    mocks.findByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inconnu@test.cm", password: "pass" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
  });

  it("retourne 401 si le mot de passe est incorrect", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: FAKE_USER.email, password: "mauvais-mdp" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
  });

  it("retourne 422 si l'email est absent du corps", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "pass" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(422);
  });

  it("ne retourne jamais passwordHash dans la réponse", async () => {
    mocks.findByEmail.mockResolvedValue(FAKE_USER);
    mocks.bcryptCompare.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: FAKE_USER.email, password: "S3cr3t!2024" })
      .set("Content-Type", "application/json");

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("$2b$");
  });
});

// ═════════════════════════════════════════════════════════════════════
// GROUPE 3 — GET /api/auth/me
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/auth/me", () => {

  it("retourne 401 si aucun token n'est fourni", async () => {
    const res = await request(app)
      .get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("retourne 401 si le token est invalide", async () => {
    mocks.verifyToken.mockImplementation(() => {
      throw new Error("Token invalide");
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
  });

  it("retourne 200 avec le profil si le token est valide", async () => {
    mocks.verifyToken.mockReturnValue({ userId: FAKE_USER.id, role: "user" });
    mocks.findById.mockResolvedValue(FAKE_USER);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.data?.email).toBe(FAKE_USER.email);
  });
});
