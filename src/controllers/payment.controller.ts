/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CONTROLLER PAIEMENT
 *  Orchestre : simulation paiement → achat billet → email confirmation
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import QRCode from "qrcode";
import { paymentService } from "../services/payment.service.js";
import { ticketService } from "../services/ticket.service.js";
import { addEmailJob } from "../queues/email.queue.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { jsonResponse } from "../utils/response.js";
import { AppError } from "../utils/AppError.js";

// ─── Stripe : créer une intention de paiement ────────────────────────

export const createStripeIntent = controllerWrapper(async (req: Request, res: Response) => {
  const { amount, currency = "FCFA", metadata } = req.body;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    throw new AppError("Montant invalide", StatusCodes.BAD_REQUEST);
  }

  const result = await paymentService.createStripeIntent({ amount, currency, metadata });

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Intention de paiement créée",
      data: {
        client_secret: result.clientSecret,
        intent_id: result.intentId,
        // NOTE : En mode simulation, signaler clairement au frontend
        simulation: true,
      },
    })
  );
});

// ─── Mobile Money : initialiser ──────────────────────────────────────

export const initializeMobileMoney = controllerWrapper(async (req: Request, res: Response) => {
  const { amount, currency = "FCFA", phone, provider, metadata } = req.body;

  if (!phone) throw new AppError("Numéro de téléphone requis", StatusCodes.BAD_REQUEST);
  if (!["mtn", "orange", "airtel"].includes(provider)) {
    throw new AppError("Opérateur invalide (mtn | orange | airtel)", StatusCodes.BAD_REQUEST);
  }

  const result = await paymentService.initializeMobileMoney({
    phone,
    operator: provider,
    amount,
    currency,
    metadata,
  });

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: result.message,
      data: { transaction_id: result.transactionId, simulation: true },
    })
  );
});

// ─── Mobile Money : statut ───────────────────────────────────────────

export const getMobileMoneyStatus = controllerWrapper(async (req: Request, res: Response) => {
  const txId = String(req.params["txId"]);
  const result = await paymentService.getMobileMoneyStatus(txId);

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: result.message, data: { status: result.status } })
  );
});

// ─── Paystack : initialiser ──────────────────────────────────────────

export const initializePaystack = controllerWrapper(async (req: Request, res: Response) => {
  const { amount, currency = "FCFA", email, metadata } = req.body;

  if (!email) throw new AppError("Email requis pour Paystack", StatusCodes.BAD_REQUEST);

  const result = await paymentService.initializePaystack({ email, amount, currency, metadata });

  res.status(StatusCodes.OK).json(
    jsonResponse({
      status: "success",
      message: "Paiement Paystack initialisé",
      data: {
        reference: result.reference,
        authorization_url: result.authorizationUrl,
        simulation: true,
      },
    })
  );
});

// ─── Confirmer paiement + créer billets + envoyer email ──────────────

export const confirmPaymentAndPurchase = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const {
    eventId,
    holderName,
    holderEmail,
    holderPhone,
    items,           // [{ category, quantity, price }]
    delivery,        // optionnel
    paymentProvider, // "stripe" | "mobile_money" | "paystack"
    paymentId,       // clientSecret (stripe) | transactionId (mobile) | reference (paystack)
  } = req.body;

  // Validation basique
  if (!eventId) throw new AppError("eventId requis", StatusCodes.BAD_REQUEST);
  if (!holderName || !holderEmail) throw new AppError("Nom et email du porteur requis", StatusCodes.BAD_REQUEST);
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Au moins un article requis", StatusCodes.BAD_REQUEST);
  }

  // 1. Vérifier le paiement (simulation : toujours OK si l'ID existe)
  if (paymentProvider && paymentId) {
    const isValid = await paymentService.confirmPayment({
      provider: paymentProvider,
      paymentId,
    });
    if (!isValid) {
      throw new AppError("Paiement non confirmé ou invalide", StatusCodes.PAYMENT_REQUIRED);
    }
  }

  // 2. Créer les billets en base
  const purchaseResult = await ticketService.purchaseTickets({
    eventId,
    userId,
    holderName,
    holderEmail,
    items,
    delivery,
  });

  // 3. Générer les QR codes PNG (base64 data URL) pour chaque billet
  const ticketsWithQR = await Promise.all(
    purchaseResult.tickets.map(async (ticket: any) => {
      let qrDataUrl: string | undefined;
      try {
        qrDataUrl = await QRCode.toDataURL(ticket.qrData, {
          width: 300,
          margin: 2,
          color: { dark: "#111827", light: "#ffffff" },
        });
      } catch {
        // QR generation silently fails — ticket still created
      }
      return { ...ticket, qrDataUrl };
    })
  );

  // 4. Envoyer email de confirmation (non bloquant)
  const totalAmount = items.reduce(
    (sum: number, item: { quantity: number; price: number }) => sum + item.quantity * item.price,
    0
  );

  // Email sans QR code dans le corps — le PDF est téléchargeable depuis la plateforme
  addEmailJob({
    type: "ticket-confirmation",
    to: holderEmail,
    data: {
      holderName,
      eventTitle: ticketsWithQR[0]?.event?.title ?? "Événement",
      eventDate: ticketsWithQR[0]?.event?.date ?? "",
      eventTime: ticketsWithQR[0]?.event?.time ?? "",
      eventLocation: ticketsWithQR[0]?.event?.location ?? "",
      orderId: purchaseResult.orderId,
      tickets: ticketsWithQR.map((t: any) => ({
        id: t.id,
        category: t.category,
        price: t.price,
        currency: t.currency,
        // qrDataUrl intentionnellement omis : QR uniquement dans le PDF téléchargeable
      })),
      totalAmount,
      currency: ticketsWithQR[0]?.currency ?? "FCFA",
    },
  }).catch(() => {});

  res.status(StatusCodes.CREATED).json(
    jsonResponse({
      status: "success",
      message: "Paiement confirmé et billets créés",
      data: {
        orderId: purchaseResult.orderId,
        tickets: ticketsWithQR,
        deliveryFee: purchaseResult.deliveryFee,
        emailSent: true,
      },
    })
  );
});
