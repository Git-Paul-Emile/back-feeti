// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { PrismaClient } from "../generated/prisma/client.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { AppError } from "../utils/AppError.js";
import type { CreateBlogCategoryInput, UpdateBlogCategoryInput, CreateBlogPostInput, UpdateBlogPostInput } from "../validators/blog.validator.js";

const prisma = new PrismaClient();

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function parsePost(post: any) {
  return { ...post, tags: parseTags(post.tags) };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ─── Blog Categories ──────────────────────────────────────────────────────────

export const getAllBlogCategories = controllerWrapper(async (_req: Request, res: Response) => {
  const categories = await prisma.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégories récupérées", data: categories })
  );
});

export const createBlogCategory = controllerWrapper(async (req: Request, res: Response) => {
  const body = req.body as CreateBlogCategoryInput;
  const category = await prisma.blogCategory.create({ data: body });
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Catégorie créée", data: category })
  );
});

export const updateBlogCategory = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as UpdateBlogCategoryInput;
  const category = await prisma.blogCategory.update({ where: { id }, data: body });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégorie mise à jour", data: category })
  );
});

export const deleteBlogCategory = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const postsCount = await prisma.blogPost.count({ where: { category: { id } } });
  if (postsCount > 0) {
    throw new AppError(
      `Impossible de supprimer : ${postsCount} article(s) sont liés à cette catégorie`,
      StatusCodes.BAD_REQUEST
    );
  }
  await prisma.blogCategory.delete({ where: { id } });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégorie supprimée", data: null })
  );
});

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export const getAllBlogPosts = controllerWrapper(async (req: Request, res: Response) => {
  const { category, status, search, sort = "date", page = "1", limit = "12" } = req.query as Record<string, string>;

  const where: any = {};
  if (category && category !== "all") where.categorySlug = category;
  if (status) where.status = status;
  else where.status = "published"; // public route only returns published
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: any =
    sort === "popular" ? { views: "desc" }
    : sort === "comments" ? { comments: "desc" }
    : sort === "readTime" ? { readTime: "asc" }
    : { publishDate: "desc" };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        category: true,
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Articles récupérés",
      data: { posts: posts.map(parsePost), total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  );
});

export const getAllBlogPostsAdmin = controllerWrapper(async (req: Request, res: Response) => {
  const { category, status, search, sort = "date", page = "1", limit = "20" } = req.query as Record<string, string>;

  const where: any = {};
  if (category && category !== "all") where.categorySlug = category;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
      { author: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const orderBy: any =
    sort === "popular" ? { views: "desc" }
    : sort === "comments" ? { comments: "desc" }
    : { createdAt: "desc" };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      include: {
        category: true,
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Articles récupérés",
      data: { posts: posts.map(parsePost), total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  );
});

export const getBlogPostById = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { id: true, name: true } },
    },
  });
  if (!post) throw new AppError("Article non trouvé", StatusCodes.NOT_FOUND);

  // Increment view count
  await prisma.blogPost.update({ where: { id }, data: { views: { increment: 1 } } });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Article récupéré", data: parsePost({ ...post, views: post.views + 1 }) })
  );
});

export const getRelatedBlogPosts = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new AppError("Article non trouvé", StatusCodes.NOT_FOUND);

  const related = await prisma.blogPost.findMany({
    where: {
      categorySlug: post.categorySlug,
      status: "published",
      id: { not: id },
    },
    take: 3,
    orderBy: { views: "desc" },
    include: {
      category: true,
      author: { select: { id: true, name: true } },
    },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Articles similaires récupérés", data: related.map(parsePost) })
  );
});

export const createBlogPost = controllerWrapper(async (req: Request, res: Response) => {
  const body = req.body as CreateBlogPostInput;
  const authorId = req.user!.userId;

  const slug = slugify(body.title);
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError("Un article avec ce titre existe déjà", StatusCodes.BAD_REQUEST);
  }

  const readTime = body.readTime ?? Math.max(1, Math.ceil(body.content.split(" ").length / 200));
  const tags = JSON.stringify(body.tags ?? []);

  const post = await prisma.blogPost.create({
    data: {
      title: body.title,
      slug,
      excerpt: body.excerpt,
      content: body.content,
      featuredImage: body.featuredImage ?? "",
      categorySlug: body.categorySlug,
      tags,
      status: body.status ?? "draft",
      isFeatured: body.isFeatured ?? false,
      readTime,
      authorId,
      publishDate: body.status === "published" ? new Date() : null,
    },
    include: { category: true, author: { select: { id: true, name: true } } },
  });

  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Article créé", data: post })
  );
});

export const updateBlogPost = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as UpdateBlogPostInput;

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new AppError("Article non trouvé", StatusCodes.NOT_FOUND);

  const updateData: any = { ...body };

  if (body.tags !== undefined) {
    updateData.tags = JSON.stringify(body.tags);
  }
  if (body.title && body.title !== existing.title) {
    updateData.slug = slugify(body.title);
  }
  if (body.content && !body.readTime) {
    updateData.readTime = Math.max(1, Math.ceil(body.content.split(" ").length / 200));
  }
  if (body.status === "published" && existing.status === "draft" && !existing.publishDate) {
    updateData.publishDate = new Date();
  }

  const post = await prisma.blogPost.update({
    where: { id },
    data: updateData,
    include: { category: true, author: { select: { id: true, name: true } } },
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Article mis à jour", data: post })
  );
});

export const deleteBlogPost = controllerWrapper(async (req: Request, res: Response) => {
  const { id } = req.params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new AppError("Article non trouvé", StatusCodes.NOT_FOUND);

  await prisma.blogPost.delete({ where: { id } });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Article supprimé", data: null })
  );
});

export const getBlogStats = controllerWrapper(async (_req: Request, res: Response) => {
  const [total, published, draft, totalViews, totalComments] = await Promise.all([
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { status: "published" } }),
    prisma.blogPost.count({ where: { status: "draft" } }),
    prisma.blogPost.aggregate({ _sum: { views: true } }),
    prisma.blogPost.aggregate({ _sum: { comments: true } }),
  ]);

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Statistiques récupérées",
      data: {
        total,
        published,
        draft,
        totalViews: totalViews._sum.views ?? 0,
        totalComments: totalComments._sum.comments ?? 0,
      },
    })
  );
});
