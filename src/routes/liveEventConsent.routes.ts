import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { requestLiveForms, recordConsent } from "../controller/liveEventConsent.controller.js";

const router = Router();

// Authentification requise pour toutes les routes
router.post("/request-forms", authenticate, requestLiveForms);
router.post("/consent", authenticate, recordConsent);

export default router;
