import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

// GET /api/countries — public
export const getAllCountries = controllerWrapper(async (_req: Request, res: Response) => {
  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Pays récupérés", data: countries }));
});

// POST /api/countries — admin only
export const createCountry = controllerWrapper(async (req: Request, res: Response) => {
  const { code, name, flag } = req.body as { code: string; name: string; flag?: string };
  if (!code || !name) throw new AppError("Code et nom requis", StatusCodes.BAD_REQUEST);

  const existing = await prisma.country.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) throw new AppError("Ce pays existe déjà", StatusCodes.CONFLICT);

  const country = await prisma.country.create({
    data: { code: code.toUpperCase(), name, flag: flag ?? "" },
  });
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Pays créé", data: country }));
});

// PATCH /api/countries/:code — admin only
export const updateCountry = controllerWrapper(async (req: Request, res: Response) => {
  const code = String(req.params.code).toUpperCase();
  const { name, flag, isActive } = req.body as { name?: string; flag?: string; isActive?: boolean };

  const country = await prisma.country.findUnique({ where: { code } });
  if (!country) throw new AppError("Pays introuvable", StatusCodes.NOT_FOUND);

  const updated = await prisma.country.update({
    where: { code },
    data: { ...(name !== undefined && { name }), ...(flag !== undefined && { flag }), ...(isActive !== undefined && { isActive }) },
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Pays mis à jour", data: updated }));
});

// DELETE /api/countries/:code — admin only
export const deleteCountry = controllerWrapper(async (req: Request, res: Response) => {
  const code = String(req.params.code).toUpperCase();
  const country = await prisma.country.findUnique({ where: { code } });
  if (!country) throw new AppError("Pays introuvable", StatusCodes.NOT_FOUND);

  // Detach events instead of blocking deletion
  await prisma.event.updateMany({ where: { countryCode: code }, data: { countryCode: null } });
  await prisma.country.delete({ where: { code } });

  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Pays supprimé" }));
});
