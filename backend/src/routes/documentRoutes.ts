import { Router } from "express";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  documentQrPng,
  deleteDocument,
} from "../controllers/documentController";
import { prepareSign, confirmSign } from "../controllers/signatureController";
import { authenticate, authorize } from "../middleware/auth";
import { uploadPdfMemory } from "../middleware/upload";

const router = Router();

router.use(authenticate);

// Upload allowed for staff_akademik & staff_administrasi (and admin).
router.post(
  "/",
  authorize("admin", "staff_akademik", "staff_administrasi"),
  uploadPdfMemory.single("file"),
  uploadDocument
);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.get("/:id/file", downloadDocument);
router.get("/:id/qrcode", documentQrPng);
router.delete("/:id", deleteDocument);

// Signing — only admin & staff_akademik may sign.
router.post("/:id/sign/prepare", authorize("admin", "staff_akademik"), prepareSign);
router.post("/:id/sign/confirm", authorize("admin", "staff_akademik"), confirmSign);

export default router;
