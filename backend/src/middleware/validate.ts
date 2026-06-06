import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

/** Validates req.body against a Zod schema; replaces body with parsed output. */
export const validateBody =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
