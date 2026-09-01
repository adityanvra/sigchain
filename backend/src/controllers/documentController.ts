import { Request, Response } from "express";
import { z } from "zod";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { AcademicSignature } from "../models/AcademicSignature";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sha256Buffer } from "../services/hashService";
import { recordAudit } from "../services/auditService";
import { qrPngBuffer, qrDataUrl, verifyUrlFor } from "../services/qrService";
import { blockchain } from "../services/blockchainService";
import { applySignatureToPdf } from "../services/pdfService";
import { Types } from "mongoose";
import { env } from "../config/env";

const uploadMetaSchema = z.object({
  namaDokumen: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  assignedTo: z.string().optional().nullable(),
});

const assignSchema = z.object({
  assignedTo: z.string().nullable().optional(),
});

const applySignatureSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  x: z.coerce.number().min(0).default(0),
  y: z.coerce.number().min(0).default(0),
  width: z.coerce.number().min(5).max(2000).default(150),
  height: z.coerce.number().min(5).max(2000).default(60),
  /** Optional: specific AcademicSignature._id to use; falls back to user's active sig */
  signatureId: z.string().optional(),
});

/**
 * Scope rules:
 * - Admin sees all documents.
 * - Akademisi (staff_akademik) sees documents they uploaded OR assigned to them.
 * - Staff Administrasi sees only their own uploads.
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

// ---------------------------------------------------------------------------
// Upload (single)
// ---------------------------------------------------------------------------
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah");

  const meta = uploadMetaSchema.parse(req.body);
  const buffer = req.file.buffer;

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
    namaDokumen: meta.namaDokumen?.trim() || req.file.originalname.replace(/\.pdf$/i, ""),
    description: meta.description,
    draftFileData: buffer,
    // Keep legacy fileData alias so old download routes still work during transition
    fileData: buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    hashDokumen: "", // computed after apply-signature
    uploader: req.user!.sub,
    assignedTo: targetAssigneeId,
    status: "DRAFT",
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "UPLOAD",
    aktivitas: targetAssignee
      ? `Mengunggah draft dokumen "${doc.namaDokumen}" & menugaskan ke ${targetAssignee.nama}`
      : `Mengunggah draft dokumen "${doc.namaDokumen}"`,
    metadata: {
      documentId: String(doc._id),
      assignedTo: targetAssignee ? String(targetAssignee._id) : null,
    },
    req,
  });

  const createdDoc = await DocumentModel.findById(doc._id)
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");

  res.status(201).json({ success: true, document: createdDoc });

});

// ---------------------------------------------------------------------------
// Bulk Upload
// ---------------------------------------------------------------------------
export const bulkUploadDocuments = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw ApiError.badRequest("Tidak ada berkas PDF yang diunggah");
  }

  let assignments: Record<string, { namaDokumen?: string; description?: string; assignedTo?: string }> = {};
  if (req.body.assignments) {
    try {
      assignments = typeof req.body.assignments === "string"
        ? JSON.parse(req.body.assignments)
        : req.body.assignments;
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

    const doc = await DocumentModel.create({
      namaDokumen: fileMeta.namaDokumen?.trim() || file.originalname.replace(/\.pdf$/i, ""),
      description: fileMeta.description || "",
      draftFileData: buffer,
      fileData: buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      hashDokumen: "",
      uploader: req.user!.sub,
      assignedTo: targetAssigneeId,
      status: "DRAFT",
    });

    createdDocs.push(doc);
  }

  await recordAudit({
    userId: req.user!.sub,
    action: "BULK_UPLOAD",
    aktivitas: `Mengunggah ${createdDocs.length} draft dokumen secara massal`,
    metadata: {
      count: createdDocs.length,
      documentIds: createdDocs.map((d) => String(d._id)),
    },
    req,
  });

  const populatedDocs = await DocumentModel.find({
    _id: { $in: createdDocs.map((d) => d._id) },
  })
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress")
    .sort({ createdAt: -1 });

  res.status(201).json({ success: true, count: populatedDocs.length, documents: populatedDocs });

});

// ---------------------------------------------------------------------------
// Apply visual signature → generate PDF final + hash
// ---------------------------------------------------------------------------
export const applySignature = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id).select("+draftFileData +fileData");
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  if (doc.status === "SIGNED") {
    throw ApiError.conflict("Dokumen sudah ditandatangani dan tidak dapat diubah");
  }

  // Authorization check
  const isAdmin = req.user!.role === "admin";
  const isAssigned = doc.assignedTo ? String(doc.assignedTo) === req.user!.sub : false;
  const isUploaderAkademik =
    req.user!.role === "staff_akademik" &&
    String(doc.uploader) === req.user!.sub &&
    !doc.assignedTo;

  if (!isAdmin && !isAssigned && !isUploaderAkademik) {
    throw ApiError.forbidden(
      "Hanya Akademisi yang ditugaskan atau Administrator yang dapat menerapkan tanda tangan"
    );
  }

  const params = applySignatureSchema.parse(req.body);

  // Find signature image
  let sigRecord;
  if (params.signatureId) {
    sigRecord = await AcademicSignature.findById(params.signatureId).select("+imageData");
    if (!sigRecord) throw ApiError.notFound("Gambar tanda tangan tidak ditemukan");
    // Only owner or admin can use a signature
    if (!isAdmin && String(sigRecord.academicId) !== req.user!.sub) {
      throw ApiError.forbidden("Tidak ada izin menggunakan tanda tangan ini");
    }
  } else {
    sigRecord = await AcademicSignature.findOne({
      academicId: req.user!.sub,
      active: true,
    }).select("+imageData");
    if (!sigRecord) {
      throw ApiError.badRequest(
        "Tidak ada tanda tangan tersimpan di profil. Unggah tanda tangan di halaman Profil terlebih dahulu."
      );
    }
  }

  // Get draft PDF bytes (support both old fileData and new draftFileData)
  const draftBuffer: Buffer | undefined = doc.draftFileData || doc.fileData;
  if (!draftBuffer) {
    throw ApiError.notFound("Berkas draft PDF tidak tersedia di server");
  }

  // Apply signature to PDF (no QR embedded — QR is only shown in the
  // blockchain verification panel on the document detail page)
  const signedPdfBuffer = await applySignatureToPdf({
    pdfBuffer: draftBuffer,
    signatureImageBuffer: sigRecord.imageData,
    signatureMimeType: sigRecord.mimeType,
    page: params.page,
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
  });

  // Hash the FINAL signed PDF
  const finalHash = sha256Buffer(signedPdfBuffer);

  // Persist — use updateOne to atomically write buffer fields without loading
  // the full document back into memory (avoids Vercel response size limit)
  await DocumentModel.updateOne(
    { _id: doc._id },
    {
      $set: {
        signedFileData: signedPdfBuffer,
        hashDokumen: finalHash,
        status: "PENDING_BLOCKCHAIN",
        signaturePosition: {
          page: params.page,
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
        },
      },
    }
  );

  await recordAudit({
    userId: req.user!.sub,
    action: "APPLY_SIGNATURE",
    aktivitas: `Menerapkan tanda tangan visual pada dokumen "${doc.namaDokumen}"`,
    metadata: {
      documentId: String(doc._id),
      page: params.page,
      hash: finalHash,
    },
    req,
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "GENERATE_HASH",
    aktivitas: `Menghasilkan SHA-256 dari PDF final dokumen "${doc.namaDokumen}"`,
    metadata: { documentId: String(doc._id), hash: finalHash },
    req,
  });

  // Fetch updated doc WITHOUT binary buffer fields to keep response small
  const updatedDoc = await DocumentModel.findById(doc._id)
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");

  res.json({
    success: true,
    document: updatedDoc,
    hash: finalHash,
    message:
      "Tanda tangan berhasil diterapkan. Lanjutkan dengan konfirmasi MetaMask untuk mencatat ke blockchain.",
  });
});



// ---------------------------------------------------------------------------
// Assign document to an Akademisi
// ---------------------------------------------------------------------------
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
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");


  res.json({ success: true, document: updatedDoc });
});

// ---------------------------------------------------------------------------
// List documents
// ---------------------------------------------------------------------------
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const filter: Record<string, unknown> = scopeFilter(req);

  const validStatuses = ["DRAFT", "UNSIGNED", "PENDING_BLOCKCHAIN", "SIGNED"];
  if (status && validStatuses.includes(status)) filter.status = status;
  if (q) filter.namaDokumen = { $regex: q, $options: "i" };

  const documents = await DocumentModel.find(filter)
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role")
    .populate("assignedTo", "nama email role walletAddress")
    .sort({ createdAt: -1 });

  res.json({ success: true, documents });

});

function getFrontendBaseUrl(req: Request): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  const origin = req.headers.origin;
  if (origin && typeof origin === "string") return origin.replace(/\/$/, "");
  const referer = req.headers.referer;
  if (referer && typeof referer === "string") {
    try {
      return new URL(referer).origin;
    } catch {}
  }
  return env.PUBLIC_VERIFY_URL.replace(/\/verify\/?$/, "") || "http://localhost:5173";
}

// ---------------------------------------------------------------------------
// Get single document detail
// ---------------------------------------------------------------------------
export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id)
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role walletAddress")
    .populate("assignedTo", "nama email role walletAddress");


  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  const uploaderId = String((doc.uploader as unknown as { _id: Types.ObjectId })?._id || doc.uploader);
  const assignedId = doc.assignedTo
    ? String((doc.assignedTo as unknown as { _id: Types.ObjectId })?._id || doc.assignedTo)
    : null;
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

  const frontendBase = getFrontendBaseUrl(req);
  const verifyUrl = `${frontendBase}/verify/${doc._id}`;

  const qr = doc.hashDokumen
    ? await qrDataUrl(verifyUrl)
    : null;

  res.json({
    success: true,
    document: doc,
    signatures,
    qrCode: qr,
    verifyUrl,
    explorer: doc.transactionHash
      ? `${blockchain.config().blockExplorer}/tx/${doc.transactionHash}`
      : null,
  });
});

// ---------------------------------------------------------------------------
// Download document (draft or signed)
// ---------------------------------------------------------------------------
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id).select(
    "+draftFileData +signedFileData +fileData"
  );
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

  // Determine which version to serve
  const wantDraft = req.query.type === "draft";
  let fileBuffer: Buffer | undefined;
  let fileName = doc.fileName;

  if (wantDraft || !doc.signedFileData) {
    fileBuffer = doc.draftFileData || doc.fileData;
    // keep original fileName for draft
  } else {
    fileBuffer = doc.signedFileData;
    // suffix the filename to indicate it's the signed copy
    const base = doc.fileName.replace(/\.pdf$/i, "");
    fileName = `${base}_SIGNED.pdf`;
  }

  if (!fileBuffer) throw ApiError.notFound("Berkas tidak tersedia di server");

  const buffer = Buffer.isBuffer(fileBuffer)
    ? fileBuffer
    : (fileBuffer as any).value
    ? (fileBuffer as any).value()
    : Buffer.from(fileBuffer);

  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.setHeader("Content-Disposition", `${disposition}; filename="${fileName}"`);
  res.end(buffer);
});

// ---------------------------------------------------------------------------
// QR PNG for document
// ---------------------------------------------------------------------------
export const documentQrPng = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  // QR points to public verify page for this document
  const frontendBase = getFrontendBaseUrl(req);
  const verifyUrl = `${frontendBase}/verify/${doc._id}`;
  const png = await qrPngBuffer(verifyUrl);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", png.length);
  res.end(png);
});

// ---------------------------------------------------------------------------
// Delete document
// ---------------------------------------------------------------------------
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
