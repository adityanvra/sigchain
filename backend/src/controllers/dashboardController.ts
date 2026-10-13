import { Request, Response } from "express";
import { DocumentModel } from "../models/Document";
import { AuditTrail } from "../models/AuditTrail";
import { documentScope } from "../services/documentAccess";
import { asyncHandler } from "../utils/asyncHandler";

export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const scope = documentScope(req);
  // Count all documents in scope that are "unsigned" = DRAFT + UNSIGNED + PENDING_BLOCKCHAIN
  const [total, signed, pendingBlockchain, draft, recentDocs] = await Promise.all([
    DocumentModel.countDocuments(scope),
    DocumentModel.countDocuments({ ...scope, status: "SIGNED" }),
    DocumentModel.countDocuments({ ...scope, status: "PENDING_BLOCKCHAIN" }),
    DocumentModel.countDocuments({ ...scope, status: { $in: ["DRAFT", "UNSIGNED"] } }),
    DocumentModel.find(scope)
      .populate("uploader", "nama email")
      .populate("assignedTo", "nama email")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const unsigned = total - signed; // backwards-compat stat label

  const auditScope = req.user!.role === "admin" ? {} : { userId: req.user!.sub };
  const recentActivity = await AuditTrail.find(auditScope)
    .populate("userId", "nama email")
    .sort({ timestamp: -1 })
    .limit(8);

  res.json({
    success: true,
    stats: { total, signed, unsigned, pendingBlockchain, draft },
    recentDocuments: recentDocs,
    recentActivity,
  });
});
