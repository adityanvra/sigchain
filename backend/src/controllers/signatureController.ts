import { Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { blockchain } from "../services/blockchainService";
import { assertCurrentSigner } from "../services/documentAccess";
import { approveIntermediateStep } from "./workflowController";
import { notifyDocument } from "../models/Notification";
import { recordAudit } from "../services/auditService";

/**
 * Step 1 — prepare. Returns hash of the FINAL signed PDF (already computed by
 * apply-signature) and public server-side recording configuration.
 */
export const prepareSign = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");

  // Must be in PENDING_BLOCKCHAIN state (visual signature applied)
  if (doc.status === "SIGNED") {
    throw ApiError.conflict("Dokumen sudah ditandatangani");
  }
  if (doc.status === "DRAFT" || doc.status === "UNSIGNED") {
    throw ApiError.badRequest(
      "Tanda tangan visual belum diterapkan. Gunakan editor tanda tangan terlebih dahulu."
    );
  }
  if (!doc.hashDokumen) {
    throw ApiError.badRequest("Hash dokumen belum tersedia. Terapkan tanda tangan visual terlebih dahulu.");
  }

  assertCurrentSigner(doc, req);


  res.json({
    success: true,
    hash: doc.hashDokumen,
    documentId: String(doc._id),
    ...blockchain.config(),
  });
});

// Wallet, signature, hash and transaction are derived by the server, never the client.
const confirmSchema = z.object({}).strict();

/**
 * Step 2 — approve and anchor from the server wallet (or explicit demo mode).
 */
export const confirmSign = asyncHandler(async (req: Request, res: Response) => {
  confirmSchema.parse(req.body || {});

  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (doc.status === "SIGNED") throw ApiError.conflict("Dokumen sudah ditandatangani");
  assertCurrentSigner(doc, req);
  if (doc.status === "PENDING_APPROVAL") {
    res.json(await approveIntermediateStep(doc, req));
    return;
  }
  if (doc.signingSteps.length && doc.signingSteps[doc.currentStep]?.status !== "APPLIED") throw ApiError.conflict("Tanda tangan tahap ini belum diterapkan");
  if (doc.status !== "PENDING_BLOCKCHAIN") {
    throw ApiError.badRequest(
      "Dokumen harus dalam status PENDING_BLOCKCHAIN sebelum dikonfirmasi ke blockchain."
    );
  }
  if (!doc.hashDokumen) {
    throw ApiError.badRequest("Hash dokumen tidak tersedia");
  }

  assertCurrentSigner(doc, req);


  if (doc.approvalUserId && String(doc.approvalUserId) !== req.user!.sub) {
    throw ApiError.conflict("Pencatatan sudah disetujui pengguna lain; lanjutkan dengan akun pemberi persetujuan tersebut");
  }
  // Atomic lease protects against double clicks and simultaneous requests.
  const now = new Date();
  const locked = await DocumentModel.findOneAndUpdate(
    { _id: doc._id, status: "PENDING_BLOCKCHAIN", hashDokumen: doc.hashDokumen,
      assignedTo: doc.assignedTo || null, uploader: doc.uploader,
      $or: [{ blockchainLockUntil: null }, { blockchainLockUntil: { $lte: now } }] },
    { $set: { blockchainLockUntil: new Date(now.getTime() + 300_000) } },
    { new: true }
  );
  if (!locked) throw ApiError.conflict("Pencatatan dokumen sedang diproses atau status dokumen telah berubah");
  let leaseReleased = false;
  try {
    if (locked.approvalUserId && String(locked.approvalUserId) !== req.user!.sub) {
      throw ApiError.conflict("Lanjutkan pencatatan menggunakan akun yang memberi persetujuan awal");
    }
    if (!locked.approvalUserId) {
      locked.approvalUserId = new Types.ObjectId(req.user!.sub);
      locked.approvalAt = now;
      await locked.save();
    }
    const approvalMessage = JSON.stringify({
      purpose: "SIGCHAIN_SERVER_RECORDING", documentId: String(doc._id),
      documentHash: doc.hashDokumen, approvedBy: String(locked.approvalUserId),
      approvedAt: locked.approvalAt!.toISOString(),
      approvals: doc.signingSteps.map((s, i) => ({ stepIndex: i, approvedBy: String(s.signer), capacity: s.capacity, hash: s.hash, approvedAt: i === doc.currentStep ? locked.approvalAt : s.approvedAt })),
    });
    const result = await blockchain.storeServer(
      doc.hashDokumen, approvalMessage, locked.transactionHash || undefined,
      async (transactionHash, walletAddress) => {
        // Save immediately after submission, so a timeout can resume the same tx.
        await DocumentModel.updateOne({ _id: doc._id }, { $set: {
          transactionHash, walletAddress, recordingMethod: "server_wallet",
        } });
      }
    ).catch(error => {
      if (error instanceof ApiError) throw error;
      // Provider errors can contain RPC credentials and raw request details.
      throw new ApiError(503, "Pencatatan belum selesai. Periksa koneksi dan saldo wallet server, lalu coba pengesahan kembali.");
    });
    const walletAddress = result.walletAddress;

    if (doc.signingSteps.length) {
      doc.signingSteps[doc.currentStep].status = "APPROVED";
      doc.signingSteps[doc.currentStep].approvedAt = locked.approvalAt;
    }
    doc.status = "SIGNED";
    doc.transactionHash = result.transactionHash;
    doc.blockNumber = result.blockNumber;
    doc.blockchainTimestamp = new Date(result.timestamp * 1000);
    doc.walletAddress = walletAddress.toLowerCase();
    doc.recordingMethod = "server_wallet";
    doc.approvalUserId = locked.approvalUserId;
    doc.approvalAt = locked.approvalAt;

    const sig = await Signature.findOneAndUpdate({ documentId: doc._id, recordingMethod: "server_wallet" }, { $set: {
      documentId: doc._id,
      stepIndex: doc.signingSteps.length ? doc.currentStep : undefined,
      capacity: doc.signingSteps[doc.currentStep]?.capacity || "Penandatangan",
      signer: req.user!.sub,
      walletAddress: walletAddress.toLowerCase(),
      signature: result.signature,
      recordingMethod: "server_wallet",
      approvalMessage,
      approvedAt: locked.approvalAt,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      timestamp: new Date(result.timestamp * 1000),
    } }, { upsert: true, new: true, runValidators: true });
    await doc.save();
    await notifyDocument([doc.uploader, doc.reviewer?.toString()], doc._id as Types.ObjectId, `${doc.namaDokumen} selesai disahkan. PDF final dapat diunduh.`);

    await recordAudit({
      userId: req.user!.sub,
      action: "BLOCKCHAIN_CONFIRM",
      aktivitas: `Hash PDF final dokumen "${doc.namaDokumen}" berhasil dicatat ke blockchain`,
      metadata: {
        documentId: String(doc._id),
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        hash: doc.hashDokumen,
        mock: result.mock,
        recordingMethod: "server_wallet",
        approvedBy: req.user!.sub,
        recorderWallet: walletAddress,
      },
      req,
    });

    await recordAudit({
      userId: req.user!.sub,
      action: "SIGN",
      aktivitas: `Pengguna menyetujui dokumen "${doc.namaDokumen}"; wallet server mencatat hash PDF final`,
      metadata: {
        documentId: String(doc._id),
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        mock: result.mock,
      },
      req,
    });

    await DocumentModel.updateOne({ _id: doc._id }, { $set: { blockchainLockUntil: null } });
    leaseReleased = true;
    res.json({ success: true, document: doc, signature: sig, mock: result.mock,
      explorer: result.mock ? null : envExplorer(result.transactionHash), recordingMethod: "server_wallet", completed: true });
  } finally {
    if (!leaseReleased) {
      await DocumentModel.updateOne({ _id: doc._id }, { $set: { blockchainLockUntil: null } });
    }
  }
});

function envExplorer(transactionHash: string): string | null {
  const config = blockchain.config();
  return config.blockExplorer ? `${config.blockExplorer}/tx/${transactionHash}` : null;
}
