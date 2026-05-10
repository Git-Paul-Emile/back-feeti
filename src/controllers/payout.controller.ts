// @ts-nocheck
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { payoutService } from "../services/payout.service.js";

export const payoutController = {

  // GET /api/payouts
  async lister(req: Request, res: Response) {
    const { page, limit, statut, dateFrom, dateTo } = req.query;

    const result = await payoutService.listerPayouts(
      {
        statut: statut as never,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      },
      req.user!.userId,
      req.user!.role
    );

    res.status(StatusCodes.OK).json({ status: "success", ...result });
  },

  // GET /api/payouts/:id
  async getById(req: Request, res: Response) {
    const payout = await payoutService.getPayoutById(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    res.status(StatusCodes.OK).json({ status: "success", data: payout });
  },

  // POST /api/payouts — Initier (admin uniquement)
  async initier(req: Request, res: Response) {
    const { organizerId, transactionIds, methodePaiement, referenceBancaire, notes } = req.body;

    if (!organizerId || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "organizerId et transactionIds[] sont requis",
      });
      return;
    }

    const result = await payoutService.initierPayout({
      organizerId,
      transactionIds,
      methodePaiement: methodePaiement ?? "virement",
      referenceBancaire,
      notes,
      adminId: req.user!.userId,
      adminRole: req.user!.role,
      adminIp: req.ip,
      adminUserAgent: req.headers["user-agent"],
    });

    res.status(StatusCodes.CREATED).json({
      status: "success",
      data: result.payout,
      requiresDoubleValidation: result.requiresDoubleValidation,
      message: result.requiresDoubleValidation
        ? `Double validation requise (montant ≥ seuil ${result.threshold} centimes)`
        : "Payout initié — en attente d'approbation",
    });
  },

  // POST /api/payouts/:id/approve
  async approuver(req: Request, res: Response) {
    const payout = await payoutService.approuverPayout(req.params.id, {
      id: req.user!.userId,
      role: req.user!.role,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: payout,
      message: "Payout approuvé — prêt pour exécution",
    });
  },

  // POST /api/payouts/:id/execute
  async executer(req: Request, res: Response) {
    const { referenceBancaire, attachmentUrl } = req.body;

    const result = await payoutService.executerPayout(
      req.params.id,
      { id: req.user!.userId, role: req.user!.role, ip: req.ip },
      referenceBancaire,
      attachmentUrl
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      data: result,
      message: "Payout en cours de traitement",
    });
  },

  // POST /api/payouts/:id/confirm
  async confirmer(req: Request, res: Response) {
    const payout = await payoutService.confirmerPayout(req.params.id, {
      id: req.user!.userId,
      role: req.user!.role,
      ip: req.ip,
    });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: payout,
      message: "Payout confirmé — fonds reçus par l'organisateur",
    });
  },

  // DELETE /api/payouts/:id — Annuler
  async annuler(req: Request, res: Response) {
    const { raison } = req.body;

    if (!raison) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "La raison d'annulation est obligatoire",
      });
      return;
    }

    const payout = await payoutService.annulerPayout(req.params.id, raison, {
      id: req.user!.userId,
      role: req.user!.role,
      ip: req.ip,
    });

    res.status(StatusCodes.OK).json({ status: "success", data: payout });
  },
};
