import { Router } from "express";
import {
  getStreamingEvents,
  syncFavoriteFromFeetiPlay,
  syncTicketFromFeetiPlay,
  syncEventStatusFromFeetiPlay,
} from "../controller/integration.controller.js";

const router = Router();

// Public — consommé par feetiPlay
router.get("/streaming-events", getStreamingEvents);

// FeetiPlay → Feeti2 sync endpoints (protégés par secret)
router.post("/feetiplay/favorites", syncFavoriteFromFeetiPlay);
router.post("/feetiplay/tickets", syncTicketFromFeetiPlay);
router.post("/feetiplay/event-status", syncEventStatusFromFeetiPlay);

export default router;
