import { Request, Response } from "express";
import { AuditTrail } from "../models/AuditTrail";
import { asyncHandler } from "../utils/asyncHandler";

/** Admins see the whole trail; other roles see only their own activity. */
export const listAudit = asyncHandler(async (req: Request, res: Response) => {
  const filter = req.user!.role === "admin" ? {} : { userId: req.user!.sub };
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const trails = await AuditTrail.find(filter)
    .populate("userId", "nama email role")
    .sort({ timestamp: -1 })
    .limit(limit);

  res.json({ success: true, trails });
});

export const myAudit = asyncHandler(async (req: Request, res: Response) => {
  const trails = await AuditTrail.find({ userId: req.user!.sub })
    .sort({ timestamp: -1 })
    .limit(200);
  res.json({ success: true, trails });
});
