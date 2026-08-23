import { Router } from "express";
import {
  uploadDocument,
  bulkUploadDocuments,
  assignDocument,
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

// Single upload
router.post(
  "/",
  authorize("admin", "staff_akademik", "staff_administrasi"),
  uploadPdfMemory.single("file"),
  uploadDocument
);

// Bulk upload
router.post(
  "/bulk",
  authorize("admin", "staff_akademik", "staff_administrasi"),
  uploadPdfMemory.array("files", 20),
  bulkUploadDocuments
);

// Assign document to an Academician (Admin & Staff Administrasi)
router.put(
  "/:id/assign",
  authorize("admin", "staff_administrasi"),
  assignDocument
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
