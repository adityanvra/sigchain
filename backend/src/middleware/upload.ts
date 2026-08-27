import multer from "multer";
import path from "path";
import { env } from "../config/env";

const pdfFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
  if (isPdfMime && isPdfExt) return cb(null, true);
  cb(new Error("Only PDF files are allowed"));
};

const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp"];
  const isMime = allowed.includes(file.mimetype);
  const isExt = allowedExt.includes(path.extname(file.originalname).toLowerCase());
  if (isMime && isExt) return cb(null, true);
  cb(new Error("Only PNG/JPEG image files are allowed for signatures"));
};

/**
 * In-memory PDF upload. Capped at MAX_UPLOAD_MB (kept < 16 MB due to MongoDB
 * document size limit).
 */
export const uploadPdfMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024) },
  fileFilter: pdfFilter,
});

/**
 * In-memory image upload for academic signature PNG/JPEG.
 * Capped at 2 MB — signatures are small images.
 */
export const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: imageFilter,
});
