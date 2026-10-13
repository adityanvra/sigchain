/**
 * SIGCHAIN-UAD — black-box smoke test (Node 18+).
 * Runs 10 scenarios against a running backend.
 *
 *   node testing/smoke.mjs
 *   API_URL=https://your-backend.onrender.com/api node testing/smoke.mjs
 */

const API = process.env.API_URL || "http://localhost:5000/api";
const EMAIL = process.env.SIG_EMAIL || "akademik@uad.ac.id";
const PASSWORD = process.env.SIG_PASSWORD || "password123";
import { createRequire } from "node:module";
const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { PDFDocument } = require("pdf-lib");

let passed = 0;
let failed = 0;

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  \u2714 ${name} ${extra}`);
  } else {
    failed++;
    console.log(`  \u2718 ${name} ${extra}`);
  }
}

// A minimal but valid PDF (starts with %PDF-).
async function pdfBlob(extra = "") {
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText(extra);
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

async function main() {
  console.log(`\nSIGCHAIN-UAD smoke test → ${API}\n`);

  // 1. Login OK
  let token = "";
  {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const j = await r.json();
    token = j.token || "";
    ok("1. Login berhasil", r.status === 200 && !!token);
  }
  const auth = { Authorization: `Bearer ${token}` };

  // 2. Login gagal
  {
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: "wrong-password" }),
    });
    ok("2. Login gagal ditolak", r.status === 401, `(http ${r.status})`);
  }

  // 3. Upload PDF
  let docId = "";
  let hash = "";
  {
    const form = new FormData();
    form.append("file", await pdfBlob(`unik-${Date.now()}`), "uji.pdf");
    form.append("namaDokumen", "Dokumen Uji Black-Box");
    const r = await fetch(`${API}/documents`, { method: "POST", headers: auth, body: form });
    const j = await r.json();
    docId = j.document?._id || "";
    hash = j.document?.hashDokumen || "";
    ok("3. Upload draft PDF berhasil", r.status === 201 && !!docId && hash === "");
  }

  // 4. Upload non-PDF
  {
    const form = new FormData();
    form.append("file", new Blob(["hello"], { type: "text/plain" }), "nota.txt");
    const r = await fetch(`${API}/documents`, { method: "POST", headers: auth, body: form });
    ok("4. Upload non-PDF ditolak", r.status === 400, `(http ${r.status})`);
  }

  // 5 + 6. Sign + on-chain record
  {
    const image = new FormData();
    image.append("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "test-signature.png");
    const sigResponse = await fetch(`${API}/academic-signatures`, { method: "POST", headers: auth, body: image });
    if (!sigResponse.ok) throw new Error("Gagal menyiapkan tanda tangan uji");
    const applied = await fetch(`${API}/documents/${docId}/apply-signature`, {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ page: 0, x: 30, y: 30, width: 80, height: 30 }),
    });
    const final = await applied.json();
    if (!applied.ok) throw new Error(final.message || "Finalisasi PDF gagal");
    hash = final.hash;
    await fetch(`${API}/documents/${docId}/sign/prepare`, { method: "POST", headers: auth });
    const r = await fetch(`${API}/documents/${docId}/sign/confirm`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    ok("5. Tanda tangan berhasil", r.status === 200 && j.document?.status === "SIGNED");
    ok(
      "6. Hash tersimpan di blockchain",
      !!j.document?.transactionHash && Number.isInteger(j.document?.blockNumber)
    );
  }

  // 7. Verify original → VALID
  {
    const r = await fetch(`${API}/verify/${hash}`);
    const j = await r.json();
    ok("7. Verifikasi dokumen asli VALID", j.status === "VALID" && j.valid === true);
  }

  // 8. Verify modified → TIDAK VALID
  {
    const fake = "f".repeat(64);
    const r = await fetch(`${API}/verify/${fake}?documentId=${docId}`);
    const j = await r.json();
    ok("8. Hash berbeda dari referensi TIDAK VALID", j.status === "TIDAK VALID" && j.outcome === "DIFFERENT" && j.referenceHash === hash);
  }

  // 9. Audit trail
  {
    const r = await fetch(`${API}/audit`, { headers: auth });
    const j = await r.json();
    ok("9. Audit trail tercatat", Array.isArray(j.trails) && j.trails.length > 0, `(${j.trails?.length} entri)`);
  }

  // 10. Public verify by hash returns document data
  {
    const r = await fetch(`${API}/verify/${hash}`);
    const j = await r.json();
    ok("10. QR verification (public by hash)", !!j.document && j.document.namaDokumen?.length > 0);
  }

  console.log(`\nHasil: ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Smoke test error:", e.message);
  process.exit(1);
});
