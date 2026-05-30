// @ts-nocheck
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { jsonResponse } from '../utils/response.js';
import { controllerWrapper } from '../utils/ControllerWrapper.js';
import { getPricing } from '../services/establishment.service.js';

const PRICING_KEYS = [
  'establishment_annual_fee',
  'bonplan_creation_fee',
  'establishment_subscription_duration_days',
  'fee_currency',
] as const;

// GET /api/admin/platform-pricing
export const getPlatformPricing = controllerWrapper(async (_req: Request, res: Response) => {
  const pricing = await getPricing();
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Tarification récupérée', data: pricing }));
});

// PUT /api/admin/platform-pricing
export const updatePlatformPricing = controllerWrapper(async (req: Request, res: Response) => {
  const actorId = req.user!.userId;
  const body = req.body as Record<string, unknown>;

  const keyMap: Record<string, (typeof PRICING_KEYS)[number]> = {
    establishmentAnnualFee: 'establishment_annual_fee',
    bonplanCreationFee: 'bonplan_creation_fee',
    subscriptionDurationDays: 'establishment_subscription_duration_days',
    currency: 'fee_currency',
  };

  const upserts = [];
  for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
    if (bodyKey in body) {
      const val = String(body[bodyKey]);
      if (['establishmentAnnualFee', 'bonplanCreationFee'].includes(bodyKey)) {
        const n = parseFloat(val);
        if (isNaN(n) || n < 0) throw new AppError(`${bodyKey} doit être un nombre positif`, StatusCodes.BAD_REQUEST);
      }
      if (bodyKey === 'subscriptionDurationDays') {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1 || n > 3650) throw new AppError('Durée doit être entre 1 et 3650 jours', StatusCodes.BAD_REQUEST);
      }
      upserts.push(
        prisma.platformSetting.upsert({
          where: { key: dbKey },
          create: { key: dbKey, value: val, updatedBy: actorId },
          update: { value: val, updatedBy: actorId },
        })
      );
    }
  }

  if (upserts.length === 0) throw new AppError('Aucun paramètre valide fourni', StatusCodes.BAD_REQUEST);
  await Promise.all(upserts);

  const pricing = await getPricing();
  res.status(StatusCodes.OK).json(jsonResponse({ status: 'success', message: 'Tarification mise à jour', data: pricing }));
});

// GET /api/admin/subscriptions
export const getAllSubscriptions = controllerWrapper(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as Record<string, string | undefined>;
  const skip = ((Number(page) || 1) - 1) * (Number(limit) || 20);
  const take = Math.min(Number(limit) || 20, 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [subscriptions, total] = await Promise.all([
    prisma.establishmentSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, email: true } },
        leisureItem: { select: { id: true, name: true, location: true } },
      },
    }),
    prisma.establishmentSubscription.count({ where }),
  ]);

  res.status(StatusCodes.OK).json(jsonResponse({
    status: 'success',
    message: 'Abonnements récupérés',
    data: subscriptions,
    meta: { total, page: Number(page) || 1, limit: take },
  }));
});

// GET /api/admin/deal-payments
export const getAllDealPayments = controllerWrapper(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as Record<string, string | undefined>;
  const skip = ((Number(page) || 1) - 1) * (Number(limit) || 20);
  const take = Math.min(Number(limit) || 20, 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    prisma.dealPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, email: true } },
        leisureItem: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    prisma.dealPayment.count({ where }),
  ]);

  res.status(StatusCodes.OK).json(jsonResponse({
    status: 'success',
    message: 'Paiements bon plans récupérés',
    data: payments,
    meta: { total, page: Number(page) || 1, limit: take },
  }));
});
