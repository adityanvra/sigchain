// Isolated UI verification server: no user database or public-chain credentials.
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PDFDocument } from "pdf-lib";

async function main() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "isolated-ui-preview-test-secret";
  process.env.MONGODB_URI = "";
  process.env.SMTP_HOST = "";
  process.env.SMTP_FROM = "";
  process.env.SEPOLIA_RPC_URL = "";
  process.env.CONTRACT_ADDRESS = "";
  process.env.BLOCKCHAIN_PRIVATE_KEY = "";
  process.env.CORS_ORIGINS = "http://localhost:18517,http://127.0.0.1:18517";
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../src/app");
  const { ensureDemoUsers } = await import("../src/seed/demoUsers");
  const { User } = await import("../src/models/User");
  const { AcademicSignature } = await import("../src/models/AcademicSignature");
  const { DocumentModel } = await import("../src/models/Document");
  await ensureDemoUsers(false);
  await User.create({ nama: "Pejabat Fakultas Uji", email: "dekan@test.invalid", password: "password123", role: "staff_akademik", jabatan: ["Dekan", "Kaprodi"], unit: "FTI" });
  await User.updateOne({ email: "akademik@uad.ac.id" }, { $set: { unit: "FTI", jabatan: ["Dosen"] } });
  const student = await User.findOne({ email: "mahasiswa@uad.ac.id" });
  const user = await User.findOne({ email: "akademik@uad.ac.id" });
  await AcademicSignature.create({ academicId: user!._id, fileName: "uji.png", mimeType: "image/png", active: true,
    imageData: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=", "base64") });
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.drawText("SIGCHAIN-UAD: Dokumen Uji Pengesahan Server", { x: 40, y: 740, size: 16 });
  page.drawText("Dokumen ini digunakan untuk pengujian aplikasi, bukan surat resmi.", { x: 40, y: 710, size: 11 });
  const bytes = Buffer.from(await pdf.save());
  const doc = await DocumentModel.create({ namaDokumen: "Pengajuan Mahasiswa - Uji Revisi Semhas", uploader: student!._id, draftFileData: bytes,
    fileData: bytes, fileName: "uji-pengesahan-server.pdf", mimeType: "application/pdf", fileSize: bytes.length, status: "DRAFT" });
  const server = createApp().listen(18500, "127.0.0.1", () => console.log(`Isolated UI test API: http://127.0.0.1:18500/api; document ${doc._id}`));
  const stop = async () => { server.close(); await mongoose.disconnect(); await mongo.stop(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch(() => { console.error("Isolated preview startup failed"); process.exit(1); });
