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
 * Step 1 — prepare. Returns everything the frontend needs to build the MetaMask
 * transaction (hash, contract address, chain). In mock mode the frontend will
 * skip MetaMask and go straight to /confirm.
 */
export const prepareSign = asyncHandler(async (req: Request, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (doc.status === "SIGNED") throw ApiError.conflict("Dokumen sudah ditandatangani");

  res.json({
    success: true,
    hash: doc.hashDokumen,
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
 * Step 2 — confirm. In real mode we wait for the MetaMask transaction receipt
 * and verify the hash is on-chain. In mock mode we anchor the hash in the
 * in-memory chain. Either way we persist the Signature + update the Document.
 */
export const confirmSign = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, signature, transactionHash } = confirmSchema.parse(req.body);

  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Dokumen tidak ditemukan");
  if (doc.status === "SIGNED") throw ApiError.conflict("Dokumen sudah ditandatangani");

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
    action: "SIGN",
    aktivitas: `Menandatangani dokumen "${doc.namaDokumen}"`,
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
