import { ShieldCheck } from "lucide-react";
import { VerifyPanel } from "@/components/VerifyPanel";

export function VerifyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Verifikasi Dokumen</h1>
        <p className="text-sm text-muted-foreground">
          Unggah ulang PDF atau masukkan hash untuk membandingkan dengan catatan blockchain.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-xl border bg-accent/30 p-4 text-sm">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <p className="text-muted-foreground">
          Sistem menghitung ulang hash SHA-256 dokumen, lalu mencocokkannya dengan hash yang
          tersimpan di smart contract. Hasil <strong>VALID</strong> berarti dokumen identik dengan
          yang ditandatangani.
        </p>
      </div>
      <VerifyPanel />
    </div>
  );
}
