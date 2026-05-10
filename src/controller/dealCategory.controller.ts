import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { jsonResponse } from '../utils/response.js';
import { controllerWrapper } from '../utils/ControllerWrapper.js';

// GET /api/deal-categories
export const getAllDealCategories = controllerWrapper(async (_req: Request, res: Response) => {
  const categories = await prisma.dealCategory.findMany({ orderBy: { name: 'asc' } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégories récupérées', data: categories }));
});

// POST /api/admin/deal-categories
export const createDealCategory = controllerWrapper(async (req: Request, res: Response) => {
  const { name, slug, icon } = req.body as { name?: string; slug?: string; icon?: string };
  if (!name?.trim() || !slug?.trim()) throw new AppError('Nom et slug requis', StatusCodes.BAD_REQUEST);

  const existing = await prisma.dealCategory.findFirst({ where: { OR: [{ name: name.trim() }, { slug: slug.trim() }] } });
  if (existing) throw new AppError('Une catégorie avec ce nom ou slug existe déjà', StatusCodes.BAD_REQUEST);

  const created = await prisma.dealCategory.create({ data: { name: name.trim(), slug: slug.trim(), icon: icon?.trim() || null } });
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: 'success', message: 'Catégorie créée', data: created }));
});

// PUT /api/admin/deal-categories/:id
export const updateDealCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, slug, icon } = req.body as { name?: string; slug?: string; icon?: string };

  const existing = await prisma.dealCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError('Catégorie introuvable', StatusCodes.NOT_FOUND);

  const data: { name?: string; slug?: string; icon?: string | null } = {};
  if (name?.trim()) data.name = name.trim();
  if (slug?.trim()) data.slug = slug.trim();
  if (icon !== undefined) data.icon = icon.trim() || null;

  const updated = await prisma.dealCategory.update({ where: { id }, data });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégorie mise à jour', data: updated }));
});

// DELETE /api/admin/deal-categories/:id
export const deleteDealCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.dealCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError('Catégorie introuvable', StatusCodes.NOT_FOUND);
  await prisma.dealCategory.delete({ where: { id } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégorie supprimée' }));
});
