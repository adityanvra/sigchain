import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, FileText, Loader2 } from "lucide-react";
import type { DocStatus } from "@/types";

const statusConfig: Record<
  DocStatus,
  { label: string; variant: "success" | "warning" | "secondary" | "outline"; icon: React.ReactNode }
> = {
  SUBMITTED: { label: "Diajukan ke TU", variant: "warning", icon: <Clock className="h-3 w-3" /> },
  READY_TO_SIGN: { label: "Siap Ditandatangani", variant: "outline", icon: <FileText className="h-3 w-3" /> },
  PARTIALLY_SIGNED: { label: "Menunggu Penandatangan Berikutnya", variant: "warning", icon: <Clock className="h-3 w-3" /> },
  PENDING_APPROVAL: { label: "Menunggu Persetujuan Tahap", variant: "warning", icon: <Clock className="h-3 w-3" /> },
  NEEDS_REVISION: { label: "Perlu Perbaikan", variant: "warning", icon: <FileText className="h-3 w-3" /> },
  REJECTED: { label: "Ditolak", variant: "secondary", icon: <FileText className="h-3 w-3" /> },
  SIGNED: {
    label: "Ditandatangani",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PENDING_BLOCKCHAIN: {
    label: "Menunggu Blockchain",
    variant: "warning",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: <FileText className="h-3 w-3" />,
  },
  UNSIGNED: {
    label: "Draft",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
};

export function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}
