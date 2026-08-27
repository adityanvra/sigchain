import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PenLine,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, apiErrorMessage, getToken } from "@/lib/api";
import { config } from "@/lib/config";
import { connectWallet, ensureChain, hasMetaMask, signHashMessage, storeHashOnChain } from "@/lib/wallet";
import type { AcademicSignature, DocumentItem } from "@/types";
import { toast } from "sonner";

// We load pdfjs dynamically to avoid SSR issues
let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    // Use CDN worker (avoids bundler complexity)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

interface SigPlacement {
  page: number;  // 0-indexed
  x: number;    // px on canvas
  y: number;    // px on canvas
  width: number;
  height: number;
}

const DEMO_WALLET = "0x1111111111111111111111111111111111111111";

export function SignatureEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Document
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // PDF rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Signature
  const [signature, setSignature] = useState<AcademicSignature | null>(null);
  const [sigImgUrl, setSigImgUrl] = useState<string | null>(null);
  const [loadingSig, setLoadingSig] = useState(false);

  // Placement (drag & drop)
  const [placement, setPlacement] = useState<SigPlacement>({
    page: 0,
    x: 50,
    y: 50,
    width: 160,
    height: 65,
  });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, ow: 0, oh: 0 });

  // Apply + blockchain
  const [applying, setApplying] = useState(false);
  const [resultHash, setResultHash] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signStep, setSignStep] = useState("");
  const [signOpen, setSignOpen] = useState(false);

  // ─── Load document ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/documents/${id}`);
        setDoc(data.document);
        if (data.document.status === "PENDING_BLOCKCHAIN" && data.document.hashDokumen) {
          setResultHash(data.document.hashDokumen);
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "Gagal memuat dokumen"));
        navigate("/documents");
      } finally {
        setLoadingDoc(false);
      }
    }
    load();
  }, [id, navigate]);

  // ─── Load signature ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingSig(true);
      try {
        const { data } = await api.get("/academic-signatures/my");
        setSignature(data.signature || null);
        if (data.signature) {
          setSigImgUrl(`${config.apiUrl}/academic-signatures/my/image`);
        }
      } catch {
        /* silent */
      } finally {
        setLoadingSig(false);
      }
    }
    load();
  }, []);

  // ─── Load PDF ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!doc) return;

    let cancelled = false;

    async function loadPdf() {
      const pdfjs = await getPdfjs();
      const url = `${config.apiUrl}/documents/${id}/file?type=draft`;
      const token = getToken();

      try {
        const loadingTask = pdfjs.getDocument({
          url,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (err) {
        toast.error("Gagal memuat PDF: " + String(err));
      }
    }
    loadPdf();
    return () => { cancelled = true; };
  }, [doc, id]);

  // ─── Render current page ───────────────────────────────────────────────────
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    setRenderingPdf(true);
    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    } finally {
      setRenderingPdf(false);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  // ─── Drag handlers ────────────────────────────────────────────────────────
  function onSigMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: placement.x, oy: placement.y };
  }

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    resizeStart.current = { mx: e.clientX, my: e.clientY, ow: placement.width, oh: placement.height };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragging) {
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        setPlacement((p) => ({
          ...p,
          x: Math.max(0, Math.min(dragStart.current.ox + dx, canvasSize.width - p.width)),
          y: Math.max(0, Math.min(dragStart.current.oy + dy, canvasSize.height - p.height)),
        }));
      }
      if (resizing) {
        const dx = e.clientX - resizeStart.current.mx;
        const dy = e.clientY - resizeStart.current.my;
        setPlacement((p) => ({
          ...p,
          width: Math.max(60, Math.min(resizeStart.current.ow + dx, 400)),
          height: Math.max(30, Math.min(resizeStart.current.oh + dy, 200)),
        }));
      }
    }
    function onUp() { setDragging(false); setResizing(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, resizing, canvasSize]);

  // ─── Apply signature ───────────────────────────────────────────────────────
  async function handleApply() {
    if (!signature) {
      toast.error("Belum ada tanda tangan tersimpan. Unggah tanda tangan di halaman Profil.");
      return;
    }
    setApplying(true);
    try {
      const { data } = await api.post(`/documents/${id}/apply-signature`, {
        page: currentPage - 1,   // 0-indexed for backend
        x: Math.round(placement.x),
        y: Math.round(placement.y),
        width: Math.round(placement.width),
        height: Math.round(placement.height),
      });
      setResultHash(data.hash);
      setDoc(data.document);
      toast.success("Tanda tangan berhasil diterapkan! PDF final sudah dibuat.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Gagal menerapkan tanda tangan"));
    } finally {
      setApplying(false);
    }
  }

  // ─── Blockchain confirmation ───────────────────────────────────────────────
  async function handleSign() {
    if (!resultHash) return;
    setSigning(true);
    setSignOpen(true);
    try {
      setSignStep("Menyiapkan data tanda tangan…");
      const { data: prep } = await api.post(`/documents/${id}/sign/prepare`);
      const hash: string = prep.hash;
      const mock: boolean = prep.mock;

      let walletAddress = DEMO_WALLET;
      let signature = `demo-signature-${Date.now()}`;

      if (hasMetaMask()) {
        setSignStep("Menghubungkan MetaMask…");
        walletAddress = await connectWallet();
        if (!mock) {
          setSignStep("Memastikan jaringan Sepolia…");
          await ensureChain();
        }
        setSignStep("Menandatangani hash dengan wallet…");
        const signed = await signHashMessage(hash);
        walletAddress = signed.address;
        signature = signed.signature;
      } else if (!mock) {
        throw new Error("MetaMask tidak terdeteksi. Pasang MetaMask untuk menandatangani di blockchain.");
      } else {
        setSignStep("Mode demo tanpa MetaMask — menggunakan wallet simulasi…");
      }

      const payload: Record<string, unknown> = { walletAddress, signature };

      if (!mock) {
        setSignStep("Mengirim transaksi ke blockchain (konfirmasi di MetaMask)…");
        const txHash = await storeHashOnChain(hash, walletAddress);
        payload.transactionHash = txHash;
      }

      setSignStep("Mencatat tanda tangan & menunggu konfirmasi…");
      await api.post(`/documents/${id}/sign/confirm`, payload);
      toast.success("Dokumen berhasil ditandatangani & dicatat di blockchain! 🎉");
      setSignOpen(false);
      navigate(`/documents/${id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Penandatanganan gagal"));
      setSignOpen(false);
    } finally {
      setSigning(false);
      setSignStep("");
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loadingDoc) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!doc) return null;

  const isAlreadySigned = doc.status === "SIGNED";

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/documents/${id}`}><ArrowLeft /></Link>
          </Button>
          <div>
            <h1 className="text-base font-bold">{doc.namaDokumen}</h1>
            <p className="text-xs text-muted-foreground">Editor Tanda Tangan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resultHash ? (
            <Button onClick={handleSign} disabled={signing} className="gap-2">
              {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Catat ke Blockchain
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={applying || !signature || isAlreadySigned}
              className="gap-2"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenLine className="h-4 w-4" />
              )}
              {applying ? "Menerapkan…" : "Terapkan Tanda Tangan"}
            </Button>
          )}
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — page thumbnails */}
        <div className="hidden w-[120px] flex-col gap-2 overflow-y-auto border-r bg-muted/20 p-2 lg:flex">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`group relative rounded-lg border-2 p-1 text-center text-[10px] font-medium transition-all ${
                currentPage === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:border-primary/30"
              }`}
            >
              <div className="aspect-[3/4] w-full rounded bg-white shadow-sm flex items-center justify-center text-[10px] text-muted-foreground">
                {p}
              </div>
              Hal. {p}
            </button>
          ))}
        </div>

        {/* Center panel — PDF canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b bg-background/60 px-4 py-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">Halaman {currentPage} / {totalPages}</span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={renderPage}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {renderingPdf && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
            {resultHash && (
              <Badge variant="success" className="ml-auto gap-1">
                <CheckCircle2 className="h-3 w-3" /> PDF Final Siap
              </Badge>
            )}
          </div>

          {/* Canvas area */}
          <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
            <div className="relative inline-block shadow-2xl">
              <canvas ref={canvasRef} className="block" />

              {/* Signature overlay — draggable */}
              {sigImgUrl && !resultHash && (
                <div
                  className={`absolute border-2 border-primary/70 bg-white/10 cursor-move select-none ${
                    dragging ? "opacity-90 shadow-lg" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    left: placement.x,
                    top: placement.y,
                    width: placement.width,
                    height: placement.height,
                  }}
                  onMouseDown={onSigMouseDown}
                >
                  <img
                    src={sigImgUrl}
                    alt="Tanda Tangan"
                    className="h-full w-full object-contain pointer-events-none"
                    draggable={false}
                  />
                  {/* Resize handle */}
                  <div
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-primary/60 rounded-tl-sm"
                    onMouseDown={onResizeMouseDown}
                  />
                  {/* Position label */}
                  <div className="absolute -top-5 left-0 text-[9px] font-mono bg-primary text-primary-foreground px-1 rounded whitespace-nowrap">
                    ({Math.round(placement.x)}, {Math.round(placement.y)}) {Math.round(placement.width)}×{Math.round(placement.height)}
                  </div>
                </div>
              )}

              {/* Result overlay after apply */}
              {resultHash && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="rounded-xl bg-background/95 p-4 text-center shadow-xl border">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Tanda tangan telah diterapkan</p>
                    <p className="text-xs text-muted-foreground mt-1">SHA-256: {resultHash.slice(0, 20)}…</p>
                    <Button onClick={handleSign} disabled={signing} className="mt-3 gap-2" size="sm">
                      <Wallet className="h-3.5 w-3.5" />
                      Catat ke Blockchain
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — controls */}
        <div className="hidden w-[220px] flex-col gap-4 overflow-y-auto border-l bg-background p-4 lg:flex">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tanda Tangan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSig ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Memuat…
                </div>
              ) : sigImgUrl ? (
                <div className="rounded-lg border bg-muted/30 p-2">
                  <img
                    src={sigImgUrl}
                    alt="Tanda Tangan"
                    className="w-full object-contain max-h-16"
                    style={{ background: "repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 0 0 / 8px 8px" }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Belum ada tanda tangan.{" "}
                    <Link to="/profile" className="text-primary underline">
                      Unggah di Profil
                    </Link>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Posisi & Ukuran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Halaman</Label>
                <span className="font-mono font-medium">{currentPage}</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">X</Label>
                <span className="font-mono font-medium">{Math.round(placement.x)} pt</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Y</Label>
                <span className="font-mono font-medium">{Math.round(placement.y)} pt</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Lebar</Label>
                <span className="font-mono font-medium">{Math.round(placement.width)} pt</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tinggi</Label>
                <span className="font-mono font-medium">{Math.round(placement.height)} pt</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                Seret tanda tangan untuk memindahkan. Tarik sudut kanan-bawah untuk mengubah ukuran.
              </p>
            </CardContent>
          </Card>

          {resultHash && (
            <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">PDF Final Siap</span>
                </div>
                <p className="text-[10px] text-muted-foreground break-all font-mono">
                  SHA-256: {resultHash.slice(0, 24)}…
                </p>
                <Button
                  onClick={handleSign}
                  disabled={signing}
                  size="sm"
                  className="w-full gap-1.5"
                >
                  {signing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wallet className="h-3 w-3" />}
                  Catat ke Blockchain
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="text-[10px] text-muted-foreground space-y-1 border-t pt-3">
            <p className="font-medium">Alur:</p>
            <ol className="space-y-0.5 pl-3 list-decimal">
              <li className={resultHash ? "text-muted-foreground line-through" : "text-foreground"}>Atur posisi tanda tangan</li>
              <li className={resultHash ? "text-foreground" : "text-muted-foreground"}>Klik "Terapkan"</li>
              <li className="text-muted-foreground">Konfirmasi MetaMask</li>
              <li className="text-muted-foreground">Dokumen tercatat di blockchain</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Signing dialog */}
      <Dialog open={signOpen} onOpenChange={(o) => !signing && setSignOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konfirmasi Blockchain</DialogTitle>
            <DialogDescription>Jangan tutup jendela ini selama proses berlangsung.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">{signStep}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
