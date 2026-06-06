import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

export interface ISignature extends MongoDoc {
  documentId: Types.ObjectId;
  signer: Types.ObjectId;
  walletAddress: string;
  signature: string;
  transactionHash?: string;
  blockNumber?: number;
  timestamp: Date;
}

const signatureSchema = new Schema<ISignature>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    signer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    walletAddress: { type: String, required: true, lowercase: true, trim: true },
    signature: { type: String, required: true },
    transactionHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Signature = mongoose.model<ISignature>("Signature", signatureSchema);
