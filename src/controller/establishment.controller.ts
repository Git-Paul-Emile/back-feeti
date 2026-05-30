// @ts-nocheck
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { jsonResponse } from '../utils/response.js';
import { controllerWrapper } from '../utils/ControllerWrapper.js';
import {
  getPricing,
  checkActiveSubscription,
  createEstablishment,
  initiateSubscriptionPayment,
  confirmSubscriptionPayment,
  initiateDealPayment,
  confirmDealPayment,
} from '../services/establishment.service.js';

// GET /api/establishment/my
export const getMyEstablishments = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const items = await prisma.leisureItem.findMany({
    where: { createdById: userId },
    include: {
      category: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Établissements récupérés', data: items }));
});

// POST /api/establishment/create
export const createMyEstablishment = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const {
    name, description, categorySlug, location, address,
    phone, website, priceRange, openingHours, image,
    countryCode, tags, features,
  } = req.body as Record<string, unknown>;

  if (!name || !description || !categorySlug || !location) {
    throw new AppError('name, description, categorySlug et location sont requis', StatusCodes.BAD_REQUEST);
  }

  const item = await createEstablishment({
    userId,
    name: String(name),
    description: String(description),
    categorySlug: String(categorySlug),
    location: String(location),
    address: address ? String(address) : undefined,
    phone: phone ? String(phone) : undefined,
    website: website ? String(website) : undefined,
    priceRange: priceRange ? String(priceRange) : undefined,
    openingHours: openingHours ? String(openingHours) : undefined,
    image: image ? String(image) : undefined,
    countryCode: countryCode ? String(countryCode) : undefined,
    tags: Array.isArray(tags) ? tags.map(String) : [],
    features: Array.isArray(features) ? features.map(String) : [],
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: 'success', message: 'Établissement créé (en attente de paiement)', data: item }));
});

// GET /api/establishment/pricing
export const getEstablishmentPricing = controllerWrapper(async (_req: Request, res: Response) => {
  const pricing = await getPricing();
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Tarification récupérée', data: pricing }));
});

// POST /api/establishment/subscription/initiate
export const initiateSubscription = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { leisureItemId, method, phone, email } = req.body as {
    leisureItemId?: string;
    method?: 'card' | 'mobile_money' | 'paystack';
    phone?: string;
    email?: string;
  };

  if (!leisureItemId || !method) {
    throw new AppError('leisureItemId et method sont requis', StatusCodes.BAD_REQUEST);
  }

  const result = await initiateSubscriptionPayment({ userId, leisureItemId, method, phone, email });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Paiement initié', data: result }));
});

// POST /api/establishment/subscription/confirm
export const confirmSubscription = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { paymentRef, leisureItemId, method } = req.body as {
    paymentRef?: string;
    leisureItemId?: string;
    method?: 'card' | 'mobile_money' | 'paystack';
  };

  if (!paymentRef || !leisureItemId || !method) {
    throw new AppError('paymentRef, leisureItemId et method sont requis', StatusCodes.BAD_REQUEST);
  }

  const subscription = await confirmSubscriptionPayment({ paymentRef, userId, leisureItemId, method });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Abonnement activé', data: subscription }));
});

// GET /api/establishment/subscription/status/:leisureItemId
export const getSubscriptionStatus = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const leisureItemId = String(req.params.leisureItemId);
  const isActive = await checkActiveSubscription(userId, leisureItemId);
  const sub = await prisma.establishmentSubscription.findFirst({
    where: { userId, leisureItemId },
    orderBy: { createdAt: 'desc' },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Statut abonnement', data: { isActive, subscription: sub } }));
});

// POST /api/establishment/deals/payment/initiate
export const initiateDealPaymentRoute = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { leisureItemId, method, phone, email, dealData } = req.body as {
    leisureItemId?: string;
    method?: 'card' | 'mobile_money' | 'paystack';
    phone?: string;
    email?: string;
    dealData?: Record<string, unknown>;
  };

  if (!leisureItemId || !method || !dealData) {
    throw new AppError('leisureItemId, method et dealData sont requis', StatusCodes.BAD_REQUEST);
  }

  if (!dealData.title || !dealData.validUntil) {
    throw new AppError('title et validUntil sont requis dans dealData', StatusCodes.BAD_REQUEST);
  }

  const result = await initiateDealPayment({ userId, leisureItemId, dealData, method, phone, email });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Paiement bon plan initié', data: result }));
});

// POST /api/establishment/deals/payment/confirm
export const confirmDealPaymentRoute = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { paymentRef } = req.body as { paymentRef?: string };

  if (!paymentRef) throw new AppError('paymentRef est requis', StatusCodes.BAD_REQUEST);

  const result = await confirmDealPayment({ paymentRef, userId });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan publié', data: result }));
});

// GET /api/establishment/deals
export const getMyDeals = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const deals = await prisma.deal.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: 'desc' },
    include: { leisureItem: { select: { id: true, name: true, image: true, address: true, location: true, phone: true, website: true } } },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bons plans récupérés', data: deals }));
});

// PUT /api/establishment/deals/:id
export const updateMyDeal = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) throw new AppError('Bon plan introuvable', StatusCodes.NOT_FOUND);
  if (existing.createdById !== userId) throw new AppError('Accès refusé', StatusCodes.FORBIDDEN);

  const { title, description, category, originalPrice, discountedPrice, discount,
    validUntil, location, image, isPopular, merchantName, tags,
    availableQuantity, maxQuantity, contactPhone, contactEmail, contactWebsite, status } = req.body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
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
  if (availableQuantity !== undefined) data.availableQuantity = availableQuantity ? Number(availableQuantity) : null;
  if (maxQuantity !== undefined) data.maxQuantity = maxQuantity ? Number(maxQuantity) : null;
  if (contactPhone !== undefined) data.contactPhone = contactPhone ? String(contactPhone) : null;
  if (contactEmail !== undefined) data.contactEmail = contactEmail ? String(contactEmail) : null;
  if (contactWebsite !== undefined) data.contactWebsite = contactWebsite ? String(contactWebsite) : null;
  if (status !== undefined) data.status = String(status);

  const updated = await prisma.deal.update({
    where: { id },
    data,
    include: { leisureItem: { select: { id: true, name: true, image: true } } },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan mis à jour', data: updated }));
});

// DELETE /api/establishment/deals/:id
export const deleteMyDeal = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const existing = await prisma.deal.findUnique({ where: { id } });
  if (!existing) throw new AppError('Bon plan introuvable', StatusCodes.NOT_FOUND);
  if (existing.createdById !== userId) throw new AppError('Accès refusé', StatusCodes.FORBIDDEN);

  await prisma.deal.delete({ where: { id } });
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Bon plan supprimé' }));
});

// GET /api/establishment/my/payment-history
export const getMyPaymentHistory = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const [subscriptions, dealPayments] = await Promise.all([
    prisma.establishmentSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { leisureItem: { select: { id: true, name: true } } },
    }),
    prisma.dealPayment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        leisureItem: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
  ]);
  res.status(StatusCodes.OK).json(jsonResponse({
    status: 'success',
    message: 'Historique récupéré',
    data: { subscriptions, dealPayments },
  }));
});
