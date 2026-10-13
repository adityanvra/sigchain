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
import { applySignatureToPdf, addVerificationPage } from "../services/pdfService";
import { Types } from "mongoose";
import { env } from "../config/env";
import { documentScope, canReadDocument, assertCurrentSigner } from "../services/documentAccess";
import { notifyDocument } from "../models/Notification";

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
function scopeFilter(req: Request) { return documentScope(req); }

// ---------------------------------------------------------------------------
// Upload (single)
// ---------------------------------------------------------------------------
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah");

  const meta = uploadMetaSchema.parse(req.body);
  if (req.user!.role === "mahasiswa" && meta.assignedTo) throw ApiError.badRequest("Mahasiswa memilih alur penandatangan pada detail pengajuan, bukan penugasan langsung");
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
    .populate("assignedTo", "nama email role walletAddress")
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit");

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
  if (req.user!.role === "mahasiswa" && (defaultAssignedTo || Object.values(assignments).some(a => a.assignedTo))) throw ApiError.badRequest("Atur alur pengajuan mahasiswa pada detail dokumen");
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
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit")
    .sort({ createdAt: -1 });

  res.status(201).json({ success: true, count: populatedDocs.length, documents: populatedDocs });

});

// ---------------------------------------------------------------------------
// Apply visual signature → generate PDF final + hash
// ---------------------------------------------------------------------------
export const applySignature = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id).select("+draftFileData +signedFileData +requestFileData +fileData");
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  if (doc.status === "SIGNED") {
    throw ApiError.conflict("Dokumen sudah ditandatangani dan tidak dapat diubah");
  }
  if (doc.status === "PENDING_BLOCKCHAIN") {
    throw ApiError.conflict("PDF final sudah siap; lanjutkan pencatatan blockchain tanpa menimpa tanda tangan");
  }

  assertCurrentSigner(doc, req);
  const isAdmin = req.user!.role === "admin";
  if (doc.signingSteps.length && !["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(doc.status)) {
    throw ApiError.conflict("Dokumen belum lolos pemeriksaan atau belum mendapat giliran tanda tangan");
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

  if (doc.signingSteps.some(s => s.status === "APPROVED" && s.position && s.position.page === params.page &&
      params.x < s.position.x + s.position.width && params.x + params.width > s.position.x &&
      params.y < s.position.y + s.position.height && params.y + params.height > s.position.y)) {
    throw ApiError.badRequest("Area tanda tangan bertumpuk dengan tanda tangan yang sudah disetujui");
  }

  // Get draft PDF bytes (support both old fileData and new draftFileData)
  const draftBuffer: Buffer | undefined = doc.signingSteps.length && doc.currentStep > 0 ? doc.signedFileData : (doc.draftFileData || doc.fileData);
  if (!draftBuffer) {
    throw ApiError.notFound("Berkas draft PDF tidak tersedia di server");
  }

  // Preserve earlier signatures; append a verification QR only at the final stage.
  let signedPdfBuffer = await applySignatureToPdf({
    pdfBuffer: draftBuffer,
    signatureImageBuffer: sigRecord.imageData,
    signatureMimeType: sigRecord.mimeType,
    page: params.page,
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
  }).catch(error => { throw ApiError.badRequest(error instanceof Error ? error.message : "PDF atau gambar tanda tangan tidak valid"); });
  if (!doc.signingSteps.length || doc.currentStep === doc.signingSteps.length - 1) {
    const verifyUrl = `${getFrontendBaseUrl(req)}/verify/${doc._id}`;
    signedPdfBuffer = await addVerificationPage(signedPdfBuffer, await qrPngBuffer(verifyUrl), verifyUrl);
  }

  // Hash the FINAL signed PDF
  const storedPdfBytes = signedPdfBuffer.length + (doc.draftFileData?.length || doc.fileData?.length || 0) + (doc.requestFileData?.length || 0);
  if (storedPdfBytes > 15 * 1024 * 1024) throw ApiError.badRequest("Gabungan PDF dan tanda tangan terlalu besar. Gunakan PDF dan gambar tanda tangan yang lebih kecil.");
  const finalHash = sha256Buffer(signedPdfBuffer);

  // Persist — use updateOne to atomically write buffer fields without loading
  // the full document back into memory (avoids Vercel response size limit)
  const steps = doc.signingSteps;
  if (steps.length) {
    steps[doc.currentStep].status = "APPLIED";
    steps[doc.currentStep].position = { page: params.page, x: params.x, y: params.y, width: params.width, height: params.height };
    steps[doc.currentStep].hash = finalHash;
    steps[doc.currentStep].appliedAt = new Date();
  }
  const applied = await DocumentModel.updateOne(
    { _id: doc._id, status: doc.status, currentStep: doc.currentStep, workflowVersion: doc.workflowVersion || { $in: [0, null] } },
    {
      $inc: { workflowVersion: 1 },
      $unset: { fileData: "" },
      $set: {
        signedFileData: signedPdfBuffer,
        fileSize: signedPdfBuffer.length,
        hashDokumen: finalHash,
        status: steps.length && doc.currentStep < steps.length - 1 ? "PENDING_APPROVAL" : "PENDING_BLOCKCHAIN",
        signingSteps: steps,
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
  if (!applied.modifiedCount) throw ApiError.conflict("Status dokumen berubah; muat ulang sebelum menerapkan tanda tangan");

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
    .populate("assignedTo", "nama email role walletAddress")
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit");

  res.json({
    success: true,
    document: updatedDoc,
    hash: finalHash,
    message:
      "Tanda tangan berhasil diterapkan. Lanjutkan pengesahan untuk mencatat PDF final melalui server.",
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
  if (doc.signingSteps.length) throw ApiError.conflict("Gunakan pengaturan alur sebelum pengajuan, bukan penugasan tunggal");
  if (doc.approvalUserId || (doc.blockchainLockUntil && doc.blockchainLockUntil > new Date())) {
    throw ApiError.conflict("Persetujuan pencatatan sudah dimulai; penugasan tidak dapat diubah");
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

  const assignment = await DocumentModel.updateOne(
    { _id: doc._id, status: { $ne: "SIGNED" }, approvalUserId: null,
      $or: [{ blockchainLockUntil: null }, { blockchainLockUntil: { $lte: new Date() } }] },
    { $set: { assignedTo: targetUser ? targetUser._id : null } }
  );
  if (!assignment.matchedCount) throw ApiError.conflict("Persetujuan sudah dimulai atau dokumen berubah; penugasan tidak dapat diubah");

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
    .populate("assignedTo", "nama email role walletAddress")
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit");


  res.json({ success: true, document: updatedDoc });
});

// ---------------------------------------------------------------------------
// List documents
// ---------------------------------------------------------------------------
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { status, q } = req.query as { status?: string; q?: string };
  const filter: Record<string, unknown> = scopeFilter(req);

  const validStatuses = ["DRAFT", "UNSIGNED", "SUBMITTED", "READY_TO_SIGN", "PARTIALLY_SIGNED", "PENDING_APPROVAL", "NEEDS_REVISION", "REJECTED", "PENDING_BLOCKCHAIN", "SIGNED"];
  if (status && validStatuses.includes(status)) filter.status = status;
  if (q) filter.namaDokumen = { $regex: q, $options: "i" };

  const documents = await DocumentModel.find(filter)
    .select("-draftFileData -signedFileData -fileData")
    .populate("uploader", "nama email role")
    .populate("assignedTo", "nama email role walletAddress")
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit")
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
    .populate("assignedTo", "nama email role walletAddress")
    .populate("reviewer", "nama email role")
    .populate("signingSteps.signer", "nama role jabatan unit");


  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  const isAllowed = canReadDocument(doc, req);

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
    mock: blockchain.isMock(),
    explorer: !blockchain.isMock() && doc.status === "SIGNED" && doc.transactionHash && blockchain.config().blockExplorer
      ? `${blockchain.config().blockExplorer}/tx/${doc.transactionHash}`
      : null,
  });
});

// ---------------------------------------------------------------------------
// Download document (draft or signed)
// ---------------------------------------------------------------------------
export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id).select(
    "+draftFileData +signedFileData +requestFileData +fileData"
  );
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  const isAllowed = canReadDocument(doc, req);

  if (!isAllowed) {
    throw ApiError.forbidden("Anda tidak memiliki izin mengunduh berkas ini");
  }

  // Determine which version to serve
  const wantDraft = req.query.type === "draft";
  let fileBuffer: Buffer | undefined;
  let fileName = doc.fileName;

  if (req.query.type === "request") {
    if (!doc.requestFileData) throw ApiError.notFound("Berkas permohonan awal tidak tersedia");
    fileBuffer = doc.requestFileData;
    fileName = "permohonan-awal.pdf";
  } else if (wantDraft || !doc.signedFileData) {
    fileBuffer = doc.draftFileData || doc.fileData;
    // keep original fileName for draft
  } else {
    fileBuffer = doc.signedFileData;
    // suffix the filename to indicate it's the signed copy
    const base = doc.fileName.replace(/\.pdf$/i, "");
    fileName = `${base}_${doc.status === "SIGNED" ? "SIGNED" : "IN_PROGRESS"}.pdf`;
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
  res.setHeader("Content-Disposition", `${disposition}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.end(buffer);
});

// ---------------------------------------------------------------------------
// QR PNG for document
// ---------------------------------------------------------------------------
export const documentQrPng = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  if (!canReadDocument(doc, req)) throw ApiError.forbidden("Tidak ada izin mengakses QR dokumen ini");
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
  if (doc.supersededBy || doc.previousVersionId || !["DRAFT", "UNSIGNED"].includes(doc.status)) throw ApiError.conflict("Dokumen yang sudah diproses atau memiliki riwayat versi tidak dapat dihapus");
  if (doc.status === "PENDING_BLOCKCHAIN" && (doc.approvalUserId || doc.blockchainLockUntil)) {
    throw ApiError.conflict("Selesaikan pencatatan transaksi sebelum menghapus dokumen");
  }

  const deleted = await DocumentModel.findOneAndDelete({
    _id: doc._id, status: doc.status, supersededBy: null, previousVersionId: null,
    workflowVersion: doc.workflowVersion ? doc.workflowVersion : { $in: [0, null] },
    $or: [{ blockchainLockUntil: null }, { blockchainLockUntil: { $lte: new Date() } }],
    ...(doc.status === "PENDING_BLOCKCHAIN" ? { approvalUserId: null } : {}),
  });
  if (!deleted) throw ApiError.conflict("Status dokumen berubah atau pencatatan sedang diproses; dokumen tidak dihapus");
  await Signature.deleteMany({ documentId: doc._id });

  await recordAudit({
    userId: req.user!.sub,
    action: "DELETE",
    aktivitas: `Menghapus dokumen "${doc.namaDokumen}"`,
    metadata: { documentId: String(doc._id) },
    req,
  });

  res.json({ success: true, message: "Dokumen dihapus" });
});
