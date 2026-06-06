import { useState } from "react";
import { FileSearch, Loader2, ShieldCheck, ShieldX, UploadCloud, ExternalLink } from "lucide-react";
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

export function VerifyPanel({ initialHash }: { initialHash?: string }) {
  const [hash, setHash] = useState(initialHash || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  async function verifyHash(h: string) {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.get(`/verify/${h.toLowerCase().replace(/^0x/, "")}`);
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
      const { data } = await api.post("/verify", form);
      setResult(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Verifikasi gagal"));
    } finally {
      setLoading(false);
    }
  }

  // Auto-run if an initial hash was provided (QR flow).
  if (initialHash && !autoRan) {
    setAutoRan(true);
    verifyHash(initialHash);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-4 w-4 text-primary" /> Verifikasi via Unggah PDF
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-accent/40">
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Pilih atau jatuhkan file PDF</span>
              <span className="text-xs text-muted-foreground">Hash dihitung di browser Anda</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
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
  return (
    <Card className={valid ? "border-success/40" : "border-destructive/40"}>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {valid ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <ShieldCheck className="h-9 w-9 text-success" />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <ShieldX className="h-9 w-9 text-destructive" />
            </div>
          )}
          <div>
            <p className={`text-2xl font-bold ${valid ? "text-success" : "text-destructive"}`}>
              {result.status}
            </p>
            <p className="text-sm text-muted-foreground">
              {valid
                ? "Dokumen terdaftar di blockchain dan integritasnya terjaga."
                : "Hash dokumen tidak ditemukan di blockchain. Dokumen mungkin telah diubah atau belum pernah ditandatangani."}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <Row label="Hash SHA-256">
            <span className="font-mono text-xs">{shortHash(result.hash, 14, 14)}</span>
            <CopyButton value={result.hash} />
          </Row>
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
              <Row label="Penandatangan (wallet)">
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
