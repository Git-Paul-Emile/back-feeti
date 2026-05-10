import { Router } from "express";
import {
  getAllBlogCategories,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
  getAllBlogPosts,
  getAllBlogPostsAdmin,
  getBlogPostById,
  getRelatedBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getBlogStats,
} from "../controller/blog.controller.js";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validateBody.js";
import {
  createBlogCategorySchema,
  updateBlogCategorySchema,
  createBlogPostSchema,
  updateBlogPostSchema,
} from "../validators/blog.validator.js";

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/categories", getAllBlogCategories);
router.get("/posts", getAllBlogPosts);
router.get("/posts/:id", getBlogPostById);
router.get("/posts/:id/related", getRelatedBlogPosts);

// ─── Admin (admin, moderator, super_admin) ────────────────────────────────────
router.use(authenticate, requireRole("admin", "moderator", "super_admin"));

router.get("/admin/posts", getAllBlogPostsAdmin);
router.get("/admin/stats", getBlogStats);

router.post("/categories", validateBody(createBlogCategorySchema), createBlogCategory);
router.put("/categories/:id", validateBody(updateBlogCategorySchema), updateBlogCategory);
router.delete("/categories/:id", deleteBlogCategory);

router.post("/posts", validateBody(createBlogPostSchema), createBlogPost);
router.put("/posts/:id", validateBody(updateBlogPostSchema), updateBlogPost);
router.delete("/posts/:id", deleteBlogPost);

export default router;
