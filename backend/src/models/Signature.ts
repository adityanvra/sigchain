import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

export interface ISignature extends MongoDoc {
  documentId: Types.ObjectId;
  signer: Types.ObjectId;
  walletAddress: string;
  signature: string;
  recordingMethod?: "browser_wallet" | "server_wallet" | "account_approval";
  stepIndex?: number;
  capacity?: string;
  approvalMessage?: string;
  approvedAt?: Date;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: Date;
}

const signatureSchema = new Schema<ISignature>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    signer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    walletAddress: { type: String, default: null, lowercase: true, trim: true },
    signature: { type: String, required: true },
    recordingMethod: { type: String, enum: ["browser_wallet", "server_wallet", "account_approval"], default: "browser_wallet" },
    stepIndex: { type: Number, default: null },
    capacity: { type: String, default: "", maxlength: 120 },
    approvalMessage: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    transactionHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Signature = mongoose.model<ISignature>("Signature", signatureSchema);
