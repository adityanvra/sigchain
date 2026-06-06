import multer from "multer";
import path from "path";
import { env } from "../config/env";

const pdfFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
  if (isPdfMime && isPdfExt) return cb(null, true);
  cb(new Error("Only PDF files are allowed"));
};

/**
 * In-memory upload. The file buffer is persisted to MongoDB by the controller,
 * so the app works on serverless / ephemeral filesystems (Vercel, etc.).
 * Capped at MAX_UPLOAD_MB (kept <16 MB due to MongoDB document size limit).
 */
export const uploadPdfMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: pdfFilter,
});
