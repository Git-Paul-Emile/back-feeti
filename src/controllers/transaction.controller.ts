// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { transactionService, lireTauxConfigures } from "../services/transaction.service.js";
import { transactionRepository } from "../repositories/transaction.repository.js";
import {
  calculerRepartitionFinanciere,
  verifierCohérenceRepartition,
  formatMontant,
  validerMontantCentimes,
} from "../utils/financial.js";

const controllerWrapper = async (fn: () => Promise<unknown>, res: Response) => {
  try {
    const result = await fn();
    return result;
  } catch (err) {
    throw err;
  }
};

export const transactionController = {

  // GET /api/transactions — Liste des transactions (avec filtres)
  async lister(req: Request, res: Response) {
    const { page, limit, status, eventId, dateFrom, dateTo, devise } = req.query;

    const transactions = await transactionService.listerTransactions(
      {
        status: status as never,
        eventId: eventId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        devise: devise as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      },
      req.user!.userId,
      req.user!.role
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      ...transactions,
    });
  },

  // GET /api/transactions/:id
  async getById(req: Request, res: Response) {
    const transaction = await transactionService.getTransactionById(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    res.status(StatusCodes.OK).json({ status: "success", data: transaction });
  },

  // POST /api/transactions — Créer une transaction (après paiement validé)
  async creer(req: Request, res: Response) {
    const {
      idempotencyKey,
      eventId,
      organizerId,
      ticketId,
      prixTTCCentimes,
      devise,
      paymentMethod,
      paymentProviderTransactionId,
      metadata,
    } = req.body;

    // Validation du montant
    const validation = validerMontantCentimes(prixTTCCentimes);
    if (!validation.valid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Montant invalide",
        errors: validation.errors,
      });
      return;
    }

    const transaction = await transactionService.creerTransaction({
      idempotencyKey,
      eventId,
      organizerId,
      buyerId: req.user!.userId,
      ticketId,
      prixTTCCentimes,
      devise: devise ?? "XOF",
      paymentMethod,
      metadata,
      actorIp: req.ip,
      actorUserAgent: req.headers["user-agent"],
    });

    // Si une référence provider est fournie, confirmer le paiement
    if (paymentProviderTransactionId && transaction.status === "pending") {
      await transactionService.confirmerPaiement(
        transaction.id,
        paymentProviderTransactionId,
        { id: req.user!.userId, role: req.user!.role }
      );
    }

    res.status(StatusCodes.CREATED).json({ status: "success", data: transaction });
  },

  // PATCH /api/transactions/:id/status — Changer le statut (admin)
  async changerStatut(req: Request, res: Response) {
    const { newStatus, reason, refundAmount, refundReason, paymentProviderTransactionId } = req.body;

    const updated = await transactionService.changerStatut(
      req.params.id,
      newStatus,
      {
        id: req.user!.userId,
        role: req.user!.role,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      { reason, refundAmount, refundReason, paymentProviderTransactionId }
    );

    res.status(StatusCodes.OK).json({ status: "success", data: updated });
  },

  // POST /api/transactions/:id/complete
  async completer(req: Request, res: Response) {
    const updated = await transactionService.completerTransaction(req.params.id, {
      id: req.user!.userId,
      role: req.user!.role,
      ip: req.ip ?? undefined,
      userAgent: req.headers["user-agent"] as string | undefined,
    });
    res.status(StatusCodes.OK).json({ status: "success", data: updated });
  },

  // POST /api/transactions/:id/refund
  async rembourser(req: Request, res: Response) {
    const { montantRemboursement, raison } = req.body;

    if (!raison) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "La raison du remboursement est obligatoire",
      });
      return;
    }

    const updated = await transactionService.initierRemboursement(
      req.params.id,
      montantRemboursement,
      raison,
      {
        id: req.user!.userId,
        role: req.user!.role,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      }
    );
    res.status(StatusCodes.OK).json({ status: "success", data: updated });
  },

  // GET /api/transactions/simulate — Simuler une répartition
  async simuler(req: Request, res: Response) {
    const prixTTC = parseInt(req.query.prixTTC as string);

    const validation = validerMontantCentimes(prixTTC);
    if (!validation.valid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Montant invalide",
        errors: validation.errors,
      });
      return;
    }

    const { tauxTVA_bp, tauxCommission_bp } = await lireTauxConfigures();
    const repartition = calculerRepartitionFinanciere(prixTTC, tauxTVA_bp, tauxCommission_bp);
    const devise = (req.query.devise as string) ?? "XOF";

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        ...repartition,
        formatted: {
          prixTTC: formatMontant(repartition.prixTTC, devise),
          prixHT: formatMontant(repartition.prixHT, devise),
          tva: formatMontant(repartition.tva, devise),
          commission: formatMontant(repartition.commission, devise),
          netOrganisateur: formatMontant(repartition.netOrganisateur, devise),
        },
        coherence: verifierCohérenceRepartition(repartition),
      },
    });
  },

  // GET /api/transactions/export/csv
  async exportCSV(req: Request, res: Response) {
    const { dateFrom, dateTo, status } = req.query;
    const isAdmin = ["admin", "super_admin"].includes(req.user!.role);

    const { reportingService } = await import("../services/reporting.service.js");

    const csv = await reportingService.exportTransactionsCSV({
      organizerId: isAdmin ? undefined : req.user!.userId,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      status: status as string,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.status(StatusCodes.OK).send("\uFEFF" + csv); // BOM UTF-8 pour Excel
  },
};
