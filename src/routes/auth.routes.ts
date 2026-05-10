import { Router } from "express";
import { register, login, logout, me, refresh, updateProfile, changePassword, deleteAccount, registerWithFirebase, loginWithFirebase, verifyFirebaseToken, forgotPassword, resetPassword } from "../controller/auth.controller.js";
import { validateBody } from "../middlewares/validateBody.js";
import { authenticate } from "../middlewares/authenticate.js";
import { registerSchema, loginSchema, firebaseRegisterSchema, firebaseLoginSchema } from "../validators/auth.validator.js";

const router = Router();

// Routes existantes (bcrypt)
router.post("/register",        validateBody(registerSchema),  register);
router.post("/login",           validateBody(loginSchema),     login);
router.post("/forgot-password",                                forgotPassword);
router.post("/reset-password",                                 resetPassword);

// Routes Firebase Auth
router.post("/firebase/register", validateBody(firebaseRegisterSchema), registerWithFirebase);
router.post("/firebase/login",    validateBody(firebaseLoginSchema),    loginWithFirebase);
router.post("/firebase/verify",                                          verifyFirebaseToken);

// Routes protégées
router.post("/logout",                                 logout);
router.post("/refresh",                                refresh);
router.get(    "/me",       authenticate,              me);
router.patch(  "/profile",  authenticate,              updateProfile);
router.patch(  "/password", authenticate,              changePassword);
router.delete( "/account",  authenticate,              deleteAccount);

export default router;
