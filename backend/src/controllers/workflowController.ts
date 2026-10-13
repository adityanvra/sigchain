import { Request } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { DocumentModel, IDocument } from "../models/Document";
import { User, IUser } from "../models/User";
import { Signature } from "../models/Signature";
import { notifyDocument } from "../models/Notification";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditService";
import { idOf, assertCurrentSigner } from "../services/documentAccess";

export function capacitiesFor(user: IUser): string[] {
  return [...new Set([...(user.jabatan || []), ...(user.role === "staff_akademik"
    ? ["Dosen Pembimbing", "Dosen Wali", "Penguji 1", "Penguji 2", "Penandatangan"] : ["Penandatangan"])])];
}
export const participantDirectory = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: { $in: ["admin", "staff_akademik", "staff_administrasi"] } }).sort({ nama: 1 });
  const directory = users.map(u => ({ _id: u._id, nama: u.nama, role: u.role, jabatan: u.jabatan, unit: u.unit, capacities: capacitiesFor(u) }));
  res.json({ success: true, signers: directory.filter(u => u.role !== "admin"), reviewers: directory.filter(u => u.role === "admin" || u.role === "staff_administrasi") });
});
async function owned(req: Request): Promise<IDocument> {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (req.user!.role !== "admin" && idOf(doc.uploader) !== req.user!.sub) throw ApiError.forbidden("Hanya pemohon atau admin dapat mengelola pengajuan");
  if (doc.supersededBy) throw ApiError.conflict("Gunakan versi pengganti dokumen ini");
  return doc;
}
export async function transition(doc: IDocument, changes: Record<string, unknown>): Promise<IDocument> {
  const changed = await DocumentModel.findOneAndUpdate({
    _id: doc._id, status: doc.status, workflowVersion: doc.workflowVersion ? doc.workflowVersion : { $in: [0, null] }, supersededBy: null,
    $or: [{ blockchainLockUntil: null }, { blockchainLockUntil: { $lte: new Date() } }],
  }, { $set: changes, $inc: { workflowVersion: 1 } }, { new: true, runValidators: true });
  if (!changed) throw ApiError.conflict("Dokumen sedang diproses atau berubah; muat ulang dan coba kembali");
  return changed;
}
const id = z.string().regex(/^[a-f0-9]{24}$/i, "ID pengguna tidak valid");
export const configureWorkflow = asyncHandler(async (req, res) => {
  const doc = await owned(req);
  if (!["DRAFT", "UNSIGNED"].includes(doc.status)) throw ApiError.conflict("Alur hanya dapat diatur sebelum pengajuan dikirim");
  const data = z.object({ documentType: z.string().trim().min(2).max(120), reviewerId: id,
    steps: z.array(z.object({ signerId: id, capacity: z.string().trim().min(2).max(120) })).min(1).max(12) }).parse(req.body);
  const reviewer = await User.findById(data.reviewerId);
  if (!reviewer || !["admin", "staff_administrasi"].includes(reviewer.role)) throw ApiError.badRequest("Pemeriksa harus admin atau staf TU");
  const distinct = new Set<string>();
  const steps = [];
  for (const step of data.steps) {
    const signer = await User.findById(step.signerId);
    if (!signer || !["staff_akademik", "staff_administrasi"].includes(signer.role) || !capacitiesFor(signer).includes(step.capacity)) {
      throw ApiError.badRequest("Orang atau kapasitas penandatangan tidak sesuai daftar pejabat");
    }
    const key = `${step.signerId}:${step.capacity}`;
    if (distinct.has(key)) throw ApiError.badRequest("Orang dan kapasitas yang sama tidak boleh diulang");
    distinct.add(key);
    steps.push({ signer: new Types.ObjectId(step.signerId), capacity: step.capacity, status: "WAITING" });
  }
  const updated = await transition(doc, { documentType: data.documentType, reviewer: reviewer._id, signingSteps: steps, currentStep: 0, assignedTo: steps[0].signer });
  await recordAudit({ userId: req.user!.sub, action: "WORKFLOW", aktivitas: `Mengatur alur ${doc.namaDokumen}`, metadata: { documentId: String(doc._id), steps: data.steps, reviewerId: data.reviewerId }, req });
  res.json({ success: true, document: updated });
});
export const submitDocument = asyncHandler(async (req, res) => {
  const doc = await owned(req);
  if (!["DRAFT", "UNSIGNED"].includes(doc.status) || !doc.signingSteps.length || !doc.reviewer) throw ApiError.badRequest("Lengkapi pemeriksa dan urutan penandatangan sebelum mengajukan dokumen");
  const updated = await transition(doc, { status: "SUBMITTED", reviewReason: "" });
  await notifyDocument([doc.reviewer], doc._id as Types.ObjectId, `Periksa pengajuan ${doc.namaDokumen}`);
  await recordAudit({ userId: req.user!.sub, action: "SUBMIT", aktivitas: `Mengajukan ${doc.namaDokumen} untuk pemeriksaan TU`, metadata: { documentId: String(doc._id), version: doc.version }, req });
  res.json({ success: true, document: updated });
});
export const reviewDocument = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  const { decision, reason } = z.object({ decision: z.enum(["approve", "revise", "reject"]), reason: z.string().trim().max(2000).default("") }).parse(req.body);
  const isReviewer = idOf(doc.reviewer) === req.user!.sub;
  const isCurrent = idOf(doc.signingSteps[doc.currentStep]?.signer) === req.user!.sub;
  if (doc.status === "SUBMITTED" ? !isReviewer : !(isCurrent && ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(doc.status))) throw ApiError.forbidden("Anda tidak memiliki giliran untuk memeriksa dokumen ini");
  if (decision === "approve" && doc.status !== "SUBMITTED") throw ApiError.badRequest("Persetujuan penandatangan dilakukan melalui editor tanda tangan");
  if (decision !== "approve" && !reason) throw ApiError.badRequest("Alasan penolakan atau perbaikan wajib diisi");
  const steps = doc.signingSteps.map(s => ({ signer: s.signer, capacity: s.capacity, status: s.status, position: s.position, appliedAt: s.appliedAt, approvedAt: s.approvedAt, hash: s.hash }));
  if (decision === "approve") steps[0].status = "READY";
  const status = decision === "approve" ? "READY_TO_SIGN" : decision === "revise" ? "NEEDS_REVISION" : "REJECTED";
  const updated = await transition(doc, { status, reviewReason: reason, signingSteps: steps });
  await notifyDocument([doc.uploader, decision === "approve" ? steps[0].signer : undefined], doc._id as Types.ObjectId,
    decision === "approve" ? `${doc.namaDokumen} siap ditandatangani` : `${doc.namaDokumen}: ${decision === "revise" ? "perlu perbaikan" : "ditolak"}. ${reason}`);
  await recordAudit({ userId: req.user!.sub, action: "REVIEW", aktivitas: `Pemeriksaan ${doc.namaDokumen}: ${status}`, metadata: { documentId: String(doc._id), decision, reason, version: doc.version }, req });
  res.json({ success: true, document: updated });
});
export const reviseDocument = asyncHandler(async (req, res) => {
  const doc = await owned(req);
  if (!["NEEDS_REVISION", "REJECTED", "SIGNED"].includes(doc.status)) throw ApiError.conflict("Versi baru hanya dibuat untuk perbaikan, penolakan, atau koreksi dokumen final");
  if (!req.file) throw ApiError.badRequest("Unggah PDF versi perbaikan");
  const nextId = new Types.ObjectId();
  // Atomically reserve the successor; final PDF and its on-chain hash are never overwritten.
  await transition(doc, { supersededBy: nextId });
  let next;
  try {
    next = await DocumentModel.create({ _id: nextId, namaDokumen: doc.namaDokumen, description: doc.description, documentType: doc.documentType,
      uploader: doc.uploader, reviewer: doc.reviewer, assignedTo: doc.signingSteps[0]?.signer || doc.assignedTo,
      signingSteps: doc.signingSteps.map(s => ({ signer: s.signer, capacity: s.capacity, status: "WAITING" })),
      draftFileData: req.file.buffer, fileName: req.file.originalname, mimeType: req.file.mimetype, fileSize: req.file.size,
      previousVersionId: doc._id, version: doc.version + 1, status: "DRAFT" });
  } catch (error) {
    await DocumentModel.updateOne({ _id: doc._id, supersededBy: nextId }, { $set: { supersededBy: null } });
    throw error;
  }
  await notifyDocument([doc.reviewer], nextId, `Versi ${next.version} dari ${doc.namaDokumen} dibuat; menunggu pengajuan ulang`);
  await recordAudit({ userId: req.user!.sub, action: "REVISION", aktivitas: `Membuat versi ${next.version} ${doc.namaDokumen}`, metadata: { documentId: String(nextId), previousVersionId: String(doc._id) }, req });
  res.status(201).json({ success: true, document: next });
});

/** Intermediate approvals do not anchor an unfinished PDF on-chain. */
export async function approveIntermediateStep(doc: IDocument, req: Request) {
  assertCurrentSigner(doc, req);
  const step = doc.signingSteps[doc.currentStep];
  if (doc.status !== "PENDING_APPROVAL" || step?.status !== "APPLIED" || doc.currentStep >= doc.signingSteps.length - 1) {
    throw ApiError.conflict("Tahap tanda tangan belum siap disetujui");
  }
  const approvedAt = new Date();
  const steps = doc.signingSteps.map(s => ({ signer: s.signer, capacity: s.capacity, status: s.status, position: s.position, appliedAt: s.appliedAt, approvedAt: s.approvedAt, hash: s.hash }));
  steps[doc.currentStep].status = "APPROVED";
  steps[doc.currentStep].approvedAt = approvedAt;
  steps[doc.currentStep + 1].status = "READY";
  const updated = await transition(doc, { signingSteps: steps, currentStep: doc.currentStep + 1, assignedTo: steps[doc.currentStep + 1].signer, status: "PARTIALLY_SIGNED" });
  const sig = await Signature.findOneAndUpdate({ documentId: doc._id, stepIndex: doc.currentStep }, { $set: {
    documentId: doc._id, signer: req.user!.sub, stepIndex: doc.currentStep, capacity: step.capacity,
    recordingMethod: "account_approval", approvedAt, timestamp: approvedAt,
    signature: JSON.stringify({ purpose: "ACCOUNT_APPROVAL", approvedBy: req.user!.sub, documentHash: doc.hashDokumen, capacity: step.capacity, approvedAt }),
  } }, { upsert: true, new: true, runValidators: true });
  await notifyDocument([doc.uploader, steps[doc.currentStep + 1].signer], doc._id as Types.ObjectId, `${step.capacity} menyetujui ${doc.namaDokumen}; menunggu penandatangan berikutnya`);
  await recordAudit({ userId: req.user!.sub, action: "SIGN", aktivitas: `Persetujuan ${step.capacity} pada ${doc.namaDokumen}`, metadata: { documentId: String(doc._id), stepIndex: doc.currentStep, hash: doc.hashDokumen, version: doc.version }, req });
  return { success: true, document: updated, signature: sig, completed: false, intermediate: true, recordingMethod: "account_approval" };
}

export const prepareLetter = asyncHandler(async (req, res) => {
  const doc = await DocumentModel.findById(req.params.id).select("+draftFileData +requestFileData");
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (doc.status !== "SUBMITTED" || idOf(doc.reviewer) !== req.user!.sub) throw ApiError.forbidden("Hanya pemeriksa TU dapat menyiapkan surat keluaran sebelum persetujuan");
  if (!req.file) throw ApiError.badRequest("Unggah PDF surat keluaran TU");
  const updated = await transition(doc, { requestFileData: doc.requestFileData || doc.draftFileData, draftFileData: req.file.buffer, fileData: undefined,
    hasRequestFile: true, fileName: req.file.originalname, mimeType: req.file.mimetype, fileSize: req.file.size });
  await recordAudit({ userId: req.user!.sub, action: "REVIEW", aktivitas: `TU menyiapkan surat keluaran ${doc.namaDokumen}`, metadata: { documentId: String(doc._id), version: doc.version }, req });
  res.json({ success: true, document: updated.toObject({ transform: (_doc, ret: any) => { delete ret.requestFileData; delete ret.draftFileData; delete ret.fileData; return ret; } }) });
});
