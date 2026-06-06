import { Request, Response } from "express";
import { DocumentModel } from "../models/Document";
import { AuditTrail } from "../models/AuditTrail";
import { asyncHandler } from "../utils/asyncHandler";

export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const scope = req.user!.role === "admin" ? {} : { uploader: req.user!.sub };

  const [total, signed, unsigned, recentDocs] = await Promise.all([
    DocumentModel.countDocuments(scope),
    DocumentModel.countDocuments({ ...scope, status: "SIGNED" }),
    DocumentModel.countDocuments({ ...scope, status: "UNSIGNED" }),
    DocumentModel.find(scope)
      .populate("uploader", "nama email")
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const auditScope = req.user!.role === "admin" ? {} : { userId: req.user!.sub };
  const recentActivity = await AuditTrail.find(auditScope)
    .populate("userId", "nama email")
    .sort({ timestamp: -1 })
    .limit(8);

  res.json({
    success: true,
    stats: { total, signed, unsigned },
    recentDocuments: recentDocs,
    recentActivity,
  });
});
