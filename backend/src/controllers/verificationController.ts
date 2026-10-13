import { DocumentModel } from "../models/Document";
import { Signature } from "../models/Signature";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { sha256Buffer } from "../services/hashService";
import { blockchain } from "../services/blockchainService";
import { recordAudit } from "../services/auditService";
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-f0-9]{24}$/i;
async function buildResult(hash: string | null, referenceId?: string) {
  if (referenceId && !idPattern.test(referenceId)) throw ApiError.badRequest("ID referensi dokumen tidak valid");
  const doc = referenceId ? await DocumentModel.findById(referenceId) : hash ? await DocumentModel.findOne({ hashDokumen: hash }) : null;
  if (referenceId && !doc) throw ApiError.notFound("Referensi dokumen tidak ditemukan");
  const referenceHash = doc?.hashDokumen || null;
  const expectedHash = referenceId ? referenceHash : hash;
  const cfg = blockchain.config();
  let outcome = "NOT_REGISTERED";
  let reason = "Hash tidak terdaftar. Tanpa referensi dokumen, sistem tidak dapat menyimpulkan berkas ini berasal dari dokumen yang berubah.";
  let onChain = { exists: false, signer: null as string | null, blockNumber: null as number | null, timestamp: null as number | null };
  if (doc && doc.status !== "SIGNED") {
    outcome = "PENDING";
    reason = "Dokumen referensi belum selesai disahkan dan dicatat. Ini bukan bukti bahwa file dipalsukan.";
  } else if (expectedHash) {
    try {
      onChain = await blockchain.getRecord(expectedHash);
      if (onChain.exists) {
        outcome = referenceId && hash && hash !== referenceHash ? "DIFFERENT" : "MATCH";
        reason = outcome === "MATCH" ? "Hash sesuai catatan. Pada tautan QR, hasil ini adalah status dokumen referensi; unggah PDF Anda untuk membandingkan berkasnya."
          : "Hash berkas unggahan berbeda dari referensi. Perbedaan byte dapat berasal dari perubahan isi, metadata, atau penyimpanan ulang PDF.";
      }
    } catch {
      outcome = "NETWORK_ERROR";
      reason = "Koneksi blockchain gagal. Keabsahan dokumen belum dapat ditentukan; coba kembali setelah jaringan pulih.";
    }
  }
  const valid = outcome === "MATCH";
  const signatures = doc ? await Signature.find({ documentId: doc._id }).select("signer capacity stepIndex recordingMethod approvedAt timestamp walletAddress").populate("signer", "nama").sort({ stepIndex: 1, timestamp: 1 }) : [];
  return {
    valid, status: valid ? "VALID" : outcome === "PENDING" ? "BELUM SELESAI" : outcome === "NETWORK_ERROR" ? "GAGAL DIPERIKSA" : outcome === "NOT_REGISTERED" ? "TIDAK TERDAFTAR" : "TIDAK VALID",
    outcome, reason, hash, referenceHash, checkedFile: Boolean(hash),
    onChain: { ...onChain, explorer: !cfg.mock && doc?.status === "SIGNED" && doc.transactionHash && cfg.blockExplorer ? `${cfg.blockExplorer}/tx/${doc.transactionHash}` : null },
    document: doc ? { id: doc._id, namaDokumen: doc.namaDokumen, status: doc.status, version: doc.version, previousVersionId: doc.previousVersionId, supersededBy: doc.supersededBy,
      transactionHash: doc.transactionHash, blockNumber: doc.blockNumber, blockchainTimestamp: doc.blockchainTimestamp, walletAddress: doc.walletAddress, recordingMethod: doc.recordingMethod } : null,
    signatures, mock: cfg.mock,
  };
}
export const verifyByHash = asyncHandler(async (req, res) => {
  const hash = String(req.params.hash || "").toLowerCase();
  if (!hashPattern.test(hash)) throw ApiError.badRequest("Format hash tidak valid (SHA-256)");
  res.json({ success: true, ...await buildResult(hash, req.query.documentId ? String(req.query.documentId) : undefined) });
});
export const verifyByDocumentId = asyncHandler(async (req, res) => {
  res.json({ success: true, ...await buildResult(null, String(req.params.id)) });
});
export const verifyByUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("File PDF wajib diunggah untuk verifikasi");
  const hash = sha256Buffer(req.file.buffer);
  const result = await buildResult(hash, req.body.documentId ? String(req.body.documentId) : undefined);
  await recordAudit({ action: "VERIFY", aktivitas: `Verifikasi unggahan: ${result.outcome}`, metadata: { hash, referenceId: req.body.documentId, outcome: result.outcome }, req });
  res.json({ success: true, ...result });
});
