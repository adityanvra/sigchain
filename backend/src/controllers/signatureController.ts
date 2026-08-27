import { Request, Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { blockchain } from "../services/blockchainService";
import { recordAudit } from "../services/auditService";

/**
 * Step 1 — prepare. Returns hash of the FINAL signed PDF (already computed by
 * apply-signature) and chain config so the frontend can build the MetaMask tx.
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

  const isAdmin = req.user!.role === "admin";
  const isAssigned = doc.assignedTo ? String(doc.assignedTo) === req.user!.sub : false;
  const isUploaderAkademik =
    req.user!.role === "staff_akademik" &&
    String(doc.uploader) === req.user!.sub &&
    !doc.assignedTo;

  if (!isAdmin && !isAssigned && !isUploaderAkademik) {
    throw ApiError.forbidden(
      "Hanya Akademisi yang ditugaskan atau Administrator yang dapat menandatangani dokumen ini"
    );
  }

  res.json({
    success: true,
    hash: doc.hashDokumen,
    documentId: String(doc._id),
    ...blockchain.config(),
  });
});

const confirmSchema = z.object({
  walletAddress: z.string().refine((v) => ethers.isAddress(v), "Invalid wallet address"),
  signature: z.string().min(1, "Signature wajib diisi"),
  transactionHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
    .optional(),
});

/**
 * Step 2 — confirm. Validates the MetaMask transaction, anchors hash on-chain
 * (or mock), persists Signature + updates Document status to SIGNED.
 */
export const confirmSign = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, signature, transactionHash } = confirmSchema.parse(req.body);

  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (doc.status === "SIGNED") throw ApiError.conflict("Dokumen sudah ditandatangani");
  if (doc.status !== "PENDING_BLOCKCHAIN" && doc.status !== "UNSIGNED") {
    throw ApiError.badRequest(
      "Dokumen harus dalam status PENDING_BLOCKCHAIN sebelum dikonfirmasi ke blockchain."
    );
  }
  if (!doc.hashDokumen) {
    throw ApiError.badRequest("Hash dokumen tidak tersedia");
  }

  const isAdmin = req.user!.role === "admin";
  const isAssigned = doc.assignedTo ? String(doc.assignedTo) === req.user!.sub : false;
  const isUploaderAkademik =
    req.user!.role === "staff_akademik" &&
    String(doc.uploader) === req.user!.sub &&
    !doc.assignedTo;

  if (!isAdmin && !isAssigned && !isUploaderAkademik) {
    throw ApiError.forbidden(
      "Hanya Akademisi yang ditugaskan atau Administrator yang dapat menandatangani dokumen ini"
    );
  }

  let result;
  if (blockchain.isMock()) {
    result = blockchain.storeMock(doc.hashDokumen, walletAddress);
  } else {
    if (!transactionHash) {
      throw ApiError.badRequest("transactionHash wajib diisi pada mode blockchain nyata");
    }
    result = await blockchain.confirmTransaction(transactionHash);
    const onChain = await blockchain.verify(doc.hashDokumen);
    if (!onChain) throw ApiError.badRequest("Hash tidak ditemukan di blockchain setelah transaksi");
  }

  doc.status = "SIGNED";
  doc.transactionHash = result.transactionHash;
  doc.blockNumber = result.blockNumber;
  doc.blockchainTimestamp = new Date(result.timestamp * 1000);
  doc.walletAddress = walletAddress.toLowerCase();
  await doc.save();

  const sig = await Signature.create({
    documentId: doc._id,
    signer: req.user!.sub,
    walletAddress: walletAddress.toLowerCase(),
    signature,
    transactionHash: result.transactionHash,
    blockNumber: result.blockNumber,
    timestamp: new Date(result.timestamp * 1000),
  });

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
    },
    req,
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "SIGN",
    aktivitas: `Dokumen "${doc.namaDokumen}" berhasil ditandatangani secara digital`,
    metadata: {
      documentId: String(doc._id),
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      mock: result.mock,
    },
    req,
  });

  res.json({ success: true, document: doc, signature: sig, mock: result.mock });
});
