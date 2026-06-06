import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import type { DocStatus } from "@/types";

export function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "SIGNED") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Ditandatangani
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1">
      <Clock className="h-3 w-3" /> Belum ditandatangani
    </Badge>
  );
}
