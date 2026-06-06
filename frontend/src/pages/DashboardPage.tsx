import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  Clock,
  Activity,
  ArrowRight,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DashboardStats } from "@/types";

const statCards = [
  { key: "total", label: "Total Dokumen", icon: FileText, color: "text-primary bg-primary/10" },
  {
    key: "signed",
    label: "Ditandatangani",
    icon: CheckCircle2,
    color: "text-success bg-success/10",
  },
  {
    key: "unsigned",
    label: "Belum Ditandatangani",
    icon: Clock,
    color: "text-warning bg-warning/10",
  },
] as const;

export function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan dokumen dan aktivitas terbaru Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/verify">
              <ShieldCheck /> Verifikasi
            </Link>
          </Button>
          <Button asChild>
            <Link to="/upload">
              <Upload /> Upload Dokumen
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((c) => (
          <Card key={c.key} className="card-hover">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                {loading ? (
                  <Skeleton className="mt-2 h-9 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold">{data?.stats[c.key] ?? 0}</p>
                )}
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.color}`}>
                <c.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Dokumen Terbaru</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/documents">
                Lihat semua <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : data?.recentDocuments.length ? (
              data.recentDocuments.map((d) => (
                <Link
                  key={d._id}
                  to={`/documents/${d._id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.namaDokumen}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </Link>
              ))
            ) : (
              <EmptyHint />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : data?.recentActivity.length ? (
              data.recentActivity.map((a) => (
                <div key={a._id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm leading-tight">{a.aktivitas}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <FileText className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Belum ada dokumen. Mulai dengan mengunggah.</p>
      <Button asChild size="sm">
        <Link to="/upload">
          <Upload /> Upload Dokumen
        </Link>
      </Button>
    </div>
  );
}
