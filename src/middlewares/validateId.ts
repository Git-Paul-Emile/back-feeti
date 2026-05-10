// middlewares/validateId.ts
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";


export const validateId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") {
    throw new AppError("ID invalide", StatusCodes.BAD_REQUEST);
  }
  next();
};
