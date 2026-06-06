import { Request, Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditService";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  nama: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["admin", "staff_akademik", "staff_administrasi"]).optional(),
  walletAddress: z.string().optional(),
});

export const profileSchema = z.object({
  nama: z.string().min(2).max(120).optional(),
  walletAddress: z
    .string()
    .refine((v) => !v || ethers.isAddress(v), "Invalid wallet address")
    .optional(),
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized("Email atau password salah");
  }

  const token = signToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    nama: user.nama,
  });

  await recordAudit({
    userId: String(user._id),
    action: "LOGIN",
    aktivitas: `${user.nama} login ke sistem`,
    req,
  });

  res.json({ success: true, token, user: user.toJSON() });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof registerSchema>;
  const exists = await User.findOne({ email: data.email.toLowerCase() });
  if (exists) throw ApiError.conflict("Email sudah terdaftar");

  const user = await User.create({
    nama: data.nama,
    email: data.email.toLowerCase(),
    password: data.password,
    role: data.role || "staff_administrasi",
    walletAddress: data.walletAddress?.toLowerCase() || null,
  });

  await recordAudit({
    userId: String(user._id),
    action: "USER_CREATE",
    aktivitas: `Akun ${user.email} dibuat`,
    req,
  });

  const token = signToken({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    nama: user.nama,
  });

  res.status(201).json({ success: true, token, user: user.toJSON() });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw ApiError.notFound("User tidak ditemukan");
  res.json({ success: true, user: user.toJSON() });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as z.infer<typeof profileSchema>;
  const user = await User.findById(req.user!.sub);
  if (!user) throw ApiError.notFound("User tidak ditemukan");

  if (data.nama !== undefined) user.nama = data.nama;
  if (data.walletAddress !== undefined) user.walletAddress = data.walletAddress.toLowerCase();
  await user.save();

  await recordAudit({
    userId: String(user._id),
    action: "PROFILE_UPDATE",
    aktivitas: `${user.nama} memperbarui profil`,
    req,
  });

  res.json({ success: true, user: user.toJSON() });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await recordAudit({
      userId: req.user.sub,
      action: "LOGOUT",
      aktivitas: `${req.user.nama} logout dari sistem`,
      req,
    });
  }
  res.json({ success: true, message: "Logged out" });
});
