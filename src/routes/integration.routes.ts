import { Router } from "express";
import {
  getStreamingEvents,
  syncFavoriteFromFeetiPlay,
  syncTicketFromFeetiPlay,
} from "../controller/integration.controller.js";

const router = Router();

// Public — consommé par feetiPlay
router.get("/streaming-events", getStreamingEvents);

// FeetiPlay → Feeti2 sync endpoints (protégés par secret)
router.post("/feetiplay/favorites", syncFavoriteFromFeetiPlay);
router.post("/feetiplay/tickets", syncTicketFromFeetiPlay);

export default router;
