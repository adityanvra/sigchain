import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

/**
 * Document lifecycle:
 *  DRAFT              → uploaded, no signature, no hash yet
 *  PENDING_BLOCKCHAIN → PDF final ready, waiting for server-side anchoring
 *  SIGNED             → hash anchored on-chain
 *
 * Legacy status `UNSIGNED` is kept for backward-compat with existing records.
 */
export type DocStatus = "DRAFT" | "UNSIGNED" | "SUBMITTED" | "READY_TO_SIGN" | "PARTIALLY_SIGNED" | "PENDING_APPROVAL" | "NEEDS_REVISION" | "REJECTED" | "PENDING_BLOCKCHAIN" | "SIGNED";

export interface SigningStep {
  signer: Types.ObjectId;
  capacity: string;
  status: "WAITING" | "READY" | "APPLIED" | "APPROVED";
  position?: SignaturePosition;
  appliedAt?: Date;
  approvedAt?: Date;
  hash?: string;
}

export interface SignaturePosition {
  page: number;   // 0-indexed page number in the PDF
  x: number;      // distance from left edge (points)
  y: number;      // distance from top edge (points, PDF-lib uses bottom-origin, we convert server-side)
  width: number;  // image width in points
  height: number; // image height in points
}

export interface IDocument extends MongoDoc {
  namaDokumen: string;
  description?: string;
  // Draft PDF (always stored)
  draftFileData?: Buffer;
  requestFileData?: Buffer;
  // Final PDF after visual signature + QR are embedded
  signedFileData?: Buffer;
  // Legacy / compat alias kept so old download routes still work
  fileData?: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  // SHA-256 of the *final* signed PDF (empty string until apply-signature is called)
  hashDokumen: string;
  transactionHash?: string;
  blockNumber?: number;
  blockchainTimestamp?: Date;
  walletAddress?: string;
  recordingMethod?: "browser_wallet" | "server_wallet";
  blockchainLockUntil?: Date;
  approvalUserId?: Types.ObjectId;
  approvalAt?: Date;
  uploader: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  reviewer?: Types.ObjectId;
  signingSteps: SigningStep[];
  currentStep: number;
  workflowVersion: number;
  reviewReason?: string;
  version: number;
  previousVersionId?: Types.ObjectId;
  supersededBy?: Types.ObjectId;
  documentType?: string;
  hasRequestFile?: boolean;
  signaturePosition?: SignaturePosition;
  status: DocStatus;
  createdAt: Date;
  updatedAt: Date;
}

const signaturePositionSchema = new Schema<SignaturePosition>(
  {
    page: { type: Number, required: true, default: 0 },
    x: { type: Number, required: true, default: 0 },
    y: { type: Number, required: true, default: 0 },
    width: { type: Number, required: true, default: 150 },
    height: { type: Number, required: true, default: 60 },
  },
  { _id: false }
);

const documentSchema = new Schema<IDocument>(
  {
    namaDokumen: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },

    // Draft PDF — stored as binary in MongoDB
    draftFileData: { type: Buffer, select: false },
    requestFileData: { type: Buffer, select: false },
    // Signed PDF final (after visual sig + QR applied)
    signedFileData: { type: Buffer, select: false },
    // Alias kept for any legacy code that still references fileData
    fileData: { type: Buffer, select: false },

    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },

    // Hash of the FINAL signed PDF.  Empty until apply-signature step.
    hashDokumen: { type: String, default: "", index: true },

    transactionHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    blockchainTimestamp: { type: Date, default: null },
    walletAddress: { type: String, default: null, lowercase: true, trim: true },
    recordingMethod: { type: String, enum: ["browser_wallet", "server_wallet"], default: "browser_wallet" },
    blockchainLockUntil: { type: Date, default: null },
    approvalUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvalAt: { type: Date, default: null },

    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    signingSteps: { type: [{
      signer: { type: Schema.Types.ObjectId, ref: "User", required: true },
      capacity: { type: String, required: true, trim: true, maxlength: 120 },
      status: { type: String, enum: ["WAITING", "READY", "APPLIED", "APPROVED"], default: "WAITING" },
      position: { type: signaturePositionSchema, default: null },
      appliedAt: Date, approvedAt: Date, hash: String,
    }], default: [] },
    currentStep: { type: Number, default: 0 },
    workflowVersion: { type: Number, default: 0 },
    reviewReason: { type: String, default: "", maxlength: 2000 },
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: "Document", default: null },
    supersededBy: { type: Schema.Types.ObjectId, ref: "Document", default: null },
    documentType: { type: String, default: "Dokumen akademik", maxlength: 120 },
    hasRequestFile: { type: Boolean, default: false },

    signaturePosition: { type: signaturePositionSchema, default: null },

    status: {
      type: String,
      enum: ["DRAFT", "UNSIGNED", "SUBMITTED", "READY_TO_SIGN", "PARTIALLY_SIGNED", "PENDING_APPROVAL", "NEEDS_REVISION", "REJECTED", "PENDING_BLOCKCHAIN", "SIGNED"],
      default: "DRAFT",
      index: true,
    },
  },
  { timestamps: true }
);

documentSchema.set("toJSON", { transform: (_doc, ret) => {
  delete ret.draftFileData; delete ret.signedFileData; delete ret.requestFileData; delete ret.fileData;
  return ret;
} });
export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);
