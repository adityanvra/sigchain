import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Mail, ShieldCheck, FileLock2, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login berhasil");
      navigate("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login gagal"));
    } finally {
      setLoading(false);
    }
  }

  function fill(role: "admin" | "akademik" | "administrasi") {
    setEmail(`${role}@uad.ac.id`);
    setPassword("password123");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <img src="/logo-uad.png" alt="Logo UAD" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">SIGCHAIN-UAD</p>
            <p className="text-xs text-primary-foreground/70">Secure Integrated Governance Chain</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold leading-tight">
            Tanda Tangan Elektronik &amp; Verifikasi Dokumen Berbasis Blockchain
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Menjaga integritas, keaslian, dan validitas dokumen akademik &amp; administrasi
            Universitas Ahmad Dahlan melalui hash SHA-256 yang diabadikan di Ethereum.
          </p>
          <div className="grid gap-3">
            {[
              { icon: FileLock2, t: "Integritas dokumen terjamin SHA-256" },
              { icon: Fingerprint, t: "Tanda tangan via MetaMask wallet" },
              { icon: ShieldCheck, t: "Verifikasi publik & audit trail abadi" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                  <f.icon className="h-4 w-4" />
                </div>
                {f.t}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Universitas Ahmad Dahlan
        </p>
      </div>

      {/* Right form panel */}
      <div className="bg-academic flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 rounded-2xl border bg-card p-8 shadow-xl">
          <div className="space-y-2 text-center lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <img src="/logo-uad.png" alt="Logo UAD" className="h-6 w-6 object-contain" />
            </div>
            <p className="text-lg font-bold">SIGCHAIN-UAD</p>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Masuk ke akun Anda</h2>
            <p className="text-sm text-muted-foreground">
              Gunakan kredensial yang diberikan administrator.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-9"
                  placeholder="nama@uad.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Lock />} Masuk
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-center text-xs text-muted-foreground">Akun demo (klik untuk isi)</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => fill("admin")}>
                Admin
              </Button>
              <Button variant="outline" size="sm" onClick={() => fill("akademik")}>
                Akademik
              </Button>
              <Button variant="outline" size="sm" onClick={() => fill("administrasi")}>
                Administrasi
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Ingin memverifikasi dokumen tanpa login?{" "}
            <Link to="/verify-public" className="font-medium text-primary hover:underline">
              Verifikasi publik
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
