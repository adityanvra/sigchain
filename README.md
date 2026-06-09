# SIGCHAIN-UAD

**Secure Integrated Governance Chain — Universitas Ahmad Dahlan**

Aplikasi web untuk mengelola dokumen akademik secara digital, yang menjamin
dokumen **asli, tidak dipalsukan, dan bisa diverifikasi siapa saja** — dengan
bantuan **tanda tangan elektronik (MetaMask)** dan **blockchain Ethereum**.

---

## Ide dasarnya (penjelasan sederhana)

Bayangkan setiap dokumen PDF punya **"sidik jari" unik** (disebut *hash* SHA-256).
Kalau isi dokumen berubah 1 huruf saja, sidik jarinya langsung berubah total.

SIGCHAIN bekerja seperti ini:

1. **Upload** dokumen PDF → sistem menghitung sidik jarinya.
2. **Tanda tangan** pakai MetaMask → sidik jari itu dicatat di **blockchain**
   (buku catatan publik yang **tidak bisa diubah/dihapus** siapa pun).
3. **Verifikasi** kapan saja → sistem menghitung ulang sidik jari dokumen lalu
   membandingkannya dengan yang ada di blockchain.
   - Sama → dokumen **ASLI / VALID**.
   - Beda → dokumen **sudah diubah / TIDAK VALID**.

> **Penting:** File PDF aslinya **TIDAK** ditaruh di blockchain (mahal & tidak
> privat). Yang masuk blockchain **hanya sidik jarinya**. File aslinya disimpan
> aman di database (MongoDB). Inilah yang menjaga **privasi + keaslian** sekaligus.

---

## Cara kerja (alur sistem)

```
        ┌─────────────────────────────┐
        │   Pengguna + MetaMask       │  ← tanda tangan dilakukan di sini
        └──────────────┬──────────────┘
                       │
                       ▼
┌──────────────┐   ┌────────────────────┐   ┌────────────────────────────┐
│  FRONTEND    │──▶│  BACKEND (API)     │──▶│  BLOCKCHAIN (Sepolia)      │
│  React+Vite  │   │  Node + Express    │   │  via Alchemy RPC           │
│  (Vercel)    │◀──│  (Vercel)          │◀──│  simpan: sidik jari (hash) │
└──────────────┘   └─────────┬──────────┘   └────────────────────────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │  MongoDB Atlas     │  ← simpan: file PDF + data dokumen
                   └────────────────────┘
```

- **Frontend** = tampilan yang dilihat user (login, dashboard, upload, dll).
- **Backend** = otak sistem: atur login, simpan dokumen, hitung hash, bicara ke blockchain.
- **MongoDB** = tempat menyimpan **file PDF asli + data** (user, dokumen, riwayat).
- **Blockchain** = tempat menyimpan **sidik jari (hash)** yang permanen & publik.
- **Alchemy** = "jembatan/penghubung" agar backend bisa bicara ke blockchain (lihat penjelasan di bawah).

---

## Apa fungsi Alchemy?

Blockchain Ethereum itu jaringan komputer (node) yang tersebar di seluruh dunia.
Untuk membaca/menulis data ke blockchain, aplikasi kita harus **terhubung ke
salah satu node** tersebut.

Menjalankan node Ethereum sendiri itu **berat** (butuh ratusan GB, sinkronisasi
berhari-hari). **Alchemy** menyediakan node Ethereum siap pakai di cloud, dan
memberi kita sebuah **alamat URL (RPC URL)** untuk terhubung — gratis.

Jadi **Alchemy = pintu masuk / jembatan ke blockchain**. Tanpa Alchemy (atau
penyedia RPC sejenis), aplikasi tidak bisa:

- mengecek apakah sebuah hash sudah tercatat di blockchain (untuk verifikasi),
- membaca data transaksi (block number, timestamp),
- mengirim transaksi ke jaringan Sepolia.

Singkatnya: **MetaMask** = dompet & alat tanda tangan milik user;
**Alchemy** = saluran komunikasi backend ↔ blockchain.

---

## Teknologi yang dipakai

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn UI, React Router, Axios, ethers.js v6 |
| Backend | Node.js, Express, TypeScript, Mongoose, JWT, bcrypt, Multer, Zod, Helmet |
| Database | MongoDB Atlas (menyimpan data **dan** file PDF) |
| Smart contract | Solidity 0.8.24, Hardhat |
| Blockchain | Ethereum **Sepolia** testnet, terhubung lewat **Alchemy RPC** |
| Wallet | MetaMask |
| Hosting (gratis) | Vercel (frontend & backend) · MongoDB Atlas · Alchemy |

---

## Struktur folder

```
SigChain/
├── smart_contract/   ← Smart contract Solidity + Hardhat
├── backend/          ← API (Express + TypeScript) + koneksi MongoDB & blockchain
├── frontend/         ← Tampilan web (React + Vite)
├── database/         ← Dokumentasi skema MongoDB + data awal (seed)
├── README.md         ← berkas ini
└── DEPLOYMENT.md     ← panduan deploy gratis
```

---

## Fitur

- **Login & 3 role** — Admin, Staff Akademik, Staff Administrasi (autentikasi JWT).
- **Dashboard** — ringkasan jumlah dokumen, yang sudah/belum ditandatangani, aktivitas terbaru.
- **Manajemen dokumen** — upload PDF, preview, download, hapus, lihat detail.
- **Tanda tangan elektronik** — pakai MetaMask, simpan alamat wallet & waktu tanda tangan.
- **Pencatatan blockchain** — hash SHA-256 disimpan on-chain beserta txHash, block number, timestamp.
- **Verifikasi dokumen** — upload ulang dokumen → hasil **VALID / TIDAK VALID**.
- **QR verification** — QR code menuju halaman verifikasi publik.
- **Audit trail** — riwayat login, upload, tanda tangan, verifikasi, perubahan data.
- **Manajemen pengguna** — khusus Admin.

---

## Mode demo (coba cepat, tanpa setup apa pun)

Backend punya **MODE DEMO**: kalau `MONGODB_URI` dikosongkan → pakai database
sementara di memori; kalau pengaturan blockchain dikosongkan → blockchain
disimulasikan. Akun demo otomatis dibuat (semua password: `password123`):

| Email | Role |
| --- | --- |
| `admin@uad.ac.id` | Admin |
| `akademik@uad.ac.id` | Staff Akademik |
| `administrasi@uad.ac.id` | Staff Administrasi |

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env        # biarkan MONGODB_URI / SEPOLIA kosong untuk demo
npm run dev                 # jalan di http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env
npm run dev                 # jalan di http://localhost:5173
```

Buka <http://localhost:5173>, login dengan akun demo, lalu coba alur:
**upload → tanda tangan → verifikasi**. Banner **Mode demo** akan muncul.

---

## Mode produksi (pakai Sepolia + MongoDB Atlas asli)

Ringkas (langkah detail ada di [`DEPLOYMENT.md`](DEPLOYMENT.md)):

```bash
# 1. Smart contract — deploy ke blockchain
cd smart_contract && npm install
cp .env.example .env        # isi SEPOLIA_RPC_URL (dari Alchemy) + PRIVATE_KEY (wallet test)
npm test                    # 9 test harus lulus
npm run deploy:sepolia      # catat alamat kontrak; ABI otomatis ter-export

# 2. Backend — API
cd ../backend && npm install
cp .env.example .env        # isi MONGODB_URI, SEPOLIA_RPC_URL, CONTRACT_ADDRESS, JWT_SECRET
npm run seed                # buat akun demo (opsional)
npm run dev

# 3. Frontend — tampilan
cd ../frontend && npm install
cp .env.example .env        # isi VITE_API_URL + VITE_CONTRACT_ADDRESS
npm run dev
```

---

## Pengujian (Black Box)

| # | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | Login berhasil | Masuk ke dashboard |
| 2 | Login gagal | Pesan "Email atau password salah" (401) |
| 3 | Upload PDF | Dokumen tersimpan + hash SHA-256 dihitung |
| 4 | Upload non-PDF | Ditolak (400) |
| 5 | Tanda tangan | Status berubah → Ditandatangani |
| 6 | Hash di blockchain | txHash + block number tercatat |
| 7 | Verifikasi dokumen asli | **VALID** |
| 8 | Verifikasi dokumen dimodifikasi | **TIDAK VALID** |
| 9 | Audit trail | Aktivitas tercatat |
| 10 | QR verification | QR membuka halaman verifikasi publik |

Tes smart contract: `cd smart_contract && npm test` (9 test lulus).

---

## Keamanan

SHA-256 hashing · JWT (HS256) · bcrypt (cost 12) · Helmet (proteksi XSS/header) ·
express-mongo-sanitize (cegah NoSQL injection) · rate limiting · validasi input
(Zod) · upload PDF-only (cek mime + ekstensi, maks **15 MB**) · CORS allowlist ·
siap HTTPS.

---

## Lisensi

Skripsi pribadi — komponen open-source di dalamnya bebas digunakan dengan
menyebutkan sumbernya.
