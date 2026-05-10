import { Router } from "express";
import { getStreamingEvents } from "../controller/integration.controller.js";

const router = Router();

// Public — consommé par feetiPlay
router.get("/streaming-events", getStreamingEvents);

export default router;
