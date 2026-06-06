import QRCode from "qrcode";
import { env } from "../config/env";

/** Builds the public verification URL for a given document hash. */
export function verifyUrlFor(hash: string): string {
  const base = env.PUBLIC_VERIFY_URL.replace(/\/$/, "");
  return `${base}/${hash}`;
}

/** Returns a PNG buffer of a QR code that points to the public verify page. */
export async function qrPngBuffer(hash: string): Promise<Buffer> {
  const url = verifyUrlFor(hash);
  return QRCode.toBuffer(url, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Returns a data-URL QR code (useful for embedding directly in JSON). */
export async function qrDataUrl(hash: string): Promise<string> {
  return QRCode.toDataURL(verifyUrlFor(hash), { width: 400, margin: 2 });
}
