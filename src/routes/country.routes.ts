import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { getAllCountries, createCountry, updateCountry, deleteCountry } from "../controller/country.controller.js";

const router = Router();

// Public
router.get("/", getAllCountries);

// Admin only
router.post("/", authenticate, requireRole("admin", "super_admin"), createCountry);
router.patch("/:code", authenticate, requireRole("admin", "super_admin"), updateCountry);
router.delete("/:code", authenticate, requireRole("admin", "super_admin"), deleteCountry);

export default router;
