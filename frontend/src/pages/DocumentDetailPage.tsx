import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Download,
  Trash2,
  PenLine,
  Loader2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Wallet,
  Hash,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { api, apiErrorMessage, getToken } from "@/lib/api";
import { config } from "@/lib/config";
import { connectWallet, ensureChain, hasMetaMask, signHashMessage, storeHashOnChain } from "@/lib/wallet";
import { formatBytes, formatDate, roleLabel, shortAddress } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { DocumentItem, SignatureItem, User } from "@/types";
import { toast } from "sonner";

interface DetailResponse {
  document: DocumentItem;
  signatures: SignatureItem[];
  qrCode: string;
  verifyUrl: string;
  explorer: string | null;
}

const DEMO_WALLET = "0x1111111111111111111111111111111111111111";

export function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signStep, setSignStep] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setData(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal memuat dokumen"));
      navigate("/documents");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const fileUrl = `${config.apiUrl}/documents/${id}/file`;
  const canSign = user && (user.role === "admin" || user.role === "staff_akademik");
  const uploader = data?.document.uploader as User | undefined;

  async function handleSign() {
    if (!data) return;
    setSigning(true);
    setSignOpen(true);
    try {
      setSignStep("Menyiapkan data tanda tangan…");
      const { data: prep } = await api.post(`/documents/${id}/sign/prepare`);
      const hash: string = prep.hash;
      const mock: boolean = prep.mock;

      let walletAddress = DEMO_WALLET;
      let signature = `demo-signature-${Date.now()}`;

      if (hasMetaMask()) {
        setSignStep("Menghubungkan MetaMask…");
        walletAddress = await connectWallet();
        if (!mock) {
          setSignStep("Memastikan jaringan Sepolia…");
          await ensureChain();
        }
        setSignStep("Menandatangani hash dengan wallet…");
        const signed = await signHashMessage(hash);
        walletAddress = signed.address;
        signature = signed.signature;
      } else if (!mock) {
        throw new Error("MetaMask tidak terdeteksi. Pasang MetaMask untuk menandatangani di blockchain.");
      } else {
        setSignStep("Mode demo tanpa MetaMask — menggunakan wallet simulasi…");
      }

      const payload: Record<string, unknown> = { walletAddress, signature };

      if (!mock) {
        setSignStep("Mengirim transaksi ke blockchain (konfirmasi di MetaMask)…");
        const txHash = await storeHashOnChain(hash, walletAddress);
        payload.transactionHash = txHash;
      }

      setSignStep("Mencatat tanda tangan & menunggu konfirmasi…");
      await api.post(`/documents/${id}/sign/confirm`, payload);
      toast.success("Dokumen berhasil ditandatangani & dicatat di blockchain");
      setSignOpen(false);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Penandatanganan gagal"));
      setSignOpen(false);
    } finally {
      setSigning(false);
      setSignStep("");
    }
  }

  async function handleDelete() {
    if (!confirm("Hapus dokumen ini? Tindakan tidak dapat dibatalkan.")) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success("Dokumen dihapus");
      navigate("/documents");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menghapus"));
    }
  }

  async function openPreview() {
    setPreviewOpen(true);
    if (previewUrl) return;
    try {
      const r = await fetch(fileUrl, { headers: { Authorization: `Bearer ${getToken()}` } });
      const blob = await r.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast.error("Gagal memuat pratinjau");
    }
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function downloadFile() {
    // include token via fetch to honor auth, then trigger download
    fetch(`${fileUrl}?download=1`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data?.document.fileName || "dokumen.pdf";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Gagal mengunduh berkas"));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return null;
  const doc = data.document;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/documents">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{doc.namaDokumen}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={doc.status} />
              <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openPreview}>
            <Eye /> Preview
          </Button>
          <Button variant="outline" onClick={downloadFile}>
            <Download /> Download
          </Button>
          {canSign && doc.status === "UNSIGNED" && (
            <Button onClick={handleSign} disabled={signing}>
              {signing ? <Loader2 className="animate-spin" /> : <PenLine />} Tandatangani
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 /> Hapus
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> Informasi Dokumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <InfoRow label="Nama Berkas">{doc.fileName}</InfoRow>
              <InfoRow label="Ukuran">{formatBytes(doc.fileSize)}</InfoRow>
              {doc.description && <InfoRow label="Deskripsi">{doc.description}</InfoRow>}
              <InfoRow label="Diunggah oleh">
                {uploader?.nama} · {roleLabel[uploader?.role || ""]}
              </InfoRow>
              <InfoRow label="Hash SHA-256">
                <span className="font-mono text-xs">{doc.hashDokumen.slice(0, 28)}…</span>
                <CopyButton value={doc.hashDokumen} />
              </InfoRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" /> Pencatatan Blockchain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {doc.status === "SIGNED" ? (
                <>
                  <InfoRow label="Transaction Hash">
                    <span className="font-mono text-xs">{shortAddress(doc.transactionHash)}</span>
                    {doc.transactionHash && <CopyButton value={doc.transactionHash} />}
                  </InfoRow>
                  <InfoRow label="Block Number">#{doc.blockNumber}</InfoRow>
                  <InfoRow label="Timestamp">{formatDate(doc.blockchainTimestamp)}</InfoRow>
                  {data.explorer && (
                    <InfoRow label="Etherscan">
                      <a
                        href={data.explorer}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Buka transaksi <ExternalLink className="h-3 w-3" />
                      </a>
                    </InfoRow>
                  )}
                </>
              ) : (
                <p className="py-2 text-muted-foreground">
                  Dokumen belum ditandatangani / dicatat ke blockchain.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PenLine className="h-4 w-4 text-primary" /> Riwayat Tanda Tangan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.signatures.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Belum ada tanda tangan.</p>
              ) : (
                <div className="space-y-3">
                  {data.signatures.map((s) => {
                    const signer = s.signer as User;
                    return (
                      <div
                        key={s._id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{signer?.nama || "Penandatangan"}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {shortAddress(s.walletAddress)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(s.timestamp)}</p>
                        </div>
                        <Badge variant="success">Terverifikasi</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4 text-primary" /> QR Verifikasi
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="rounded-xl border bg-white p-4">
                <QRCodeCanvas value={data.verifyUrl} size={170} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Pindai untuk membuka halaman verifikasi publik dokumen ini.
              </p>
              <CopyButton value={data.verifyUrl} label="Salin tautan verifikasi" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signing progress dialog */}
      <Dialog open={signOpen} onOpenChange={(o) => !signing && setSignOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Proses Tanda Tangan</DialogTitle>
            <DialogDescription>Jangan tutup jendela ini.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">{signStep}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[85vh] max-w-4xl p-0">
          <DialogHeader className="border-b p-4">
            <DialogTitle>{doc.namaDokumen}</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <iframe title="preview" src={previewUrl} className="h-full w-full rounded-b-xl" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-right font-medium">{children}</span>
    </div>
  );
}
