import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, Loader2, Hash, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, apiErrorMessage } from "@/lib/api";
import { sha256File } from "@/lib/crypto";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [nama, setNama] = useState("");
  const [description, setDescription] = useState("");
  const [hashing, setHashing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(f: File) {
    if (f.type !== "application/pdf") {
      toast.error("Hanya file PDF yang diperbolehkan");
      return;
    }
    setFile(f);
    if (!nama) setNama(f.name.replace(/\.pdf$/i, ""));
    setHashing(true);
    try {
      setHash(await sha256File(f));
    } finally {
      setHashing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pilih file PDF terlebih dahulu");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("namaDokumen", nama);
      form.append("description", description);
      const { data } = await api.post("/documents", form);
      toast.success("Dokumen berhasil diunggah");
      navigate(`/documents/${data.document._id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Upload gagal"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Dokumen</h1>
        <p className="text-sm text-muted-foreground">
          Unggah berkas PDF. Hash SHA-256 dihitung otomatis di browser Anda.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardContent className="p-6">
            {!file ? (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragOver ? "border-primary bg-accent/40" : "border-input bg-muted/30 hover:border-primary"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-medium">Klik atau jatuhkan file PDF di sini</p>
                  <p className="text-sm text-muted-foreground">Maksimal 15 MB · hanya PDF</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFile(null);
                      setHash("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-lg border bg-accent/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Hash className="h-3 w-3" /> SHA-256
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {hashing ? "Menghitung hash…" : hash}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata Dokumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Dokumen</Label>
              <Input
                id="nama"
                required
                placeholder="Contoh: SK Pengangkatan Dosen 2026"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Deskripsi (opsional)</Label>
              <Textarea
                id="desc"
                placeholder="Keterangan singkat dokumen…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/documents")}>
            Batal
          </Button>
          <Button type="submit" disabled={uploading || hashing || !file}>
            {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud />} Upload Dokumen
          </Button>
        </div>
      </form>
    </div>
  );
}
