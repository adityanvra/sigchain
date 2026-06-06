import { Router } from "express";
import { verifyByHash, verifyByUpload } from "../controllers/verificationController";
import { uploadPdfMemory } from "../middleware/upload";

const router = Router();

// Public verification (used by QR codes) — no authentication required.
router.get("/:hash", verifyByHash);
router.post("/", uploadPdfMemory.single("file"), verifyByUpload);

export default router;
