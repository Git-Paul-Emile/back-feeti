import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { detectIntent } from "../services/dialogflowService.js";

const router = Router();

const messageSchema = z.object({
  message: z.string().min(1).max(500),
  sessionId: z.string().optional(),
});

// ─── Public ───────────────────────────────────────────────────────────────────
router.post("/message", async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Message invalide" });
      return;
    }

    const { message, sessionId = randomUUID() } = parsed.data;
    const result = await detectIntent(message, sessionId);

    res.json({ ...result, sessionId });
  } catch (err) {
    next(err);
  }
});

export default router;
