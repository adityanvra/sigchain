import mongoose, { Document as MongoDoc, Schema, Types } from "mongoose";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "UPLOAD"
  | "DELETE"
  | "SIGN"
  | "VERIFY"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_DELETE"
  | "PROFILE_UPDATE";

export interface IAuditTrail extends MongoDoc {
  userId?: Types.ObjectId;
  aktivitas: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Date;
}

const auditTrailSchema = new Schema<IAuditTrail>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    aktivitas: { type: String, required: true },
    action: {
      type: String,
      enum: [
        "LOGIN",
        "LOGOUT",
        "UPLOAD",
        "DELETE",
        "SIGN",
        "VERIFY",
        "USER_CREATE",
        "USER_UPDATE",
        "USER_DELETE",
        "PROFILE_UPDATE",
      ],
      required: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AuditTrail = mongoose.model<IAuditTrail>("AuditTrail", auditTrailSchema);
