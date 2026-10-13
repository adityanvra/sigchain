import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
let transport: Transporter | undefined;
export async function sendNotificationEmail(to: string, message: string, documentId: string, testTransport?: Transporter): Promise<boolean> {
  if (!testTransport && (!env.SMTP_HOST || !env.SMTP_FROM)) return false;
  if (!transport && !testTransport) {
    transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 8_000 });
  }
  const base = env.PUBLIC_VERIFY_URL.replace(/\/verify\/?$/, "");
  await (testTransport || transport)!.sendMail({
    from: env.SMTP_FROM || "SIGCHAIN Test <test@example.invalid>", to,
    subject: "Pemberitahuan dokumen SIGCHAIN-UAD",
    text: `${message}\n\nBuka dokumen setelah login:\n${base}/documents/${encodeURIComponent(documentId)}\n\nLampiran PDF tidak dikirim melalui email.`,
  });
  return true;
}
