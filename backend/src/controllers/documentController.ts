import { Request, Response } from "express";
import { z } from "zod";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sha256Buffer } from "../services/hashService";
import { recordAudit } from "../services/auditService";
import { qrPngBuffer, qrDataUrl, verifyUrlFor } from "../services/qrService";
import { blockchain } from "../services/blockchainService";
import { Types } from "mongoose";

const uploadMetaSchema = z.object({
  namaDokumen: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  assignedTo: z.string().optional().nullable(),
});

const assignSchema = z.object({
  assignedTo: z.string().nullable().optional(),
});

/**
 * Scope rules:
 * - Admin sees all documents.
 * - Akademisi (staff_akademik) sees documents they uploaded OR documents assigned to them.
 * - Staff Administrasi sees documents they uploaded.
 */
function scopeFilter(req: Request) {
  if (req.user!.role === "admin") return {};
  if (req.user!.role === "staff_akademik") {
    return {
      $or: [
        { uploader: req.user!.sub },
        { assignedTo: req.user!.sub },
      ],
    };
  }
  return { uploader: req.user!.sub };
}

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah");

  const meta = uploadMetaSchema.parse(req.body);
  const buffer = req.file.buffer;
  const hash = sha256Buffer(buffer);

  let targetAssigneeId = null;
  let targetAssignee = null;
  if (meta.assignedTo) {
    targetAssignee = await User.findById(meta.assignedTo);
    if (!targetAssignee || targetAssignee.role !== "staff_akademik") {
      throw ApiError.badRequest("Akademisi yang ditugaskan tidak valid");
    }
    targetAssigneeId = targetAssignee._id;
  }

  const doc = await DocumentModel.create({
    namaDokumen: meta.namaDokumen?.trim() || req.file.originalname,
    description: meta.description,
    fileData: buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    hashDokumen: hash,
    uploader: req.user!.sub,
    assignedTo: targetAssigneeId,
    status: "UNSIGNED",
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "UPLOAD",
    aktivitas: targetAssignee
      ? `Mengunggah dokumen "${doc.namaDokumen}" & menugaskan ke ${targetAssignee.nama}`
      : `Mengunggah dokumen "${doc.namaDokumen}"`,
    metadata: {
      documentId: String(doc._id),
      hash,
      assignedTo: targetAssignee ? String(targetAssignee._id) : null,
    },
    req,
  });

  const createdDoc = await DocumentModel.findById(doc._id)
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");

  res.status(201).json({ success: true, document: createdDoc });
});

export const bulkUploadDocuments = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw ApiError.badRequest("Tidak ada berkas PDF yang diunggah");
  }

  let assignments: Record<string, { namaDokumen?: string; description?: string; assignedTo?: string }> = {};
  if (req.body.assignments) {
    try {
      assignments = typeof req.body.assignments === "string" ? JSON.parse(req.body.assignments) : req.body.assignments;
    } catch {
      // fallback to empty if parse fails
    }
  }

  const defaultAssignedTo = req.body.defaultAssignedTo || null;
  let defaultAssignee = null;
  if (defaultAssignedTo) {
    defaultAssignee = await User.findById(defaultAssignedTo);
    if (!defaultAssignee || defaultAssignee.role !== "staff_akademik") {
      throw ApiError.badRequest("Akademisi default yang ditugaskan tidak valid");
    }
  }

  const createdDocs = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileKey = file.originalname;
    const fileMeta = assignments[fileKey] || assignments[String(i)] || {};

    let targetAssigneeId = defaultAssignee ? defaultAssignee._id : null;
    if (fileMeta.assignedTo) {
      const user = await User.findById(fileMeta.assignedTo);
      if (user && user.role === "staff_akademik") {
        targetAssigneeId = user._id;
      }
    } else if (fileMeta.assignedTo === "") {
      targetAssigneeId = null;
    }

    const buffer = file.buffer;
    const hash = sha256Buffer(buffer);

    const doc = await DocumentModel.create({
      namaDokumen: fileMeta.namaDokumen?.trim() || file.originalname.replace(/\.pdf$/i, ""),
      description: fileMeta.description || "",
      fileData: buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      hashDokumen: hash,
      uploader: req.user!.sub,
      assignedTo: targetAssigneeId,
      status: "UNSIGNED",
    });

    createdDocs.push(doc);
  }

  await recordAudit({
    userId: req.user!.sub,
    action: "BULK_UPLOAD",
    aktivitas: `Mengunggah ${createdDocs.length} dokumen secara massal`,
    metadata: {
      count: createdDocs.length,
      documentIds: createdDocs.map((d) => String(d._id)),
    },
    req,
  });

  const populatedDocs = await DocumentModel.find({
    _id: { $in: createdDocs.map((d) => d._id) },
  })
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress")
    .sort({ createdAt: -1 });

  res.status(201).json({ success: true, count: populatedDocs.length, documents: populatedDocs });
});

export const assignDocument = asyncHandler(async (req: Request, res: Response) => {
  const { assignedTo } = assignSchema.parse(req.body);
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  if (doc.status === "SIGNED") {
    throw ApiError.conflict("Dokumen yang sudah ditandatangani tidak dapat diubah penugasannya");
  }

  const isAdmin = req.user!.role === "admin";
  const isUploader = String(doc.uploader) === req.user!.sub;
  if (!isAdmin && !isUploader) {
    throw ApiError.forbidden("Hanya pengunggah atau administrator yang dapat mengubah penugasan dokumen ini");
  }

  let targetUser = null;
  if (assignedTo) {
    targetUser = await User.findById(assignedTo);
    if (!targetUser || targetUser.role !== "staff_akademik") {
      throw ApiError.badRequest("Akademisi yang dipilih tidak valid");
    }
  }

  doc.assignedTo = targetUser ? targetUser._id : (null as unknown as Types.ObjectId);
  await doc.save();

  await recordAudit({
    userId: req.user!.sub,
    action: "ASSIGN",
    aktivitas: targetUser
      ? `Menugaskan dokumen "${doc.namaDokumen}" kepada ${targetUser.nama}`
      : `Membatalkan penugasan dokumen "${doc.namaDokumen}"`,
    metadata: {
      documentId: String(doc._id),
      assignedTo: targetUser ? String(targetUser._id) : null,
      assigneeName: targetUser?.nama || null,
    },
    req,
  });

  const updatedDoc = await DocumentModel.findById(doc._id)
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");

  res.json({ success: true, document: updatedDoc });
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const filter: Record<string, unknown> = scopeFilter(req);
  if (status === "SIGNED" || status === "UNSIGNED") filter.status = status;
  if (q) filter.namaDokumen = { $regex: q, $options: "i" };

  const documents = await DocumentModel.find(filter)
    .populate("uploader", "nama email role")
    .populate("assignedTo", "nama email role walletAddress")
    .sort({ createdAt: -1 });

  res.json({ success: true, documents });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id)
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");

  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  const uploaderId = String((doc.uploader as unknown as { _id: Types.ObjectId })?._id || doc.uploader);
  const assignedId = doc.assignedTo ? String((doc.assignedTo as unknown as { _id: Types.ObjectId })?._id || doc.assignedTo) : null;
  const isAllowed =
    req.user!.role === "admin" ||
    uploaderId === req.user!.sub ||
    assignedId === req.user!.sub;

  if (!isAllowed) {
    throw ApiError.forbidden("Anda tidak memiliki izin mengakses dokumen ini");
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
  const doc = await DocumentModel.findById(req.params.id).select("+fileData");
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  const uploaderId = String(doc.uploader);
  const assignedId = doc.assignedTo ? String(doc.assignedTo) : null;
  const isAllowed =
    req.user!.role === "admin" ||
    uploaderId === req.user!.sub ||
    assignedId === req.user!.sub;

  if (!isAllowed) {
    throw ApiError.forbidden("Anda tidak memiliki izin mengunduh berkas ini");
  }

  if (!doc.fileData) throw ApiError.notFound("Berkas tidak tersedia di server");

  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", doc.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${doc.fileName}"`);
  res.send(doc.fileData);
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
    throw ApiError.forbidden("Hanya pengunggah atau administrator yang dapat menghapus dokumen ini");
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
