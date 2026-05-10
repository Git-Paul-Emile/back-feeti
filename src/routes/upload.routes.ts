import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticate } from "../middlewares/authenticate.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";
import { jsonResponse } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";

// Configure Cloudinary de façon paresseuse (après chargement de dotenv)
function configureCloudinary() {
  const cloudUrl = process.env.CLOUDINARY_URL;
  if (!cloudUrl) throw new AppError("CLOUDINARY_URL manquant dans les variables d'environnement", StatusCodes.INTERNAL_SERVER_ERROR);
  // Format: cloudinary://api_key:api_secret@cloud_name
  const match = cloudUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (!match) throw new AppError("Format CLOUDINARY_URL invalide", StatusCodes.INTERNAL_SERVER_ERROR);
  cloudinary.config({
    api_key: match[1],
    api_secret: match[2],
    cloud_name: match[3],
  });
}

// Multer en mémoire (pas de disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Seules les images sont acceptées"));
  },
});

function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload échoué"));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

const router = Router();

router.post(
  "/image",
  authenticate,
  upload.single("image"),
  controllerWrapper(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError("Aucun fichier reçu", StatusCodes.BAD_REQUEST);
    }
    const url = await uploadToCloudinary(req.file.buffer, "feeti/events");
    res.status(StatusCodes.OK).json(
      jsonResponse({ status: "success", message: "Image uploadée", data: { url } })
    );
  })
);

export default router;
