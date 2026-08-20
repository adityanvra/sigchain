import crypto from "crypto";
import fs from "fs";


export function sha256Buffer(buffer: Buffer): string {
  return crypto
  .createHash("sha256")
  .update(buffer)
  .digest("hex");
}


export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
