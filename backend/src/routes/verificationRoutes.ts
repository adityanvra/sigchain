import { Router } from "express";
import { verifyByHash, verifyByUpload, verifyByDocumentId } from "../controllers/verificationController";
import { authenticate } from "../middleware/auth";
import { uploadPdfMemory } from "../middleware/upload";

const router = Router();

// Verify by documentId (used by QR codes that link to /verify/:documentId) — public
router.get("/document/:id", verifyByDocumentId);

// Verify by SHA-256 hash — public
router.get("/hash/:hash", verifyByHash);

// Legacy route: /verify/:hash (keep for backwards compat with old QR codes)
router.get("/:hash", verifyByHash);

// Verify by re-uploading PDF — optionally authenticated for audit trail
router.post("/", uploadPdfMemory.single("file"), verifyByUpload);

export default router;
