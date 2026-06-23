import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { creatorRepository } from "../repositories/creator.repository.js";
import { authenticate, requireRole } from "../middlewares/authenticate.js";

// ── Creator Profile ─────────────────────────────────────────────────────────

export const getMyCreatorProfile = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const profile = await creatorRepository.getProfile(userId);
  if (!profile) throw new AppError("Profil créateur introuvable", StatusCodes.NOT_FOUND);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Profil récupéré", data: profile }));
});

export const createCreatorProfile = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const existing = await creatorRepository.getProfile(userId);
  if (existing) throw new AppError("Un profil créateur existe déjà", StatusCodes.CONFLICT);

  const { bio, niche, audienceSize, engagementRate, socialLinks, portfolio } = req.body as {
    bio?: string;
    niche?: string;
    audienceSize?: number;
    engagementRate?: number;
    socialLinks?: Record<string, string>;
    portfolio?: string;
  };

  const profile = await creatorRepository.createProfile({
    userId,
    bio,
    niche,
    audienceSize,
    engagementRate,
    socialLinks,
    portfolio,
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Profil créé", data: profile }));
});

export const updateCreatorProfile = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { bio, niche, audienceSize, engagementRate, socialLinks, portfolio } = req.body as {
    bio?: string;
    niche?: string;
    audienceSize?: number;
    engagementRate?: number;
    socialLinks?: Record<string, string>;
    portfolio?: string;
  };

  const profile = await creatorRepository.updateProfile(userId, {
    bio,
    niche,
    audienceSize,
    engagementRate,
    socialLinks,
    portfolio,
  });

  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Profil mis à jour", data: profile }));
});

export const deleteMyCreatorProfile = controllerWrapper(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await creatorRepository.deleteProfile(userId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Profil supprimé" }));
});

// ── Public Catalog ─────────────────────────────────────────────────────────

export const listCreators = controllerWrapper(async (req: Request, res: Response) => {
  const { niche, verified, minAudience } = req.query as Record<string, string | undefined>;
  const creators = await creatorRepository.listActive({
    niche,
    verified: verified === "true",
    minAudience: minAudience ? parseInt(minAudience, 10) : undefined,
  });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Créateurs récupérés", data: creators }));
});

export const getCreatorById = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const profile = await creatorRepository.getProfileById(id);
  if (!profile) throw new AppError("Créateur introuvable", StatusCodes.NOT_FOUND);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Créateur récupéré", data: profile }));
});

// ── Admin: manage creators ──────────────────────────────────────────────────

export const adminListCreators = controllerWrapper(async (_req: Request, res: Response) => {
  const creators = await creatorRepository.getAllForAdmin();
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Créateurs récupérés", data: creators }));
});

export const adminVerifyCreator = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { isVerified } = req.body as { isVerified: boolean };
  const profile = await creatorRepository.updateProfile(id, { isVerified });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: isVerified ? "Créateur vérifié" : "Vérification retirée", data: profile }));
});

export const adminToggleCreatorActive = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { isActive } = req.body as { isActive: boolean };
  const profile = await creatorRepository.updateProfile(id, { isActive });
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: isActive ? "Créateur activé" : "Créateur désactivé", data: profile }));
});

// ── Campaigns: Organizer CRUD ───────────────────────────────────────────────

export const createCampaign = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const campaignData = { ...req.body, organizerId } as Parameters<typeof creatorRepository.createCampaign>[0];
  const campaign = await creatorRepository.createCampaign(campaignData);
  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Campagne créée", data: campaign }));
});

export const getMyCampaigns = controllerWrapper(async (req: Request, res: Response) => {
  const organizerId = req.user!.userId;
  const campaigns = await creatorRepository.listMyCampaigns(organizerId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Campagnes récupérées", data: campaigns }));
});

export const getCampaignDetail = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const campaign = await creatorRepository.getCampaignById(id);
  if (!campaign) throw new AppError("Campagne introuvable", StatusCodes.NOT_FOUND);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Campagne récupérée", data: campaign }));
});

export const updateCampaignStatus = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body as { status: string };
  const campaign = await creatorRepository.updateCampaignStatus(id, status);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Statut mis à jour", data: campaign }));
});

export const deleteCampaign = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await creatorRepository.deleteCampaign(id);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Campagne supprimée" }));
});

// ── Applications: Creator applies to campaign ───────────────────────────────

export const applyToCampaign = controllerWrapper(async (req: Request, res: Response) => {
  const creatorProfile = await creatorRepository.getProfile(req.user!.userId);
  if (!creatorProfile) throw new AppError("Profil créateur requis pour postuler", StatusCodes.BAD_REQUEST);

  const { campaignId, message } = req.body as { campaignId: string; message?: string };
  const application = await creatorRepository.applyToCampaign({
    campaignId,
    creatorId: creatorProfile.id,
    message,
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Candidature envoyée", data: application }));
});

export const getMyApplications = controllerWrapper(async (req: Request, res: Response) => {
  const creatorProfile = await creatorRepository.getProfile(req.user!.userId);
  if (!creatorProfile) throw new AppError("Profil créateur introuvable", StatusCodes.NOT_FOUND);
  const applications = await creatorRepository.getMyApplications(creatorProfile.id);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Candidatures récupérées", data: applications }));
});

export const getCampaignApplications = controllerWrapper(async (req: Request, res: Response) => {
  const campaignId = String(req.params.campaignId);
  const applications = await creatorRepository.getApplicationsForCampaign(campaignId);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Candidatures récupérées", data: applications }));
});

export const reviewApplication = controllerWrapper(async (req: Request, res: Response) => {
  const applicationId = String(req.params.applicationId);
  const { status } = req.body as { status: string };
  const accepted = await creatorRepository.updateApplicationStatus(applicationId, status);

  res.status(StatusCodes.OK).json(jsonResponse({
    status: "success",
    message: status === "accepted" ? "Candidature acceptée" : "Candidature refusée",
    data: accepted,
  }));
});

// ── Collaborations ──────────────────────────────────────────────────────────

export const createCollaboration = controllerWrapper(async (req: Request, res: Response) => {
  const { campaignId, creatorId, agreedFee, currency, deliverables } = req.body as {
    campaignId: string;
    creatorId: string;
    agreedFee: number;
    currency?: string;
    deliverables?: string;
  };

  const collab = await creatorRepository.createCollaboration({
    campaignId,
    creatorId,
    organizerId: req.user!.userId,
    agreedFee,
    currency,
    deliverables,
  });

  res.status(StatusCodes.CREATED).json(jsonResponse({ status: "success", message: "Collaboration créée", data: collab }));
});

export const getMyCollaborations = controllerWrapper(async (req: Request, res: Response) => {
  const creatorProfile = await creatorRepository.getProfile(req.user!.userId);
  if (!creatorProfile) throw new AppError("Profil créateur introuvable", StatusCodes.NOT_FOUND);
  const collabs = await creatorRepository.getMyCollaborations(creatorProfile.id);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Collaborations récupérées", data: collabs }));
});

export const updateCollaborationStatus = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status, rating, review } = req.body as { status: string; rating?: number; review?: string };
  const collab = await creatorRepository.updateCollaborationStatus(id, status, rating, review);
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Statut mis à jour", data: collab }));
});

export const rateCollaboration = controllerWrapper(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { rating, review } = req.body as { rating: number; review: string };

  if (rating < 1 || rating > 5) {
    throw new AppError("La note doit être entre 1 et 5", StatusCodes.BAD_REQUEST);
  }

  const result = await creatorRepository.rateCollaboration(id, rating, review);
  if (!result) throw new AppError("Collaboration introuvable", StatusCodes.NOT_FOUND);

  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Collaboration notée", data: result }));
});

// ── Admin: stars / overview ─────────────────────────────────────────────────

export const adminGetAllStars = controllerWrapper(async (_req: Request, res: Response) => {
  const stars = await creatorRepository.getStarsForAdmin();
  res.status(StatusCodes.OK).json(jsonResponse({ status: "success", message: "Collaborations récupérées", data: stars }));
});
