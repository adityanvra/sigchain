import { Router } from "express";
import {
  uploadDocument,
  bulkUploadDocuments,
  assignDocument,
  applySignature,
  listDocuments,
  getDocument,
  downloadDocument,
  documentQrPng,
  deleteDocument,
} from "../controllers/documentController";
import { prepareSign, confirmSign } from "../controllers/signatureController";
import { authenticate, authorize } from "../middleware/auth";
import { uploadPdfMemory, validateUploadedPdfs } from "../middleware/upload";

import { configureWorkflow, submitDocument, reviewDocument, reviseDocument, prepareLetter } from "../controllers/workflowController";

const router = Router();

router.use(authenticate);

// Single upload
router.post(
  "/",
  authorize("admin", "staff_akademik", "staff_administrasi", "mahasiswa"),
  uploadPdfMemory.single("file"),
  validateUploadedPdfs,
  uploadDocument
);

// Bulk upload
router.post(
  "/bulk",
  authorize("admin", "staff_akademik", "staff_administrasi", "mahasiswa"),
  uploadPdfMemory.array("files", 20),
  validateUploadedPdfs,
  bulkUploadDocuments
);

// Assign document to an Akademisi (Admin & Staff Administrasi)
router.put(
  "/:id/assign",
  authorize("admin", "staff_administrasi"),
  assignDocument
);

// Apply visual signature → generate PDF final → compute hash
// Only Akademisi who is assigned (or admin) can apply
router.post(
  "/:id/apply-signature",
  authorize("admin", "staff_akademik", "staff_administrasi"),
  applySignature
);

router.put("/:id/workflow", configureWorkflow);
router.post("/:id/submit", submitDocument);
router.post("/:id/review", reviewDocument);
router.post("/:id/revise", uploadPdfMemory.single("file"), validateUploadedPdfs, reviseDocument);
router.post("/:id/prepare-letter", uploadPdfMemory.single("file"), validateUploadedPdfs, prepareLetter);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.get("/:id/file", downloadDocument);
router.get("/:id/qrcode", documentQrPng);
router.delete("/:id", deleteDocument);

// Signing — prepare (get hash) & confirm (record blockchain tx)
router.post("/:id/sign/prepare", authorize("admin", "staff_akademik", "staff_administrasi"), prepareSign);
router.post("/:id/sign/confirm", authorize("admin", "staff_akademik", "staff_administrasi"), confirmSign);

export default router;
