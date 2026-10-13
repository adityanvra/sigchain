import { Request } from "express";
import { IDocument } from "../models/Document";
import { ApiError } from "../utils/ApiError";

export const idOf = (value: any): string => String(value?._id || value || "");
export function documentScope(req: Request): Record<string, unknown> {
  const user = req.user!;
  if (user.role === "admin") return {};
  if (user.role === "mahasiswa") return { uploader: user.sub };
  return { $or: [{ uploader: user.sub }, { assignedTo: user.sub }, { reviewer: user.sub }, { "signingSteps.signer": user.sub }] };
}
export function canReadDocument(doc: IDocument, req: Request): boolean {
  if (req.user!.role === "admin" || idOf(doc.uploader) === req.user!.sub) return true;
  if (req.user!.role === "mahasiswa") return false;
  return idOf(doc.assignedTo) === req.user!.sub || idOf(doc.reviewer) === req.user!.sub || doc.signingSteps?.some(s => idOf(s.signer) === req.user!.sub);
}
export function assertCurrentSigner(doc: IDocument, req: Request): void {
  if (req.user!.role === "mahasiswa") throw ApiError.forbidden("Mahasiswa mengajukan dokumen; pengesahan dilakukan pejabat yang dipilih");
  if (doc.supersededBy) throw ApiError.conflict("Dokumen sudah memiliki versi pengganti");
  if (doc.signingSteps?.length) {
    if (idOf(doc.signingSteps[doc.currentStep]?.signer) !== req.user!.sub) {
      throw ApiError.forbidden("Hanya penandatangan yang mendapat giliran dapat mengesahkan dokumen");
    }
  } else if (req.user!.role !== "admin" && idOf(doc.assignedTo) !== req.user!.sub &&
      !(req.user!.role === "staff_akademik" && idOf(doc.uploader) === req.user!.sub && !doc.assignedTo)) {
    throw ApiError.forbidden("Anda bukan penandatangan dokumen ini");
  }
}
