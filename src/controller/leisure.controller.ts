import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { jsonResponse } from '../utils/response.js';
import { controllerWrapper } from '../utils/ControllerWrapper.js';
import { leisureRepository, type LeisureFilters } from '../repositories/leisure.repository.js';

// ── Public ────────────────────────────────────────────────────────────────────

// GET /api/leisure/categories
export const getAllLeisureCategories = controllerWrapper(async (_req: Request, res: Response) => {
  const categories = await prisma.leisureCategory.findMany({ orderBy: { name: 'asc' } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégories récupérées', data: categories }));
});

// GET /api/leisure
export const getAllLeisureItems = controllerWrapper(async (req: Request, res: Response) => {
  const { categorySlug, countryCode, search, lat, lng } = req.query as Record<string, string | undefined>;
  const filters: LeisureFilters = {
    categorySlug,
    countryCode,
    search,
    status: 'published',
    lat: lat ? parseFloat(lat) : undefined,
    lng: lng ? parseFloat(lng) : undefined,
  };
  const items = await leisureRepository.findAll(filters);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Loisirs récupérés', data: items }));
});

// GET /api/leisure/:id
export const getLeisureItemById = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const item = await leisureRepository.findById(id);
  if (!item) throw new AppError('Loisir introuvable', StatusCodes.NOT_FOUND);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Loisir récupéré', data: item }));
});

// GET /api/leisure/favorites  [auth]
export const getMyLeisureFavorites = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items = await leisureRepository.getMyFavorites(userId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Favoris récupérés', data: items }));
});

// GET /api/leisure/:id/favorite  [auth]
export const checkLeisureFavorite = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const leisureItemId = String(req.params.id);
  const isFavorited = await leisureRepository.isFavorited(userId, leisureItemId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Statut récupéré', data: { isFavorited } }));
});

// POST /api/leisure/:id/favorite  [auth]
export const toggleLeisureFavorite = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const leisureItemId = String(req.params.id);
  const item = await leisureRepository.findById(leisureItemId);
  if (!item) throw new AppError('Loisir introuvable', StatusCodes.NOT_FOUND);
  const result = await leisureRepository.toggleFavorite(userId, leisureItemId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: result.isFavorited ? 'Ajouté aux favoris' : 'Retiré des favoris', data: result }));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/admin/leisure
export const getAllLeisureAdmin = controllerWrapper(async (_req: Request, res: Response) => {
  const items = await leisureRepository.findAllAdmin();
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Loisirs récupérés', data: items }));
});

// POST /api/admin/leisure
export const createLeisureItem = controllerWrapper(async (req: Request, res: Response) => {
  const {
    name, description, categorySlug, location, address, phone, website,
    priceRange, openingHours, image, rating, reviewCount, features, tags,
    status, countryCode, isFeatured,
  } = req.body as Record<string, unknown>;

  if (!name || !description || !categorySlug || !location) {
    throw new AppError('Champs obligatoires manquants (name, description, categorySlug, location)', StatusCodes.BAD_REQUEST);
  }

  const catExists = await prisma.leisureCategory.findUnique({ where: { slug: String(categorySlug) } });
  if (!catExists) throw new AppError('Catégorie de loisir introuvable', StatusCodes.BAD_REQUEST);

  const item = await leisureRepository.create({
    name: String(name),
    description: String(description),
    categorySlug: String(categorySlug),
    location: String(location),
    address: address ? String(address) : undefined,
    phone: phone ? String(phone) : undefined,
    website: website ? String(website) : undefined,
    priceRange: priceRange ? String(priceRange) : undefined,
    openingHours: openingHours ? String(openingHours) : undefined,
    image: image ? String(image) : '',
    rating: rating !== undefined ? Number(rating) : undefined,
    reviewCount: reviewCount !== undefined ? Number(reviewCount) : undefined,
    features: features ? String(features) : '[]',
    tags: tags ? String(tags) : '[]',
    status: status ? String(status) : 'published',
    countryCode: countryCode ? String(countryCode) : undefined,
    isFeatured: Boolean(isFeatured),
    createdById: req.user!.userId,
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: 'success', message: 'Loisir créé', data: item }));
});

// PUT /api/admin/leisure/:id
export const updateLeisureItem = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await leisureRepository.findById(id);
  if (!existing) throw new AppError('Loisir introuvable', StatusCodes.NOT_FOUND);

  const {
    name, description, categorySlug, location, address, phone, website,
    priceRange, openingHours, image, rating, reviewCount, features, tags,
    status, countryCode, isFeatured,
  } = req.body as Record<string, unknown>;

  const data: Parameters<typeof leisureRepository.update>[1] = {};
  if (name !== undefined) data.name = String(name);
  if (description !== undefined) data.description = String(description);
  if (categorySlug !== undefined) {
    const catExists = await prisma.leisureCategory.findUnique({ where: { slug: String(categorySlug) } });
    if (!catExists) throw new AppError('Catégorie de loisir introuvable', StatusCodes.BAD_REQUEST);
    data.categorySlug = String(categorySlug);
  }
  if (location !== undefined) data.location = String(location);
  if (address !== undefined) data.address = String(address);
  if (phone !== undefined) data.phone = String(phone);
  if (website !== undefined) data.website = String(website);
  if (priceRange !== undefined) data.priceRange = String(priceRange);
  if (openingHours !== undefined) data.openingHours = String(openingHours);
  if (image !== undefined) data.image = String(image);
  if (rating !== undefined) data.rating = Number(rating);
  if (reviewCount !== undefined) data.reviewCount = Number(reviewCount);
  if (features !== undefined) data.features = String(features);
  if (tags !== undefined) data.tags = String(tags);
  if (status !== undefined) data.status = String(status);
  if (countryCode !== undefined) data.countryCode = String(countryCode);
  if (isFeatured !== undefined) data.isFeatured = Boolean(isFeatured);

  const updated = await leisureRepository.update(id, data);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Loisir mis à jour', data: updated }));
});

// DELETE /api/admin/leisure/:id
export const deleteLeisureItem = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await leisureRepository.findById(id);
  if (!existing) throw new AppError('Loisir introuvable', StatusCodes.NOT_FOUND);
  await leisureRepository.delete(id);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Loisir supprimé' }));
});

// POST /api/admin/leisure-categories
export const createLeisureCategory = controllerWrapper(async (req: Request, res: Response) => {
  const { name, slug } = req.body as { name?: string; slug?: string };
  if (!name?.trim() || !slug?.trim()) throw new AppError('Nom et slug requis', StatusCodes.BAD_REQUEST);
  const existing = await prisma.leisureCategory.findFirst({
    where: { OR: [{ name: name.trim() }, { slug: slug.trim() }] },
  });
  if (existing) throw new AppError('Une catégorie avec ce nom ou slug existe déjà', StatusCodes.BAD_REQUEST);
  const created = await prisma.leisureCategory.create({ data: { name: name.trim(), slug: slug.trim() } });
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: 'success', message: 'Catégorie créée', data: created }));
});

// PUT /api/admin/leisure-categories/:id
export const updateLeisureCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { name, slug } = req.body as { name?: string; slug?: string };
  const existing = await prisma.leisureCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError('Catégorie introuvable', StatusCodes.NOT_FOUND);
  const data: { name?: string; slug?: string } = {};
  if (name?.trim()) data.name = name.trim();
  if (slug?.trim()) data.slug = slug.trim();
  const updated = await prisma.leisureCategory.update({ where: { id }, data });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégorie mise à jour', data: updated }));
});

// DELETE /api/admin/leisure-categories/:id
export const deleteLeisureCategory = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await prisma.leisureCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError('Catégorie introuvable', StatusCodes.NOT_FOUND);
  await prisma.leisureCategory.delete({ where: { id } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Catégorie supprimée' }));
});
