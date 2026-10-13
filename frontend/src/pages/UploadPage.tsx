import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Loader2,
  X,
  UserCheck,
  Plus,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiErrorMessage } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import type { User } from "@/types";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

interface FileEntry {
  id: string;
  file: File;
  namaDokumen: string;
  description: string;
  assignedTo: string; // user id or "unassigned"
}

export function UploadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStudent = user?.role === "mahasiswa";
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [akademisiList, setAkademisiList] = useState<User[]>([]);
  const [globalAssignee, setGlobalAssignee] = useState<string>("unassigned");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Fetch list of Akademisi
  useEffect(() => {
    async function fetchAkademisi() {
      try {
        const { data } = await api.get("/users/akademisi");
        setAkademisiList(data.akademisi || []);
      } catch (err) {
        console.error("Gagal mengambil daftar akademisi:", err);
      }
    }
    fetchAkademisi();
  }, []);

  async function processFiles(files: FileList | File[]) {
    const validFiles: File[] = [];
    const MAX_FILE_BYTES = 4.5 * 1024 * 1024; // 4.5 MB

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast.error(`"${f.name}" dilewati: Hanya format PDF yang diperbolehkan`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" dilewati: Ukuran berkas (${formatBytes(f.size)}) melebihi batas maksimal 4.5 MB`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    const newEntries: FileEntry[] = validFiles.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      namaDokumen: f.name.replace(/\.pdf$/i, ""),
      description: "",
      assignedTo: globalAssignee !== "unassigned" ? globalAssignee : "unassigned",
    }));

    setFileEntries((prev) => [...prev, ...newEntries]);
  }

  function removeEntry(id: string) {
    setFileEntries((prev) => prev.filter((item) => item.id !== id));
  }

  function updateEntry(id: string, updates: Partial<FileEntry>) {
    setFileEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  function applyGlobalAssignee(assigneeId: string) {
    setGlobalAssignee(assigneeId);
    if (assigneeId !== "unassigned") {
      setFileEntries((prev) =>
        prev.map((item) => ({ ...item, assignedTo: assigneeId }))
      );
      const name = akademisiList.find((u) => u._id === assigneeId)?.nama;
      toast.info(`Semua dokumen ditugaskan ke: ${name || "Akademisi"}`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fileEntries.length === 0) {
      toast.error("Pilih setidaknya satu berkas draft PDF");
      return;
    }

    setUploading(true);
    try {
      if (fileEntries.length === 1) {
        // Single upload
        const entry = fileEntries[0];
        const form = new FormData();
        form.append("file", entry.file);
        form.append("namaDokumen", entry.namaDokumen);
        form.append("description", entry.description);
        if (!isStudent && entry.assignedTo && entry.assignedTo !== "unassigned") {
          form.append("assignedTo", entry.assignedTo);
        }

        const { data } = await api.post("/documents", form);
        toast.success("Draft dokumen berhasil diunggah");
        navigate(`/documents/${data.document._id}`);
      } else {
        // Bulk upload
        const form = new FormData();
        const assignments: Record<string, { namaDokumen: string; description: string; assignedTo?: string }> = {};

        fileEntries.forEach((entry, idx) => {
          form.append("files", entry.file);
          assignments[String(idx)] = {
            namaDokumen: entry.namaDokumen,
            description: entry.description,
            assignedTo: !isStudent && entry.assignedTo !== "unassigned" ? entry.assignedTo : undefined,
          };
        });

        form.append("assignments", JSON.stringify(assignments));

        const { data } = await api.post("/documents/bulk", form);
        toast.success(`${data.count || fileEntries.length} draft dokumen berhasil diunggah`);
        navigate("/documents");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal mengunggah dokumen"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload Draft Dokumen</h1>
          <p className="text-sm text-muted-foreground">
            Unggah PDF permohonan atau dokumen akademik. Setelah diunggah, buka detail untuk mengatur pemeriksa TU dan urutan penandatangan.
          </p>
        </div>
        {fileEntries.length > 0 && (
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            <Layers className="mr-1.5 h-3.5 w-3.5 text-primary" />
            {fileEntries.length} berkas dipilih
          </Badge>
        )}
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Dropzone Card */}
        <Card>
          <CardContent className="p-6">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-accent/40"
                  : "border-input bg-muted/30 hover:border-primary"
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold">Klik atau seret berkas draft PDF ke sini</p>
                <p className="text-sm text-muted-foreground">
                  Mendukung upload tunggal &amp; banyak berkas sekaligus (Maksimal 4.5 MB per berkas)
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
            </label>
          </CardContent>
        </Card>

        {/* Global Batch Assignment Bar when files exist */}
        {fileEntries.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <UserCheck className="h-4 w-4 text-primary" />
                Penugasan Penandatangan (Akademisi / Dosen)
              </CardTitle>
              <CardDescription>
                Pilih Akademisi yang bertugas memeriksa dan menandatangani dokumen melalui editor visual dan blockchain Sepolia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="bulk-assign" className="text-sm font-medium whitespace-nowrap">
                  Tugaskan Semua Berkas ke:
                </Label>
                <div className="min-w-[280px] flex-1">
                  <Select disabled={isStudent}
                    value={globalAssignee}
                    onValueChange={(val) => applyGlobalAssignee(val)}
                  >
                    <SelectTrigger id="bulk-assign" className="bg-background">
                      <SelectValue placeholder="Pilih Akademisi untuk semua berkas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">-- Belum Ditugaskan --</SelectItem>
                      {akademisiList.map((ak) => (
                        <SelectItem key={ak._id} value={ak._id}>
                          {ak.nama} ({ak.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Entries List */}
        {fileEntries.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                Daftar Draft Dokumen yang Akan Diunggah ({fileEntries.length})
              </h2>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" type="button" asChild>
                  <span>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Berkas Lagi
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files && processFiles(e.target.files)}
                />
              </label>
            </div>

            <div className="space-y-3">
              {fileEntries.map((entry, index) => (
                <Card key={entry.id} className="relative overflow-hidden border shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm">
                            #{index + 1} {entry.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ukuran: {formatBytes(entry.file.size)} · Status awal: <span className="font-medium text-foreground">Draft</span>
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Metadata fields */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Nama Dokumen</Label>
                        <Input
                          required
                          value={entry.namaDokumen}
                          onChange={(e) => updateEntry(entry.id, { namaDokumen: e.target.value })}
                          placeholder="Nama dokumen resmi..."
                          className="h-9 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Ditugaskan Kepada</Label>
                        <Select disabled={isStudent}
                          value={entry.assignedTo}
                          onValueChange={(val) => updateEntry(entry.id, { assignedTo: val })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Pilih Akademisi penandatangan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">-- Belum Ditugaskan --</SelectItem>
                            {akademisiList.map((ak) => (
                              <SelectItem key={ak._id} value={ak._id}>
                                {ak.nama}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Deskripsi / Keterangan (Opsional)</Label>
                      <Input
                        value={entry.description}
                        onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                        placeholder="Contoh: Surat Keputusan Pembimbing Skripsi 2026"
                        className="h-8 text-xs text-muted-foreground"
                      />
                    </div>

                    {/* Alur Info Note */}
                    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary shrink-0" />
                      <span>
                        Hash SHA-256 akan otomatis dihitung pada <strong>PDF final</strong> setelah tanda tangan visual ditempatkan di editor.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/documents")}
            disabled={uploading}
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={uploading || fileEntries.length === 0}
            className="min-w-[170px]"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengunggah ({fileEntries.length})…
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                {fileEntries.length > 1
                  ? `Upload ${fileEntries.length} Draft Dokumen (Massal)`
                  : "Upload Draft Dokumen"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
