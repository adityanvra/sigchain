import { Request, Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditService";

export const createUserSchema = z.object({
  nama: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "staff_akademik", "staff_administrasi", "mahasiswa"]),
  jabatan: z.array(z.string().trim().min(2).max(120)).max(12).optional(),
  unit: z.string().trim().max(120).optional(),
  nim: z.string().trim().max(30).optional(),
  walletAddress: z
    .string()
    .refine((v) => !v || ethers.isAddress(v), "Invalid wallet address")
    .optional(),
});

export const updateUserSchema = z.object({
  nama: z.string().min(2).max(120).optional(),
  role: z.enum(["admin", "staff_akademik", "staff_administrasi", "mahasiswa"]).optional(),
  password: z.string().min(6).max(128).optional(),
  jabatan: z.array(z.string().trim().min(2).max(120)).max(12).optional(),
  unit: z.string().trim().max(120).optional(),
  nim: z.string().trim().max(30).optional(),
  walletAddress: z
    .string()
    .refine((v) => !v || ethers.isAddress(v), "Invalid wallet address")
    .optional(),
});

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, users });
});

export const listAkademisi = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find({ role: "staff_akademik" })
    .select("_id nama email role jabatan unit")
    .sort({ nama: 1 });
  res.json({ success: true, akademisi: users });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof createUserSchema>;
  const exists = await User.findOne({ email: data.email.toLowerCase() });
  if (exists) throw ApiError.conflict("Email sudah terdaftar");

  const user = await User.create({
    ...data,
    email: data.email.toLowerCase(),
    walletAddress: data.walletAddress?.toLowerCase() || null,
  });

  await recordAudit({
    userId: req.user!.sub,
    action: "USER_CREATE",
    aktivitas: `Admin membuat user ${user.email} (${user.role})`,
    req,
  });

  res.status(201).json({ success: true, user: user.toJSON() });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof updateUserSchema>;
  const user = await User.findById(req.params.id).select("+password");
  if (!user) throw ApiError.notFound("User tidak ditemukan");

  if (data.jabatan !== undefined) user.jabatan = data.jabatan;
  if (data.unit !== undefined) user.unit = data.unit;
  if (data.nim !== undefined) user.nim = data.nim;
  if (data.nama !== undefined) user.nama = data.nama;
  if (data.role !== undefined) user.role = data.role;
  if (data.password !== undefined) user.password = data.password;
  if (data.walletAddress !== undefined) user.walletAddress = data.walletAddress.toLowerCase();
  await user.save();

  await recordAudit({
    userId: req.user!.sub,
    action: "USER_UPDATE",
    aktivitas: `Admin memperbarui user ${user.email}`,
    req,
  });

  res.json({ success: true, user: user.toJSON() });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.sub) {
    throw ApiError.badRequest("Tidak dapat menghapus akun sendiri");
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw ApiError.notFound("User tidak ditemukan");

  await recordAudit({
    userId: req.user!.sub,
    action: "USER_DELETE",
    aktivitas: `Admin menghapus user ${user.email}`,
    req,
  });

  res.json({ success: true, message: "User dihapus" });
});
