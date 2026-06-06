import { useState } from "react";
import { Loader2, Wallet, Save, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { roleLabel, shortAddress } from "@/lib/utils";
import { toast } from "sonner";

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const { connect, connecting } = useWallet();
  const [nama, setNama] = useState(user?.nama || "");
  const [walletAddress, setWalletAddress] = useState(user?.walletAddress || "");
  const [saving, setSaving] = useState(false);

  const initials = (user?.nama || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/auth/profile", {
        nama,
        walletAddress: walletAddress || undefined,
      });
      setUser(data.user);
      toast.success("Profil diperbarui");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal memperbarui profil"));
    } finally {
      setSaving(false);
    }
  }

  async function linkWallet() {
    try {
      const addr = await connect();
      setWalletAddress(addr);
      toast.success("Wallet terhubung — jangan lupa simpan.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menghubungkan wallet"));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Pengguna</h1>
        <p className="text-sm text-muted-foreground">Kelola informasi akun dan wallet Anda.</p>
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Wallet Address (MetaMask)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="0x…"
                  className="font-mono text-xs"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={linkWallet} disabled={connecting}>
                  {connecting ? <Loader2 className="animate-spin" /> : <Link2 />} Hubungkan
                </Button>
              </div>
              {walletAddress && (
                <p className="text-xs text-muted-foreground">
                  Tersimpan: <span className="font-mono">{shortAddress(walletAddress)}</span>
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Simpan Perubahan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
