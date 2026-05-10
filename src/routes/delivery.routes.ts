import { Router } from "express";
import { getZonesByCountry, getCitiesByCountry } from "../controller/delivery.controller.js";

const router = Router();

router.get("/zones", getZonesByCountry);
router.get("/cities", getCitiesByCountry);

export default router;
