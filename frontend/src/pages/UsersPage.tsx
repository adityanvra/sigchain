import { useEffect, useState } from "react";
import { Plus, Users, Trash2, Pencil, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDate, roleLabel, shortAddress } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { User, UserRole } from "@/types";
import { toast } from "sonner";

const emptyForm = {
  nama: "",
  email: "",
  password: "",
  role: "staff_administrasi" as UserRole,
  walletAddress: "",
};

export function UsersPage() {
  const { user: current } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      setUsers(data.users);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditId(u._id);
    setForm({
      nama: u.nama,
      email: u.email,
      password: "",
      role: u.role,
      walletAddress: u.walletAddress || "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        const payload: Record<string, unknown> = {
          nama: form.nama,
          role: form.role,
          walletAddress: form.walletAddress || undefined,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editId}`, payload);
        toast.success("User diperbarui");
      } else {
        await api.post("/users", { ...form, walletAddress: form.walletAddress || undefined });
        toast.success("User dibuat");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menyimpan user"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: User) {
    if (!confirm(`Hapus user ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      toast.success("User dihapus");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menghapus"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-muted-foreground">Kelola akun dan peran pengguna sistem.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Tambah User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Belum ada pengguna.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead className="hidden lg:table-cell">Wallet</TableHead>
                  <TableHead className="hidden lg:table-cell">Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u._id}>
                    <TableCell className="font-medium">{u.nama}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {roleLabel[u.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {u.walletAddress ? shortAddress(u.walletAddress) : "-"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          disabled={u._id === current?._id}
                          onClick={() => remove(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit User" : "Tambah User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                required
                disabled={!!editId}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{editId ? "Password (kosongkan jika tidak diubah)" : "Password"}</Label>
              <Input
                type="password"
                required={!editId}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Peran</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff_akademik">Staff Akademik</SelectItem>
                  <SelectItem value="staff_administrasi">Staff Administrasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Wallet Address (opsional)</Label>
              <Input
                placeholder="0x…"
                className="font-mono text-xs"
                value={form.walletAddress}
                onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
