import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Malformed JSON body (express.json parse error)
  const parseErr = err as { type?: string; status?: number };
  if (parseErr?.type === "entity.parse.failed" || (err instanceof SyntaxError && parseErr.status === 400)) {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  // Multer upload errors (size limit, file filter, etc.)
  const multerLike = err as { name?: string; message?: string };
  if (multerLike?.name === "MulterError" || multerLike?.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, message: multerLike.message || "Upload error" });
  }

  // Mongoose duplicate key
  const anyErr = err as { code?: number; name?: string; message?: string };
  if (anyErr?.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate value", details: anyErr });
  }
  if (anyErr?.name === "ValidationError") {
    return res.status(400).json({ success: false, message: anyErr.message });
  }

  console.error("[error]", err);
  res.status(500).json({ success: false, message: "Internal server error" });
}
