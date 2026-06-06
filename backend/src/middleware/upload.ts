import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../config/env";

const uploadRoot = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.join(process.cwd(), env.UPLOAD_DIR);

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString("hex");
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);
    cb(null, `${Date.now()}-${unique}-${safeBase}.pdf`);
  },
});

/** Accepts only PDF files (mime + extension), capped at MAX_UPLOAD_MB. */
export const uploadPdf = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
    if (isPdfMime && isPdfExt) return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

/** In-memory variant for verification uploads (file is not persisted). */
export const uploadPdfMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";
    if (isPdfMime && isPdfExt) return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

export { uploadRoot };
