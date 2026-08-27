import { Request, Response } from "express";
import { AcademicSignature } from "../models/AcademicSignature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditService";

/** GET /academic-signatures/my — returns the active signature for the current user (no image data) */
export const getMySignature = asyncHandler(async (req: Request, res: Response) => {
  const sig = await AcademicSignature.findOne({
    academicId: req.user!.sub,
    active: true,
  }).select("-imageData");

  res.json({ success: true, signature: sig || null });
});

/** GET /academic-signatures/my/image — serves the raw PNG/JPEG bytes */
export const getMySignatureImage = asyncHandler(async (req: Request, res: Response) => {
  const sig = await AcademicSignature.findOne({
    academicId: req.user!.sub,
    active: true,
  }).select("+imageData");

  if (!sig || !sig.imageData) throw ApiError.notFound("Tanda tangan tidak ditemukan");

  res.setHeader("Content-Type", sig.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${sig.fileName}"`);
  res.send(sig.imageData);
});

/** GET /academic-signatures/:id/image — serves the image for a specific signature (by owner or admin) */
export const getSignatureImage = asyncHandler(async (req: Request, res: Response) => {
  const sig = await AcademicSignature.findById(req.params.id).select("+imageData");
  if (!sig || !sig.imageData) throw ApiError.notFound("Tanda tangan tidak ditemukan");

  const isOwner = String(sig.academicId) === req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("Tidak ada izin mengakses gambar tanda tangan ini");
  }

  res.setHeader("Content-Type", sig.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${sig.fileName}"`);
  res.send(sig.imageData);
});

/** POST /academic-signatures — upload new signature image (replaces existing active) */
export const uploadSignature = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("Gambar tanda tangan wajib diunggah");

  // Deactivate any existing active signature for this user
  await AcademicSignature.updateMany(
    { academicId: req.user!.sub, active: true },
    { $set: { active: false } }
  );

  const sig = await AcademicSignature.create({
    academicId: req.user!.sub,
    imageData: req.file.buffer,
    mimeType: req.file.mimetype,
    fileName: req.file.originalname,
    active: true,
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "SIGNATURE_UPLOAD",
    aktivitas: "Mengunggah gambar tanda tangan baru",
    metadata: { signatureId: String(sig._id) },
    req,
  });

  // Return without image data
  const { imageData: _omit, ...rest } = sig.toObject();
  res.status(201).json({ success: true, signature: rest });
});

/** DELETE /academic-signatures/:id — delete a specific signature */
export const deleteSignature = asyncHandler(async (req: Request, res: Response) => {
  const sig = await AcademicSignature.findById(req.params.id);
  if (!sig) throw ApiError.notFound("Tanda tangan tidak ditemukan");

  const isOwner = String(sig.academicId) === req.user!.sub;
  const isAdmin = req.user!.role === "admin";
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden("Tidak ada izin menghapus tanda tangan ini");
  }

  await sig.deleteOne();

  await recordAudit({
    userId: req.user!.sub,
    action: "SIGNATURE_DELETE",
    aktivitas: "Menghapus gambar tanda tangan",
    metadata: { signatureId: String(sig._id) },
    req,
  });

  res.json({ success: true, message: "Tanda tangan dihapus" });
});
