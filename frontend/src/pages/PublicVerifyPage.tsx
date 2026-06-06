import { Link, useParams } from "react-router-dom";
import { ShieldHalf } from "lucide-react";
import { VerifyPanel } from "@/components/VerifyPanel";
import { Button } from "@/components/ui/button";

export function PublicVerifyPage() {
  const { hash } = useParams();

  return (
    <div className="bg-academic min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldHalf className="h-5 w-5" />
            </div>
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
        <VerifyPanel initialHash={hash} />
      </main>
    </div>
  );
}
