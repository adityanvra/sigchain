import { Request, Response } from "express";
import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sha256Buffer } from "../services/hashService";
import { blockchain } from "../services/blockchainService";
import { recordAudit } from "../services/auditService";

async function buildResult(hash: string) {
  const onChain = await blockchain.getRecord(hash);
  const doc = await DocumentModel.findOne({ hashDokumen: hash }).populate(
    "uploader",
    "nama email role"
  );
  const signatures = doc
    ? await Signature.find({ documentId: doc._id }).populate("signer", "nama email")
    : [];

  const valid = onChain.exists;
  const cfg = blockchain.config();

  return {
    valid,
    status: valid ? "VALID" : "TIDAK VALID",
    hash,
    onChain: {
      ...onChain,
      explorer:
        doc?.transactionHash && cfg.blockExplorer
          ? `${cfg.blockExplorer}/tx/${doc.transactionHash}`
          : null,
    },
    document: doc
      ? {
          id: doc._id,
          namaDokumen: doc.namaDokumen,
          status: doc.status,
          transactionHash: doc.transactionHash,
          blockNumber: doc.blockNumber,
          blockchainTimestamp: doc.blockchainTimestamp,
          uploader: doc.uploader,
          createdAt: doc.createdAt,
        }
      : null,
    signatures,
    mock: cfg.mock,
  };
}

/** Public verification by hash (used by QR codes — no auth required). */
export const verifyByHash = asyncHandler(async (req: Request, res: Response) => {
  const hash = String(req.params.hash || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw ApiError.badRequest("Format hash tidak valid (SHA-256)");

  const result = await buildResult(hash);
  res.json({ success: true, ...result });
});

/** Verification by re-uploading a PDF. The file is hashed in-memory, not stored. */
export const verifyByUpload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah untuk verifikasi");
  const hash = sha256Buffer(req.file.buffer);
  const result = await buildResult(hash);

  await recordAudit({
    userId: req.user?.sub,
    action: "VERIFY",
    aktivitas: `Verifikasi dokumen via unggah PDF — hasil: ${result.status}`,
    metadata: { hash, valid: result.valid },
    req,
  });

  res.json({ success: true, ...result });
});
