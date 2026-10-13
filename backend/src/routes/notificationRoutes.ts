import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { Notification } from "../models/Notification";
import { ApiError } from "../utils/ApiError";
const router = Router();
router.use(authenticate);
router.get("/", asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user!.sub }).sort({ createdAt: -1 }).limit(100);
  const unread = await Notification.countDocuments({ userId: req.user!.sub, readAt: null });
  res.json({ success: true, notifications, unread });
}));
router.put("/:id/read", asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user!.sub }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) throw ApiError.notFound("Notifikasi tidak ditemukan");
  res.json({ success: true, notification });
}));
export default router;
