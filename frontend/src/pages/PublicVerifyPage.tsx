import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { VerifyPanel } from "@/components/VerifyPanel";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

import type { VerifyResult } from "@/types";

export function PublicVerifyPage() {
  const { hash } = useParams<{ hash?: string }>();

  // Detect if param looks like a MongoDB ObjectId (24 hex chars) = documentId
  // vs a SHA-256 hash (64 hex chars)
  const isDocumentId = hash && /^[a-f0-9]{24}$/i.test(hash);
  const isHash = hash && /^[a-f0-9]{64}$/i.test(hash);

  const [resolvedHash, setResolvedHash] = useState<string | undefined>(
    isHash ? hash : undefined
  );
  const [resolvedResult, setResolvedResult] = useState<VerifyResult | null>(null);
  const [loadingDocId, setLoadingDocId] = useState(!!isDocumentId);

  useEffect(() => {
    if (!isDocumentId || !hash) return;

    async function resolveDocId() {
      setLoadingDocId(true);
      try {
        const { data } = await api.get(`/verify/document/${hash}`);
        setResolvedResult(data);
        setResolvedHash(data.referenceHash || undefined);
      } catch {
        /* silently fail — VerifyPanel will handle error state */
      } finally {
        setLoadingDocId(false);
      }
    }
    resolveDocId();
  }, [hash, isDocumentId]);

  return (
    <div className="bg-academic min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src="/logo-uad.png" alt="Logo UAD" className="h-5 w-5 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-bold">SIGCHAIN-UAD</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Verifikasi Publik
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/login">Masuk</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Verifikasi Keaslian Dokumen</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Pastikan dokumen akademik &amp; administrasi Universitas Ahmad Dahlan asli dan tidak
            dimodifikasi dengan mencocokkan hash-nya pada blockchain Ethereum.
          </p>
        </div>

        {loadingDocId ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Mengambil data dokumen dari blockchain…</span>
          </div>
        ) : (
          <VerifyPanel initialHash={resolvedHash} referenceId={isDocumentId ? hash : undefined} initialResult={resolvedResult} />
        )}
      </main>
    </div>
  );
}
