import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

/**
 * Stores a single PNG signature image for an Akademisi (staff_akademik) user.
 * Each user may have at most one active signature at a time.
 */
export interface IAcademicSignature extends MongoDoc {
  academicId: Types.ObjectId; // ref User
  imageData: Buffer;          // raw PNG bytes
  mimeType: string;           // "image/png" or "image/jpeg"
  fileName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const academicSignatureSchema = new Schema<IAcademicSignature>(
  {
    academicId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageData: { type: Buffer, required: true, select: false },
    mimeType: { type: String, required: true, default: "image/png" },
    fileName: { type: String, required: true, default: "signature.png" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const AcademicSignature = mongoose.model<IAcademicSignature>(
  "AcademicSignature",
  academicSignatureSchema
);
