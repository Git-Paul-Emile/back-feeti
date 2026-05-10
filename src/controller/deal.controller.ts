// @ts-nocheck
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/AppError.js';
import { jsonResponse } from '../utils/response.js';
import { controllerWrapper } from '../utils/ControllerWrapper.js';
import { dealRepository, type DealFilters } from '../repositories/deal.repository.js';

// GET /api/deals
export const getAllDeals = controllerWrapper(async (req: Request, res: Response) => {
  const {
    search, category, location, discountRange, priceRange, sortBy, countryCode,
    page, limit,
  } = req.query as Record<string, string | undefined>;

  const filters: DealFilters = {
    search,
    category,
    location,
    discountRange: discountRange as DealFilters['discountRange'],
    priceRange: priceRange as DealFilters['priceRange'],
    sortBy: sortBy as DealFilters['sortBy'],
    countryCode,
    page: page ? Number(page) : 1,
    limit: limit ? Math.min(Number(limit), 50) : 12,
  };

  const { deals, total } = await dealRepository.findAll(filters);
  const currentPage = filters.page ?? 1;
  const pageLimit = filters.limit ?? 12;

  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Bons plans récupérés',
    data: deals,
    meta: { total, page: currentPage, limit: pageLimit, hasMore: currentPage * pageLimit < total },
  });
});

// GET /api/deals/locations
export const getDealLocations = controllerWrapper(async (req: Request, res: Response) => {
  const { countryCode } = req.query as { countryCode?: string };
  const locations = await dealRepository.getDistinctLocations(countryCode);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Lieux récupérés', data: locations }));
});

// GET /api/deals/:id
export const getDealById = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const deal = await dealRepository.findById(id);
  if (!deal) throw new AppError('Bon plan introuvable', StatusCodes.NOT_FOUND);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan récupéré', data: deal }));
});

// POST /api/admin/deals
export const createDeal = controllerWrapper(async (req: Request, res: Response) => {
  const {
    title, description, category, originalPrice, discountedPrice, discount,
    validUntil, location, image, isPopular, merchantName, tags,
    availableQuantity, maxQuantity, rating, reviewCount, status, countryCode,
    contactPhone, contactEmail, contactWebsite,
  } = req.body as Record<string, unknown>;

  if (!title || !description || !category || originalPrice === undefined || discountedPrice === undefined
      || discount === undefined || !validUntil || !location || !merchantName) {
    throw new AppError('Champs obligatoires manquants', StatusCodes.BAD_REQUEST);
  }

  const deal = await dealRepository.create({
    title: String(title),
    description: String(description),
    category: String(category),
    originalPrice: Number(originalPrice),
    discountedPrice: Number(discountedPrice),
    discount: Number(discount),
    validUntil: String(validUntil),
    location: String(location),
    image: image ? String(image) : '',
    isPopular: Boolean(isPopular),
    merchantName: String(merchantName),
    tags: tags ? String(tags) : '[]',
    availableQuantity: availableQuantity !== undefined ? Number(availableQuantity) : undefined,
    maxQuantity: maxQuantity !== undefined ? Number(maxQuantity) : undefined,
    rating: rating !== undefined ? Number(rating) : undefined,
    reviewCount: reviewCount !== undefined ? Number(reviewCount) : undefined,
    contactPhone: contactPhone ? String(contactPhone) : undefined,
    contactEmail: contactEmail ? String(contactEmail) : undefined,
    contactWebsite: contactWebsite ? String(contactWebsite) : undefined,
    status: status ? String(status) : 'published',
    countryCode: countryCode ? String(countryCode) : undefined,
    createdById: req.user!.userId,
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: 'success', message: 'Bon plan créé', data: deal }));
});

// PUT /api/admin/deals/:id
export const updateDeal = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await dealRepository.findById(id);
  if (!existing) throw new AppError('Bon plan introuvable', StatusCodes.NOT_FOUND);

  const {
    title, description, category, originalPrice, discountedPrice, discount,
    validUntil, location, image, isPopular, merchantName, tags,
    availableQuantity, maxQuantity, rating, reviewCount, status, countryCode,
    contactPhone, contactEmail, contactWebsite,
  } = req.body as Record<string, unknown>;

  const data: Parameters<typeof dealRepository.update>[1] = {};
  if (title !== undefined) data.title = String(title);
  if (description !== undefined) data.description = String(description);
  if (category !== undefined) data.category = String(category);
  if (originalPrice !== undefined) data.originalPrice = Number(originalPrice);
  if (discountedPrice !== undefined) data.discountedPrice = Number(discountedPrice);
  if (discount !== undefined) data.discount = Number(discount);
  if (validUntil !== undefined) data.validUntil = String(validUntil);
  if (location !== undefined) data.location = String(location);
  if (image !== undefined) data.image = String(image);
  if (isPopular !== undefined) data.isPopular = Boolean(isPopular);
  if (merchantName !== undefined) data.merchantName = String(merchantName);
  if (tags !== undefined) data.tags = String(tags);
  if (availableQuantity !== undefined) data.availableQuantity = Number(availableQuantity);
  if (maxQuantity !== undefined) data.maxQuantity = Number(maxQuantity);
  if (rating !== undefined) data.rating = Number(rating);
  if (reviewCount !== undefined) data.reviewCount = Number(reviewCount);
  if (contactPhone !== undefined) data.contactPhone = contactPhone ? String(contactPhone) : null;
  if (contactEmail !== undefined) data.contactEmail = contactEmail ? String(contactEmail) : null;
  if (contactWebsite !== undefined) data.contactWebsite = contactWebsite ? String(contactWebsite) : null;
  if (status !== undefined) data.status = String(status);
  if (countryCode !== undefined) data.countryCode = String(countryCode);

  const updated = await dealRepository.update(id, data);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan mis à jour', data: updated }));
});

// DELETE /api/admin/deals/:id
export const deleteDeal = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const existing = await dealRepository.findById(id);
  if (!existing) throw new AppError('Bon plan introuvable', StatusCodes.NOT_FOUND);
  await dealRepository.delete(id);
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan supprimé' }));
});

// GET /api/admin/deals
export const getAllDealsAdmin = controllerWrapper(async (_req: Request, res: Response) => {
  const deals = await dealRepository.findAllAdmin();
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bons plans récupérés', data: deals }));
});
