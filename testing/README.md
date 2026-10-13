# SIGCHAIN-UAD — Pengujian

## Pemeriksaan terbaru — 13 Oktober 2026

Build frontend/backend lulus tanpa error; pemisahan halaman frontend menghilangkan peringatan ukuran chunk dan impor ganda sebelumnya. Pengujian smart contract: **9 lulus**. Integrasi API/PDF/workflow melalui Hardhat lokal: **24 pemeriksaan lulus**. Smoke API mode demo: **10 lulus, 0 gagal**. Tambahan regresi mencakup berkas rusak, ID tidak valid, format gambar, berkas permohonan awal, perlindungan penghapusan versi/final, penolakan, pengajuan ulang dan kapasitas ganda. Pemeriksaan hash berbeda pada smoke menyertakan ID referensi; hash asing tanpa referensi dilaporkan TIDAK TERDAFTAR.

Data pengujian terisolasi; hasil ini tidak menggantikan validasi TU/SUS, konfigurasi SMTP, atau bukti transaksi Sepolia publik. Catatan 12 Oktober di bawah dipertahankan sebagai riwayat.

## 1. Smart contract (unit test)

```bash
cd smart_contract
npm test        # 9 test (Mocha + Chai) — store, verify, getSigner, getDocumentData,
                # immutability, validasi, enumerasi, event DocumentVerified
```

## 2. Black-box API (end-to-end)

Script `smoke.mjs` menjalankan 10 skenario black-box terhadap backend yang
sedang berjalan (default `http://localhost:5000/api`). Gunakan backend dan akun khusus pengujian karena skrip mengganti gambar tanda tangan dan mencatat dokumen uji.

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
| 3 | Upload PDF | dokumen draft; hash baru dihitung setelah tanda tangan visual |
| 4 | Upload file non-PDF | HTTP 400 |
| 5 | Prepare + tanda tangan | status → SIGNED |
| 6 | Hash tersimpan di blockchain | txHash + blockNumber |
| 7 | Verifikasi dokumen asli | VALID |
| 8 | Verifikasi dokumen dimodifikasi | TIDAK VALID |
| 9 | Audit trail tercatat | jumlah entri bertambah |
| 10 | QR / verifikasi publik by hash | data dokumen tampil |

> Membutuhkan Node.js 18+ (memakai `fetch` & `FormData`/`Blob` bawaan).
> Skenario 5–6 menyiapkan gambar tanda tangan uji, memfinalisasi PDF, lalu meminta backend mencatat hash melalui wallet server. Script mengganti gambar tanda tangan aktif akun uji, sehingga jalankan dengan akun khusus pengujian.

## 3. Integrasi wallet server

Hasil eksekusi 12 Oktober 2026: build backend dan frontend lulus; **21 pemeriksaan integrasi lulus** pada MongoDB sementara dan Hardhat lokal; **10 skenario smoke API lulus, 0 gagal** pada backend demo port 18500. Integrasi mencakup login, akses mahasiswa, TU, tiga penandatangan, PDF/QR, versi, notifikasi, format email, verifikasi, receipt, key kosong, retry dan nonce bersamaan. Pemeriksaan merupakan assertion dalam satu rangkaian Node test, bukan responden SUS.

Browser diuji untuk mahasiswa, pemeriksaan TU serta persetujuan berurutan Dosen Pembimbing dan Dekan. Screenshot data demo ada di `output/semhas/revisi-mahasiswa-multi-penandatangan.jpg`. Email memakai JSON transport lokal; transaksi integrasi hanya pada jaringan lokal. Bukti smoke blockchain adalah simulasi. Belum ada pengiriman email atau transaksi Sepolia publik. Validasi TU/pengguna mengikuti [VALIDASI-TU-DAN-PENGUJIAN.md](../docs/VALIDASI-TU-DAN-PENGUJIAN.md). Vite masih memberi peringatan ukuran bundle dan impor dinamis/statis `api.ts`.

Dari folder backend, jalankan `npm run test:server-signing`. Tes memakai MongoDB sementara dan akun terisolasi. Untuk transaksi RPC nyata tanpa mengirim ke Sepolia, jalankan Hardhat pada port 18545, lalu set `TEST_CHAIN_RPC_URL=http://127.0.0.1:18545` sebelum menjalankan tes. Petunjuk lengkap ada di [SERVER-SEPOLIA.md](../SERVER-SEPOLIA.md).
