import mongoose, { Schema, Types } from "mongoose";
import { User } from "./User";
import { sendNotificationEmail } from "../services/notificationEmail";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
  message: { type: String, required: true, maxlength: 500 },
  readAt: { type: Date, default: null },
  emailStatus: { type: String, enum: ["disabled", "pending", "sent", "failed"], default: "disabled" },
}, { timestamps: true });
export const Notification = mongoose.model("Notification", schema);
export async function notifyDocument(users: Array<string | Types.ObjectId | undefined>, documentId: Types.ObjectId, message: string) {
  const ids = [...new Set(users.filter(Boolean).map(String))];
  if (!ids.length) return;
  const notifications = await Notification.insertMany(ids.map(userId => ({ userId, documentId, message })));
  await Promise.all(notifications.map(async notice => {
    const user = await User.findById(notice.userId).select("email");
    if (!user) return;
    try {
      const sent = await sendNotificationEmail(user.email, message, String(documentId));
      if (sent) await Notification.updateOne({ _id: notice._id }, { $set: { emailStatus: "sent" } });
    } catch {
      // SMTP failures do not lose the in-app notification or undo approval.
      await Notification.updateOne({ _id: notice._id }, { $set: { emailStatus: "failed" } });
    }
  }));
}
