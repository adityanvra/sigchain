import { Request, Response } from "express";
import fs from "fs";
import { z } from "zod";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sha256File } from "../services/hashService";
import { recordAudit } from "../services/auditService";
import { qrPngBuffer, qrDataUrl, verifyUrlFor } from "../services/qrService";
import { blockchain } from "../services/blockchainService";

const uploadMetaSchema = z.object({
  namaDokumen: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

/** Only admins see all documents; staff see their own uploads. */
function scopeFilter(req: Request) {
  return req.user!.role === "admin" ? {} : { uploader: req.user!.sub };
}

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah");

  const meta = uploadMetaSchema.parse(req.body);
  const hash = await sha256File(req.file.path);

  const doc = await DocumentModel.create({
    namaDokumen: meta.namaDokumen?.trim() || req.file.originalname,
    description: meta.description,
    filePath: req.file.path,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    hashDokumen: hash,
    uploader: req.user!.sub,
    status: "UNSIGNED",
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "UPLOAD",
    aktivitas: `Mengunggah dokumen "${doc.namaDokumen}"`,
    metadata: { documentId: String(doc._id), hash },
    req,
  });

  res.status(201).json({ success: true, document: doc });
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const filter: Record<string, unknown> = scopeFilter(req);
  if (status === "SIGNED" || status === "UNSIGNED") filter.status = status;
  if (q) filter.namaDokumen = { $regex: q, $options: "i" };

  const documents = await DocumentModel.find(filter)
    .populate("uploader", "nama email role")
    .sort({ createdAt: -1 });

  res.json({ success: true, documents });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id).populate(
    "uploader",
    "nama email role walletAddress"
  );
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (req.user!.role !== "admin" && String(doc.uploader._id) !== req.user!.sub) {
    throw ApiError.forbidden();
  }

  const signatures = await Signature.find({ documentId: doc._id })
    .populate("signer", "nama email role")
    .sort({ timestamp: -1 });

  const qr = await qrDataUrl(doc.hashDokumen);

  res.json({
    success: true,
    document: doc,
    signatures,
    qrCode: qr,
    verifyUrl: verifyUrlFor(doc.hashDokumen),
    explorer: doc.transactionHash
      ? `${blockchain.config().blockExplorer}/tx/${doc.transactionHash}`
      : null,
  });
});

export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (req.user!.role !== "admin" && String(doc.uploader) !== req.user!.sub) {
    throw ApiError.forbidden();
  }
  if (!fs.existsSync(doc.filePath)) throw ApiError.notFound("Berkas tidak tersedia di server");

  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${doc.fileName}"`);
  fs.createReadStream(doc.filePath).pipe(res);
});

export const documentQrPng = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  const png = await qrPngBuffer(doc.hashDokumen);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (req.user!.role !== "admin" && String(doc.uploader) !== req.user!.sub) {
    throw ApiError.forbidden();
  }

  if (fs.existsSync(doc.filePath)) {
    try {
      fs.unlinkSync(doc.filePath);
    } catch {
      /* ignore file removal failure */
    }
  }
  await Signature.deleteMany({ documentId: doc._id });
  await doc.deleteOne();

  await recordAudit({
    userId: req.user!.sub,
    action: "DELETE",
    aktivitas: `Menghapus dokumen "${doc.namaDokumen}"`,
    metadata: { documentId: String(doc._id) },
    req,
  });

  res.json({ success: true, message: "Dokumen dihapus" });
});
