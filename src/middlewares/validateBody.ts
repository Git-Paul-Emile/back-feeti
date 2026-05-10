import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

type Schema = {
  safeParse: (data: unknown) => { success: boolean; data?: any; error?: any };
};

export const validateBody = (schema: Schema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue: any) => {
        const field = issue.path[0] as string;
        if (field && !errors[field]) {
          errors[field] = issue.message;
        }
      });
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        status: "fail",
        message: "Données invalides",
        errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
