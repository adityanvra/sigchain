import { useEffect, useState } from "react";
import {
  ScrollText,
  LogIn,
  LogOut,
  Upload,
  Trash2,
  PenLine,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AuditItem, User } from "@/types";

const actionIcon: Record<string, React.ElementType> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  UPLOAD: Upload,
  DELETE: Trash2,
  SIGN: PenLine,
  VERIFY: ShieldCheck,
  USER_CREATE: UserCog,
  USER_UPDATE: UserCog,
  USER_DELETE: UserCog,
  PROFILE_UPDATE: UserCog,
};

export function AuditPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/audit")
      .then(({ data }) => setItems(data.trails))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          {user?.role === "admin"
            ? "Riwayat seluruh aktivitas sistem."
            : "Riwayat aktivitas akun Anda."}
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada catatan audit.</p>
            </div>
          ) : (
            <div className="relative space-y-1 before:absolute before:left-[18px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {items.map((it) => {
                const Icon = actionIcon[it.action] || ScrollText;
                const actor = it.userId as User | undefined;
                return (
                  <div key={it._id} className="relative flex gap-4 rounded-lg p-2 hover:bg-muted/40">
                    <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 py-1">
                      <div>
                        <p className="text-sm font-medium">{it.aktivitas}</p>
                        <p className="text-xs text-muted-foreground">
                          {actor?.nama ? `${actor.nama} · ` : ""}
                          {formatDate(it.timestamp)}
                        </p>
                      </div>
                      <Badge variant="secondary">{it.action}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
