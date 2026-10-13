import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
interface Notice { _id: string; documentId: string; message: string; readAt?: string; createdAt: string; }
export function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    try { const { data } = await api.get("/notifications"); setItems(data.notifications); }
    catch (err) { toast.error(apiErrorMessage(err, "Notifikasi gagal dimuat")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function read(id: string) {
    try { await api.put(`/notifications/${id}/read`); await load(); }
    catch (err) { toast.error(apiErrorMessage(err, "Notifikasi gagal diperbarui")); }
  }
  return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Notifikasi</h1><Button variant="outline" onClick={load}>Perbarui</Button></div>
    <p className="text-sm text-muted-foreground">Permintaan pemeriksaan, giliran tanda tangan, perbaikan, dan dokumen selesai.</p>
    {loading ? <p>Memuat…</p> : items.length === 0 ? <p>Belum ada pemberitahuan untuk akun Anda.</p> : items.map(item => <Card key={item._id}><CardContent className="space-y-2 p-4">
      <p className={item.readAt ? "text-muted-foreground" : "font-medium"}>{item.message}</p><p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
      <div className="flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/documents/${item.documentId}`}>Buka Dokumen</Link></Button>{!item.readAt && <Button size="sm" variant="outline" onClick={() => read(item._id)}>Tandai Dibaca</Button>}</div>
    </CardContent></Card>)}
  </div>;
}
