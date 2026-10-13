import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, PenLine, UploadCloud, Trash2, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, apiErrorMessage, getToken } from "@/lib/api";
import { config } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/utils";
import type { AcademicSignature } from "@/types";
import { toast } from "sonner";

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [nama, setNama] = useState(user?.nama || "");
  const [saving, setSaving] = useState(false);

  // Signature state
  const [signature, setSignature] = useState<AcademicSignature | null>(null);
  const [loadingSig, setLoadingSig] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [deletingSig, setDeletingSig] = useState(false);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAkademisi = user?.role !== "mahasiswa";

  const initials = (user?.nama || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const loadSignature = useCallback(async () => {
    if (!isAkademisi) return;
    setLoadingSig(true);
    // Revoke previous blob URL to prevent memory leak
    setSigPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const { data } = await api.get("/academic-signatures/my");
      setSignature(data.signature || null);
      if (data.signature) {
        // Fetch image dengan Authorization header lalu buat blob URL
        // (elemen <img src="..."> tidak bisa mengirim header auth secara langsung)
        const token = getToken();
        const res = await fetch(`${config.apiUrl}/academic-signatures/my/image`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          setSigPreviewUrl(URL.createObjectURL(blob));
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoadingSig(false);
    }
  }, [isAkademisi]);


  useEffect(() => {
    loadSignature();
  }, [loadSignature]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/profile", {
        nama,
      });
      setUser(data.user);
      toast.success("Profil diperbarui");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal memperbarui profil"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSig(true);
    try {
      const form = new FormData();
      form.append("image", file);
      await api.post("/academic-signatures", form);
      toast.success("Tanda tangan berhasil diunggah");
      await loadSignature();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal mengunggah tanda tangan"));
    } finally {
      setUploadingSig(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSignatureDelete() {
    if (!signature) return;
    if (!confirm("Hapus tanda tangan ini? Anda perlu mengunggah tanda tangan baru untuk menandatangani dokumen.")) return;

    setDeletingSig(true);
    try {
      await api.delete(`/academic-signatures/${signature._id}`);
      setSignature(null);
      setSigPreviewUrl(null);
      toast.success("Tanda tangan dihapus");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menghapus tanda tangan"));
    } finally {
      setDeletingSig(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Pengguna</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi akun, wallet, dan tanda tangan digital Anda.</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user?.nama}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge className="mt-1">{roleLabel[user?.role || ""]}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email} disabled />
            </div>
            <p className="text-sm text-muted-foreground">
              Persetujuan dokumen dicatat atas akun Anda. Pencatatan blockchain diproses otomatis oleh server.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Simpan Perubahan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Signature section — only for Akademisi & Admin */}
      {isAkademisi && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PenLine className="h-4 w-4 text-primary" /> Tanda Tangan Saya
            </CardTitle>
            <CardDescription>
              Unggah gambar tanda tangan (PNG transparan) yang akan digunakan saat menandatangani
              dokumen secara visual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSig ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat tanda tangan…
              </div>
            ) : signature && sigPreviewUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="gap-1">
                    <PenLine className="h-3 w-3" /> Tanda tangan aktif
                  </Badge>
                  <span className="text-xs text-muted-foreground">{signature.fileName}</span>
                </div>
                {/* Preview box */}
                <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30 p-4">
                  <img
                    src={`${config.apiUrl}/academic-signatures/my/image`}
                    alt="Tanda Tangan"
                    className="max-h-24 max-w-[300px] object-contain"
                    style={{ background: "repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 0 0 / 12px 12px" }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingSig}
                  >
                    {uploadingSig ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Ganti Tanda Tangan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleSignatureDelete}
                    disabled={deletingSig}
                  >
                    {deletingSig ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Hapus
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-muted/30 p-8 text-center transition-colors hover:border-primary hover:bg-muted/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Klik untuk unggah tanda tangan</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG transparan direkomendasikan · Maks 2 MB
                    </p>
                  </div>
                </div>
                {uploadingSig && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Mengunggah…
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleSignatureUpload}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
