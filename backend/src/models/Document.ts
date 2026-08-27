import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

/**
 * Document lifecycle:
 *  DRAFT              → uploaded, no signature, no hash yet
 *  PENDING_BLOCKCHAIN → visual signature applied, PDF final ready, hash computed — waiting for MetaMask tx
 *  SIGNED             → hash anchored on-chain
 *
 * Legacy status `UNSIGNED` is kept for backward-compat with existing records.
 */
export type DocStatus = "DRAFT" | "UNSIGNED" | "PENDING_BLOCKCHAIN" | "SIGNED";

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
  uploader: Types.ObjectId;
  assignedTo?: Types.ObjectId;
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

    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    signaturePosition: { type: signaturePositionSchema, default: null },

    status: {
      type: String,
      enum: ["DRAFT", "UNSIGNED", "PENDING_BLOCKCHAIN", "SIGNED"],
      default: "DRAFT",
      index: true,
    },
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);
