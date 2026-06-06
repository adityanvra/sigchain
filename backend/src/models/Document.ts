import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

export type DocStatus = "UNSIGNED" | "SIGNED";

export interface IDocument extends MongoDoc {
  namaDokumen: string;
  description?: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  hashDokumen: string;
  transactionHash?: string;
  blockNumber?: number;
  blockchainTimestamp?: Date;
  uploader: Types.ObjectId;
  status: DocStatus;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    namaDokumen: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    hashDokumen: { type: String, required: true, index: true },
    transactionHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    blockchainTimestamp: { type: Date, default: null },
    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["UNSIGNED", "SIGNED"],
      default: "UNSIGNED",
      index: true,
    },
  },
  { timestamps: true }
);

export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);
