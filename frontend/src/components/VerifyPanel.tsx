import { useEffect, useState } from "react";
import { FileSearch, Loader2, ShieldCheck, ShieldX, UploadCloud, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, apiErrorMessage } from "@/lib/api";
import { sha256File } from "@/lib/crypto";
import { formatDate, shortAddress, shortHash } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";
import type { VerifyResult } from "@/types";
import { toast } from "sonner";

export function VerifyPanel({ initialHash, referenceId, initialResult }: { initialHash?: string; referenceId?: string; initialResult?: VerifyResult | null }) {
  const [hash, setHash] = useState(initialHash || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [reference, setReference] = useState(referenceId || "");

  async function verifyHash(h: string) {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.get(`/verify/${h.toLowerCase().replace(/^0x/, "")}`, { params: reference ? { documentId: reference } : {} });
      setResult(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Verifikasi gagal"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyFile(file: File) {
    setLoading(true);
    setResult(null);
    try {
      const localHash = await sha256File(file);
      setHash(localHash);
      const form = new FormData();
      form.append("file", file);
      if (reference) form.append("documentId", reference);
      const { data } = await api.post("/verify", form);
      setResult(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Verifikasi gagal"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setReference(referenceId || "");
    if (initialResult) { setResult(initialResult); setHash(initialResult.referenceHash || initialHash || ""); }
    else if (initialHash) { void verifyHash(initialHash); }
  }, [initialHash, initialResult, referenceId]);

  return (
    <div className="space-y-6">
      <label className="block space-y-1 text-sm">ID dokumen referensi (opsional)
        <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="ID dari tautan QR untuk membandingkan hash asli dan unggahan" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-4 w-4 text-primary" /> Verifikasi via Unggah PDF
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-accent/40">
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Pilih file PDF</span>
              <span className="text-xs text-muted-foreground">PDF dikirim ke server untuk pemeriksaan hash</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && verifyFile(e.target.files[0])}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileSearch className="h-4 w-4 text-primary" /> Verifikasi via Hash SHA-256
            </div>
            <Input
              placeholder="Masukkan hash dokumen (64 hex)"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              className="w-full"
              disabled={loading || hash.replace(/^0x/, "").length !== 64}
              onClick={() => verifyHash(hash)}
            >
              {loading ? <Loader2 className="animate-spin" /> : <FileSearch />} Verifikasi
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Memeriksa blockchain…
        </div>
      )}

      {result && <VerifyResultView result={result} />}
    </div>
  );
}

function VerifyResultView({ result }: { result: VerifyResult }) {
  const valid = result.valid;
  const unresolved = result.outcome === "PENDING" || result.outcome === "NETWORK_ERROR" || result.outcome === "NOT_REGISTERED";
  return (
    <Card className={valid ? "border-success/40" : unresolved ? "border-input" : "border-destructive/40"}>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {valid ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <ShieldCheck className="h-9 w-9 text-success" />
            </div>
          ) : unresolved ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Info className="h-9 w-9 text-muted-foreground" /></div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <ShieldX className="h-9 w-9 text-destructive" />
            </div>
          )}
          <div>
            <p className={`text-2xl font-bold ${valid ? "text-success" : unresolved ? "text-muted-foreground" : "text-destructive"}`}>
              {result.status}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.reason || (valid
                ? "Dokumen terdaftar di blockchain dan integritasnya terjaga."
                : "Hash dokumen tidak ditemukan di blockchain. Dokumen mungkin telah diubah atau belum pernah ditandatangani.")}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          {result.hash ? <Row label="Hash diperiksa">
            <span className="font-mono text-xs">{shortHash(result.hash ?? "", 14, 14)}</span>
            <CopyButton value={result.hash ?? ""} />
          </Row> : <p>QR menampilkan catatan referensi. Unggah PDF untuk memeriksa berkas yang Anda terima.</p>}
          {result.referenceHash && <div className="border-t pt-2"><p className="text-muted-foreground">Hash dokumen referensi</p><p className="break-all font-mono text-xs">{result.referenceHash}</p><CopyButton value={result.referenceHash} /></div>}
          {result.hash && <p className="break-all font-mono text-xs">Hash unggahan: {result.hash}</p>}
          {result.document?.supersededBy && <p className="text-sm">Dokumen referensi ini memiliki versi pengganti. Catatan versi lama tetap dapat diperiksa.</p>}
          {result.document && (
            <>
              <Row label="Nama Dokumen">{result.document.namaDokumen}</Row>
              <Row label="Status">
                <Badge variant={valid ? "success" : "secondary"}>{result.document.status}</Badge>
              </Row>
            </>
          )}
          {result.onChain.exists && (
            <>
              <Row label={result.document?.recordingMethod === "server_wallet" ? "Wallet pencatat server" : "Penandatangan (wallet)"}>
                <span className="font-mono text-xs">{shortAddress(result.onChain.signer)}</span>
              </Row>
              <Row label="Block Number">#{result.onChain.blockNumber}</Row>
              <Row label="Waktu Blockchain">
                {result.onChain.timestamp
                  ? formatDate(new Date(result.onChain.timestamp * 1000))
                  : "-"}
              </Row>
              {result.onChain.explorer && (
                <Row label="Transaksi">
                  <a
                    href={result.onChain.explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Lihat di Etherscan <ExternalLink className="h-3 w-3" />
                  </a>
                </Row>
              )}
            </>
          )}
          {result.document?.recordingMethod === "server_wallet" && result.signatures.length > 0 && (
            <Row label="Disetujui oleh">
              {result.signatures.map(s => typeof s.signer === "object" ? s.signer.nama : "Pengguna terdaftar").join(", ")}
            </Row>
          )}
          {result.mock && (
            <p className="pt-1 text-xs text-warning">
              * Mode demo: verifikasi dilakukan pada blockchain simulasi.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 text-right font-medium">{children}</span>
    </div>
  );
}
