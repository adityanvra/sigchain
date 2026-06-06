# SIGCHAIN-UAD — Pengujian

## 1. Smart contract (unit test)

```bash
cd smart_contract
npm test        # 9 test (Mocha + Chai) — store, verify, getSigner, getDocumentData,
                # immutability, validasi, enumerasi, event DocumentVerified
```

## 2. Black-box API (end-to-end)

Script `smoke.mjs` menjalankan 10 skenario black-box terhadap backend yang
sedang berjalan (default `http://localhost:5000/api`). Cocok untuk mode demo
(mock) maupun produksi.

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2 (root repo)
node testing/smoke.mjs
# atau target lain:
API_URL=https://your-backend.onrender.com/api node testing/smoke.mjs
```

### Skenario yang diuji

| # | Skenario | Harapan |
| --- | --- | --- |
| 1 | Login berhasil (akademik) | token diterima |
| 2 | Login gagal (password salah) | HTTP 401 |
| 3 | Upload PDF | dokumen + hash SHA-256 |
| 4 | Upload file non-PDF | HTTP 400 |
| 5 | Prepare + tanda tangan | status → SIGNED |
| 6 | Hash tersimpan di blockchain | txHash + blockNumber |
| 7 | Verifikasi dokumen asli | VALID |
| 8 | Verifikasi dokumen dimodifikasi | TIDAK VALID |
| 9 | Audit trail tercatat | jumlah entri bertambah |
| 10 | QR / verifikasi publik by hash | data dokumen tampil |

> Membutuhkan Node.js 18+ (memakai `fetch` & `FormData`/`Blob` bawaan).
> Untuk skenario 5–6, di mode produksi tanda tangan dilakukan via MetaMask di
> browser; script ini menguji jalur backend (mock) `sign/confirm`.
