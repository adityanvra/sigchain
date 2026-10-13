import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { DocumentItem, User } from "@/types";

const userId = (value: User | string | null | undefined) => typeof value === "object" ? value?._id : value;
type StepInput = { signerId: string; capacity: string };
export function DocumentWorkflow({ doc, onChanged }: { doc: DocumentItem; onChanged: () => Promise<void> }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [directory, setDirectory] = useState<{ signers: User[]; reviewers: User[] }>({ signers: [], reviewers: [] });
  const [steps, setSteps] = useState<StepInput[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [documentType, setDocumentType] = useState("Dokumen akademik");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.get("/users/participants").then(({ data }) => { if (active) setDirectory(data); }).catch(err => toast.error(apiErrorMessage(err, "Daftar pejabat gagal dimuat")));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    setSteps((doc.signingSteps || []).map(s => ({ signerId: userId(s.signer) || "", capacity: s.capacity })));
    setReviewer(userId(doc.reviewer) || "");
    setDocumentType(doc.documentType || "Dokumen akademik");
    setFile(null);
  }, [doc]);
  const owner = user?._id === userId(doc.uploader) || user?.role === "admin";
  const draft = ["DRAFT", "UNSIGNED"].includes(doc.status) && !doc.supersededBy;
  const current = doc.signingSteps?.[doc.currentStep || 0];
  const isReviewer = userId(doc.reviewer) === user?._id && doc.status === "SUBMITTED";
  const canReturn = isReviewer || (userId(current?.signer) === user?._id && ["READY_TO_SIGN", "PARTIALLY_SIGNED"].includes(doc.status));
  const canRevise = owner && !doc.supersededBy && ["NEEDS_REVISION", "REJECTED", "SIGNED"].includes(doc.status);
  const unsavedWorkflow = reviewer !== (userId(doc.reviewer) || "")
    || documentType !== (doc.documentType || "Dokumen akademik")
    || JSON.stringify(steps) !== JSON.stringify((doc.signingSteps || []).map(s => ({ signerId: userId(s.signer) || "", capacity: s.capacity })));
  async function action(path: string, payload: unknown = {}, method: "post" | "put" = "post") {
    setBusy(true);
    try {
      const { data } = await api[method](`/documents/${doc._id}/${path}`, payload);
      toast.success("Pengajuan diperbarui");
      if (path === "revise") navigate(`/documents/${data.document._id}`);
      await onChanged();
    } catch (err) { toast.error(apiErrorMessage(err, "Pengajuan gagal diperbarui")); }
    finally { setBusy(false); }
  }
  function upload(path: "revise" | "prepare-letter") {
    if (!file) { toast.error("Pilih PDF terlebih dahulu"); return; }
    const form = new FormData(); form.append("file", file); void action(path, form);
  }
  function replaceStep(index: number, patch: Partial<StepInput>) { setSteps(old => old.map((s, i) => i === index ? { ...s, ...patch } : s)); }
  function move(index: number, direction: number) {
    setSteps(old => { const next = [...old]; const target = index + direction; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  return <Card>
    <CardHeader><CardTitle className="text-base">Pengajuan dan Urutan Penandatangan</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Versi {doc.version || 1} · {doc.documentType || "Dokumen akademik"}. Pemeriksaan TU dan persetujuan setiap orang dicatat terpisah.</p>
      {doc.previousVersionId && <p className="text-sm"><Link className="text-primary underline" to={`/documents/${doc.previousVersionId}`}>Lihat versi sebelumnya</Link></p>}
      {doc.supersededBy && <p className="text-sm"><Link className="text-primary underline" to={`/documents/${doc.supersededBy}`}>Dokumen ini memiliki versi pengganti. Buka versi terbaru.</Link></p>}
      {doc.reviewReason && <div className="rounded-lg border p-3 text-sm"><strong>Alasan pemeriksaan:</strong><p className="whitespace-pre-wrap">{doc.reviewReason}</p></div>}
      {!!doc.signingSteps?.length && <ol className="space-y-2">
        {doc.signingSteps.map((s, i) => <li key={`${i}-${userId(s.signer)}`} className="rounded-lg border p-3 text-sm">
          <strong>{i + 1}. {typeof s.signer === "object" ? s.signer.nama : directory.signers.find(u => u._id === s.signer)?.nama || "Penandatangan"} — {s.capacity}</strong>
          <p className="text-muted-foreground">{s.status === "APPROVED" ? `Disetujui ${formatDate(s.approvedAt)}` : s.status === "APPLIED" ? "Tanda tangan diterapkan, menunggu persetujuan" : s.status === "READY" ? "Giliran aktif" : "Menunggu giliran"}</p>
        </li>)}
      </ol>}
      {owner && draft && <div className="space-y-3 border-t pt-3">
        <label className="block space-y-1 text-sm">Jenis dokumen<Input value={documentType} onChange={e => setDocumentType(e.target.value)} maxLength={120} /></label>
        <label className="block space-y-1 text-sm">Pemeriksa TU
          <select className="w-full rounded-md border bg-background p-2" value={reviewer} onChange={e => setReviewer(e.target.value)}>
            <option value="">Pilih orang yang memeriksa</option>{directory.reviewers.map(u => <option key={u._id} value={u._id}>{u.nama} · {u.unit || "TU"}</option>)}
          </select>
        </label>
        {steps.map((s, i) => <fieldset className="space-y-2 rounded-md border p-3" key={i}>
          <legend className="px-1 text-sm">Penandatangan {i + 1}</legend>
          <label className="block text-sm">Nama
            <select className="w-full rounded-md border bg-background p-2" value={s.signerId} onChange={e => replaceStep(i, { signerId: e.target.value, capacity: "" })}>
              <option value="">Pilih orang</option>{directory.signers.map(u => <option key={u._id} value={u._id}>{u.nama} · {(u.jabatan || []).join(", ") || "Penandatangan"} · {u.unit || "FTI"}</option>)}
            </select>
          </label>
          <label className="block text-sm">Kapasitas pada dokumen
            <select className="w-full rounded-md border bg-background p-2" value={s.capacity} onChange={e => replaceStep(i, { capacity: e.target.value })}>
              <option value="">Pilih kapasitas</option>{directory.signers.find(u => u._id === s.signerId)?.capacities?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={i === 0} onClick={() => move(i, -1)}>Naik</Button><Button size="sm" variant="outline" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>Turun</Button><Button size="sm" variant="outline" onClick={() => setSteps(old => old.filter((_, j) => j !== i))}>Hapus tahap</Button></div>
        </fieldset>)}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={steps.length >= 12} onClick={() => setSteps(old => [...old, { signerId: "", capacity: "" }])}>Tambah Penandatangan</Button>
          <Button disabled={busy || !reviewer || !steps.length || steps.some(s => !s.signerId || !s.capacity)} onClick={() => action("workflow", { reviewerId: reviewer, documentType, steps }, "put")}>Simpan Alur</Button>
          <Button disabled={busy || unsavedWorkflow || !doc.signingSteps?.length} onClick={() => action("submit")}>Ajukan ke TU</Button>
        </div>
        <p className="text-xs text-muted-foreground">Simpan alur sebelum mengajukan. Nama jabatan dikelola Admin; pilih orang dan kapasitas sesuai kebutuhan surat.</p>
      </div>}
      {canReturn && <div className="space-y-3 border-t pt-3">
        {isReviewer && <p className="text-sm">Periksa dokumen lewat Preview. Bila TU menyusun surat keluaran, unggah PDF surat sebelum menyetujui.</p>}
        <label className="block space-y-1 text-sm">Alasan perbaikan atau penolakan<textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {isReviewer && <Button disabled={busy} onClick={() => action("review", { decision: "approve" })}>Setujui Pemeriksaan TU</Button>}
          <Button variant="outline" disabled={busy || !reason.trim()} onClick={() => action("review", { decision: "revise", reason })}>Minta Perbaikan</Button>
          <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => action("review", { decision: "reject", reason })}>Tolak Pengajuan</Button>
        </div>
      </div>}
      {(isReviewer || canRevise) && <div className="space-y-2 border-t pt-3">
        <label className="block text-sm">{isReviewer ? "PDF surat keluaran TU (opsional)" : "PDF versi perbaikan"}<Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        <Button variant="outline" disabled={busy || !file} onClick={() => upload(isReviewer ? "prepare-letter" : "revise")}>{isReviewer ? "Simpan Surat Keluaran TU" : "Buat Versi Baru"}</Button>
        {!isReviewer && <p className="text-xs text-muted-foreground">Versi lama tetap tersedia. Versi baru harus diajukan dan ditandatangani ulang.</p>}
      </div>}
    </CardContent>
  </Card>;
}
