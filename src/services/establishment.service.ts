import { prisma } from '../config/database.js';
import { paymentService } from './payment.service.js';
import { randomUUID } from 'crypto';

// ─── Clés PlatformSetting ────────────────────────────────────────────────────

const PRICING_KEYS = [
  'establishment_annual_fee',
  'bonplan_creation_fee',
  'establishment_subscription_duration_days',
  'fee_currency',
] as const;

const PRICING_DEFAULTS: Record<(typeof PRICING_KEYS)[number], string> = {
  establishment_annual_fee: '50000',
  bonplan_creation_fee: '5000',
  establishment_subscription_duration_days: '365',
  fee_currency: 'FCFA',
};

// ─── Tarification ────────────────────────────────────────────────────────────

export async function getPricing() {
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: [...PRICING_KEYS] } },
  });
  const map = { ...PRICING_DEFAULTS };
  for (const row of rows) {
    if (row.key in map) (map as Record<string, string>)[row.key] = row.value;
  }
  return {
    establishmentAnnualFee: parseFloat(map.establishment_annual_fee),
    bonplanCreationFee: parseFloat(map.bonplan_creation_fee),
    subscriptionDurationDays: parseInt(map.establishment_subscription_duration_days, 10),
    currency: map.fee_currency,
  };
}

// ─── Abonnements ─────────────────────────────────────────────────────────────

export async function checkActiveSubscription(userId: string, leisureItemId: string): Promise<boolean> {
  const now = new Date();
  const sub = await prisma.establishmentSubscription.findFirst({
    where: { userId, leisureItemId, status: 'active', endDate: { gt: now } },
  });
  return !!sub;
}

// ─── Création d'établissement ─────────────────────────────────────────────────

export async function createEstablishment(params: {
  userId: string;
  name: string;
  description: string;
  categorySlug: string;
  location: string;
  address?: string;
  phone?: string;
  website?: string;
  priceRange?: string;
  openingHours?: string;
  image?: string;
  countryCode?: string;
  tags?: string[];
  features?: string[];
}) {
  const { userId, tags, features, ...rest } = params;

  const item = await prisma.leisureItem.create({
    data: {
      ...rest,
      tags: JSON.stringify(tags ?? []),
      features: JSON.stringify(features ?? []),
      status: 'pending',
      createdById: userId,
    },
    include: { category: true },
  });

  return item;
}

export async function initiateSubscriptionPayment(params: {
  userId: string;
  leisureItemId: string;
  method: 'card' | 'mobile_money' | 'paystack';
  phone?: string;
  email?: string;
}) {
  const pricing = await getPricing();
  const { userId, leisureItemId, method, phone, email } = params;

  // Vérifier que l'établissement existe et appartient à l'utilisateur (pending ou déjà publié)
  const item = await prisma.leisureItem.findFirst({ where: { id: leisureItemId, createdById: userId } });
  if (!item) throw new Error('Établissement introuvable ou accès non autorisé');

  let paymentRef: string;
  let extra: Record<string, unknown> = {};

  if (method === 'card') {
    const result = await paymentService.createStripeIntent({
      amount: pricing.establishmentAnnualFee,
      currency: pricing.currency,
      metadata: { type: 'subscription', leisureItemId, userId },
    });
    paymentRef = result.intentId;
    extra = { clientSecret: result.clientSecret };
  } else if (method === 'mobile_money') {
    const operator = phone?.startsWith('077') || phone?.startsWith('068') ? 'airtel' : 'mtn';
    const result = await paymentService.initializeMobileMoney({
      phone: phone ?? '',
      operator,
      amount: pricing.establishmentAnnualFee,
      currency: pricing.currency,
      metadata: { type: 'subscription', leisureItemId, userId },
    });
    paymentRef = result.transactionId;
    extra = { message: result.message };
  } else {
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const result = await paymentService.initializePaystack({
      email: email ?? userRecord?.email ?? '',
      amount: pricing.establishmentAnnualFee,
      currency: pricing.currency,
      metadata: { type: 'subscription', leisureItemId, userId },
    });
    paymentRef = result.reference;
    extra = { authorizationUrl: result.authorizationUrl };
  }

  return {
    paymentRef,
    amount: pricing.establishmentAnnualFee,
    currency: pricing.currency,
    method,
    simulation: true,
    ...extra,
  };
}

export async function confirmSubscriptionPayment(params: {
  paymentRef: string;
  userId: string;
  leisureItemId: string;
  method: 'card' | 'mobile_money' | 'paystack';
}) {
  const { paymentRef, userId, leisureItemId, method } = params;

  const provider = method === 'card' ? 'stripe' : method === 'paystack' ? 'paystack' : 'mobile_money';
  const ok = await paymentService.confirmPayment({ provider, paymentId: paymentRef });
  if (!ok) throw new Error('Paiement non confirmé ou invalide');

  const pricing = await getPricing();
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + pricing.subscriptionDurationDays);

  const [subscription] = await prisma.$transaction([
    prisma.establishmentSubscription.create({
      data: {
        userId,
        leisureItemId,
        startDate: now,
        endDate,
        amount: pricing.establishmentAnnualFee,
        currency: pricing.currency,
        status: 'active',
        paymentMethod: method,
        paymentRef,
      },
      include: { leisureItem: { select: { id: true, name: true } } },
    }),
    // Publier l'établissement s'il était en attente de paiement
    prisma.leisureItem.updateMany({
      where: { id: leisureItemId, status: 'pending' },
      data: { status: 'published' },
    }),
  ]);

  return subscription;
}

// ─── Paiements bon plan ───────────────────────────────────────────────────────

export async function initiateDealPayment(params: {
  userId: string;
  leisureItemId: string;
  dealData: Record<string, unknown>;
  method: 'card' | 'mobile_money' | 'paystack';
  phone?: string;
  email?: string;
}) {
  const { userId, leisureItemId, dealData, method, phone, email } = params;

  const hasActiveSub = await checkActiveSubscription(userId, leisureItemId);
  if (!hasActiveSub) throw new Error('Abonnement annuel requis et actif pour publier un bon plan');

  const pricing = await getPricing();

  let paymentRef: string;
  let extra: Record<string, unknown> = {};

  if (method === 'card') {
    const result = await paymentService.createStripeIntent({
      amount: pricing.bonplanCreationFee,
      currency: pricing.currency,
      metadata: { type: 'bonplan', leisureItemId, userId },
    });
    paymentRef = result.intentId;
    extra = { clientSecret: result.clientSecret };
  } else if (method === 'mobile_money') {
    const operator = phone?.startsWith('077') || phone?.startsWith('068') ? 'airtel' : 'mtn';
    const result = await paymentService.initializeMobileMoney({
      phone: phone ?? '',
      operator,
      amount: pricing.bonplanCreationFee,
      currency: pricing.currency,
      metadata: { type: 'bonplan', leisureItemId, userId },
    });
    paymentRef = result.transactionId;
    extra = { message: result.message };
  } else {
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const result = await paymentService.initializePaystack({
      email: email ?? userRecord?.email ?? '',
      amount: pricing.bonplanCreationFee,
      currency: pricing.currency,
      metadata: { type: 'bonplan', leisureItemId, userId },
    });
    paymentRef = result.reference;
    extra = { authorizationUrl: result.authorizationUrl };
  }

  // Enregistrer le paiement en attente avec les données du bon plan
  const dealPayment = await prisma.dealPayment.create({
    data: {
      userId,
      leisureItemId,
      amount: pricing.bonplanCreationFee,
      currency: pricing.currency,
      status: 'pending',
      paymentMethod: method,
      paymentRef,
      dealData: JSON.stringify(dealData),
    },
  });

  return {
    dealPaymentId: dealPayment.id,
    paymentRef,
    amount: pricing.bonplanCreationFee,
    currency: pricing.currency,
    method,
    simulation: true,
    ...extra,
  };
}

export async function confirmDealPayment(params: {
  paymentRef: string;
  userId: string;
}) {
  const { paymentRef, userId } = params;

  const dealPayment = await prisma.dealPayment.findFirst({
    where: { paymentRef, userId, status: 'pending' },
  });
  if (!dealPayment) throw new Error('Paiement introuvable ou déjà traité');

  const provider = dealPayment.paymentMethod === 'card' ? 'stripe'
    : dealPayment.paymentMethod === 'paystack' ? 'paystack' : 'mobile_money';

  const ok = await paymentService.confirmPayment({ provider, paymentId: paymentRef });
  if (!ok) throw new Error('Paiement non confirmé ou invalide');

  const rawDealData: Record<string, unknown> = dealPayment.dealData
    ? JSON.parse(dealPayment.dealData as string)
    : {};

  // Récupérer info établissement pour auto-remplir
  const item = await prisma.leisureItem.findUnique({ where: { id: dealPayment.leisureItemId } });

  // Créer le Deal et marquer le paiement comme réglé de façon atomique : si
  // le marquage échoue, le Deal créé doit être annulé pour éviter qu'un
  // retry sur le même paiement ne crée un Deal en double.
  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        title: String(rawDealData.title ?? ''),
        description: String(rawDealData.description ?? ''),
        category: String(rawDealData.category ?? 'general'),
        originalPrice: Number(rawDealData.originalPrice ?? 0),
        discountedPrice: Number(rawDealData.discountedPrice ?? 0),
        discount: Number(rawDealData.discount ?? 0),
        validUntil: String(rawDealData.validUntil ?? ''),
        location: String(rawDealData.location ?? item?.location ?? ''),
        image: String(rawDealData.image ?? item?.image ?? ''),
        isPopular: Boolean(rawDealData.isPopular ?? false),
        merchantName: String(rawDealData.merchantName ?? item?.name ?? ''),
        tags: String(rawDealData.tags ?? '[]'),
        availableQuantity: rawDealData.availableQuantity ? Number(rawDealData.availableQuantity) : undefined,
        maxQuantity: rawDealData.maxQuantity ? Number(rawDealData.maxQuantity) : undefined,
        contactPhone: rawDealData.contactPhone ? String(rawDealData.contactPhone) : item?.phone ?? undefined,
        contactEmail: rawDealData.contactEmail ? String(rawDealData.contactEmail) : undefined,
        contactWebsite: rawDealData.contactWebsite ? String(rawDealData.contactWebsite) : item?.website ?? undefined,
        status: 'published',
        leisureItemId: dealPayment.leisureItemId,
        createdById: userId,
      },
      include: { leisureItem: { select: { id: true, name: true, image: true, address: true, location: true, phone: true, website: true } } },
    });

    await tx.dealPayment.update({
      where: { id: dealPayment.id },
      data: { status: 'paid', dealId: created.id },
    });

    return created;
  });

  return { deal, dealPayment: { ...dealPayment, status: 'paid', dealId: deal.id } };
}
