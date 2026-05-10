import { Router } from "express";
import { getAllCategories, createCategory, updateCategory, deleteCategory } from "../controller/category.controller.js";
import { authenticate, requireRole } from "../middlewares/authenticate.js";

const router = Router();

// Public
router.get("/", getAllCategories);

// Admin only
router.post("/", authenticate, requireRole("admin", "super_admin"), createCategory);
router.put("/:id", authenticate, requireRole("admin", "super_admin"), updateCategory);
router.delete("/:id", authenticate, requireRole("admin", "super_admin"), deleteCategory);

export default router;
