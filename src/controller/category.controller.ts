import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { PrismaClient } from "../generated/prisma/client.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { AppError } from "../utils/AppError.js";

const prisma = new PrismaClient();

export const getAllCategories = controllerWrapper(async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégories récupérées", data: categories })
  );
});

export const createCategory = controllerWrapper(async (req: Request, res: Response) => {
  const { name, slug, icon } = req.body as { name: string; slug: string; icon?: string };
  if (!name?.trim() || !slug?.trim()) {
    throw new AppError("Nom et slug requis", StatusCodes.BAD_REQUEST);
  }
  const category = await prisma.category.create({
    data: { name: name.trim(), slug: slug.trim(), icon: icon?.trim() || null },
  });
  res.status(StatusCodes.CREATED).json(
    jsonResponse({ status: "success", message: "Catégorie créée", data: category })
  );
});

export const updateCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, slug, icon } = req.body as { name?: string; slug?: string; icon?: string };
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Catégorie introuvable", StatusCodes.NOT_FOUND);

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(slug?.trim() && { slug: slug.trim() }),
      ...(icon !== undefined && { icon: icon?.trim() || null }),
    },
  });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégorie mise à jour", data: updated })
  );
});

export const deleteCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Catégorie introuvable", StatusCodes.NOT_FOUND);
  await prisma.category.delete({ where: { id } });
  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Catégorie supprimée" })
  );
});
