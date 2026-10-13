import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Search, Upload, Eye, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { DocumentItem, DocStatus, User } from "@/types";

type Filter = "ALL" | "SIGNED" | "PENDING_BLOCKCHAIN" | "DRAFT" | "ASSIGNED_ME" | "SUBMITTED" | "NEEDS_REVISION" | "REJECTED" | "PARTIALLY_SIGNED";

export function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const statusMap: Partial<Record<Filter, DocStatus>> = {
        SUBMITTED: "SUBMITTED", NEEDS_REVISION: "NEEDS_REVISION", REJECTED: "REJECTED", PARTIALLY_SIGNED: "PARTIALLY_SIGNED",
        SIGNED: "SIGNED",
        PENDING_BLOCKCHAIN: "PENDING_BLOCKCHAIN",
        DRAFT: "DRAFT",
      };
      if (filter in statusMap) {
        params.status = statusMap[filter as keyof typeof statusMap]!;
      }
      if (q) params.q = q;
      const { data } = await api.get("/documents", { params });

      let list: DocumentItem[] = data.documents;
      if (filter === "ASSIGNED_ME" && user) {
        list = list.filter((d) => {
          const assigneeId = typeof d.assignedTo === "object" ? d.assignedTo?._id : d.assignedTo;
          return assigneeId === user._id;
        });
      }
      setDocs(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q]);

  const isAkademisi = user?.role === "staff_akademik";

  const filterButtons: { key: Filter; label: string }[] = [
    { key: "ALL", label: user?.role === "mahasiswa" ? "Pengajuan Saya" : "Semua" },
    { key: "SUBMITTED", label: "Diajukan" },
    { key: "NEEDS_REVISION", label: "Perlu Perbaikan" },
    { key: "PARTIALLY_SIGNED", label: "Dalam Persetujuan" },
    { key: "REJECTED", label: "Ditolak" },
    { key: "DRAFT", label: "Draft" },
    { key: "PENDING_BLOCKCHAIN", label: "Menunggu Blockchain" },
    { key: "SIGNED", label: "Ditandatangani" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Dokumen</h1>
          <p className="text-sm text-muted-foreground">Kelola, tinjau, dan tandatangani dokumen akademik.</p>
        </div>
        <Button asChild>
          <Link to="/upload">
            <Upload className="mr-1.5 h-4 w-4" /> Upload Dokumen
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama dokumen…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {filterButtons.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              {isAkademisi && (
                <button
                  type="button"
                  onClick={() => setFilter("ASSIGNED_ME")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === "ASSIGNED_ME"
                      ? "bg-background shadow-sm text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Ditugaskan ke Saya
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Tidak ada dokumen</p>
              <p className="text-sm text-muted-foreground">Coba ubah filter atau unggah dokumen baru.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Ditugaskan Kepada</TableHead>
                  <TableHead className="hidden md:table-cell">Ukuran</TableHead>
                  <TableHead className="hidden lg:table-cell">Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => {
                  const assignee = d.assignedTo as User | undefined;
                  const isAssignedToMe = user && assignee && assignee._id === user._id;

                  return (
                    <TableRow key={d._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.namaDokumen}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {d.hashDokumen ? `${d.hashDokumen.slice(0, 20)}…` : <span className="italic">Belum ada hash</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{assignee.nama}</p>
                              {isAssignedToMe && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/40 text-primary bg-primary/5">
                                  Anda
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Belum Ditugaskan</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatBytes(d.fileSize)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {formatDate(d.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/documents/${d._id}`}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
