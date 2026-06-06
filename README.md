# SIGCHAIN-UAD

**Secure Integrated Governance Chain — Universitas Ahmad Dahlan**

Aplikasi web *fullstack* untuk pengelolaan dokumen akademik & administrasi
elektronik yang menjaga **integritas, keaslian, keamanan, dan validitas**
dokumen melalui **tanda tangan elektronik (MetaMask)** dan **pencatatan hash
SHA-256 pada blockchain Ethereum (Sepolia testnet)**.

> Berkas PDF asli tetap berada di backend. Yang diabadikan di blockchain
> hanyalah **hash SHA-256**-nya — menjamin privasi sekaligus integritas.

## Arsitektur

```
            ┌─────────────────────────┐
            │     MetaMask (browser)  │
            └────────────┬────────────┘
                         │ EIP-1193 (storeDocumentHash)
                         ▼
┌──────────────┐ HTTPS ┌────────────────────┐ Ethers.js ┌────────────────────────┐
│  Frontend    │◀─────▶│  Backend API        │──────────▶│ Sepolia (Alchemy RPC) │
│  React+Vite  │       │  Node + Express + TS│           │ DocumentSignatureReg.  │
│  (Vercel)    │       │  (Render)           │           └────────────────────────┘
└──────────────┘       └─────────┬───────────┘
                                 │ Mongoose
                                 ▼
                        ┌──────────────────┐
                        │  MongoDB Atlas   │
                        └──────────────────┘
```

## Tech stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn-style UI, React Router, Axios, ethers.js v6 |
| Backend | Node.js, Express, TypeScript, Mongoose, JWT, bcrypt, Multer, Zod, Helmet |
| Database | MongoDB Atlas |
| Smart contract | Solidity 0.8.24, Hardhat, Ethers v6 |
| Blockchain | Ethereum **Sepolia** testnet (Alchemy RPC) |
| Wallet | MetaMask |
| Hosting (gratis) | Vercel (frontend) · Render (backend) · MongoDB Atlas · Alchemy |

## Struktur folder

```
SigChain/
├── smart_contract/   ← Solidity + Hardhat (DocumentSignatureRegistry.sol)
├── backend/          ← Express + TypeScript REST API + MongoDB + Ethers
├── frontend/         ← React + Vite SPA (Tailwind + shadcn UI)
├── database/         ← dokumentasi skema MongoDB + seed
├── README.md         ← berkas ini
└── DEPLOYMENT.md     ← panduan deploy gratis
```

## Fitur

- **Autentikasi** JWT + 3 role (Admin, Staff Akademik, Staff Administrasi).
- **Dashboard** — total dokumen, ditandatangani, belum, aktivitas terbaru.
- **Manajemen dokumen** — upload PDF, preview, download, hapus, detail.
- **Tanda tangan elektronik** — MetaMask, simpan wallet & timestamp.
- **Blockchain** — hash SHA-256 → on-chain, simpan txHash, block number, timestamp.
- **Verifikasi dokumen** — upload ulang / hash, hasil **VALID / TIDAK VALID**.
- **QR verification** — QR menuju halaman verifikasi publik.
- **Audit trail** — riwayat login, upload, tanda tangan, verifikasi, perubahan data.
- **Manajemen pengguna** (Admin).

## Mode demo (tanpa setup eksternal)

Backend punya **MOCK MODE**: jika `MONGODB_URI` kosong → MongoDB in-memory; jika
`SEPOLIA_RPC_URL`/`CONTRACT_ADDRESS` kosong → blockchain disimulasikan. Akun demo
otomatis dibuat (semua password `password123`):

| Email | Role |
| --- | --- |
| `admin@uad.ac.id` | Admin |
| `akademik@uad.ac.id` | Staff Akademik |
| `administrasi@uad.ac.id` | Staff Administrasi |

```bash
# Terminal 1 — backend (mock mode otomatis aktif jika .env kosong)
cd backend
npm install
cp .env.example .env        # biarkan MONGODB_URI / SEPOLIA kosong untuk demo
npm run dev                 # http://localhost:5000

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

Buka <http://localhost:5173>, login dengan akun demo, lalu upload → tandatangani
→ verifikasi. Banner **Mode demo** akan muncul.

## Mode produksi (Sepolia + Atlas)

Ringkas (detail di [`DEPLOYMENT.md`](DEPLOYMENT.md)):

```bash
# 1. Smart contract
cd smart_contract && npm install
cp .env.example .env        # SEPOLIA_RPC_URL + PRIVATE_KEY (wallet test)
npm test                    # 9 test pass
npm run deploy:sepolia      # catat alamat kontrak; ABI auto-export

# 2. Backend
cd ../backend && npm install
cp .env.example .env        # isi MONGODB_URI, SEPOLIA_RPC_URL, CONTRACT_ADDRESS, JWT_SECRET
npm run seed                # akun demo (opsional)
npm run dev

# 3. Frontend
cd ../frontend && npm install
cp .env.example .env        # isi VITE_API_URL + VITE_CONTRACT_ADDRESS
npm run dev
```

## Pengujian (Black Box)

| # | Skenario | Hasil yang diharapkan |
| --- | --- | --- |
| 1 | Login berhasil | Masuk ke dashboard |
| 2 | Login gagal | Pesan "Email atau password salah" (401) |
| 3 | Upload PDF | Dokumen tersimpan + hash SHA-256 |
| 4 | Upload non-PDF | Ditolak (400) |
| 5 | Tanda tangan | Status → Ditandatangani |
| 6 | Hash di blockchain | txHash + block number tercatat |
| 7 | Verifikasi dokumen asli | **VALID** |
| 8 | Verifikasi dokumen dimodifikasi | **TIDAK VALID** |
| 9 | Audit trail | Aktivitas tercatat |
| 10 | QR verification | QR membuka halaman verifikasi publik |

Smart contract: `cd smart_contract && npm test` (9 test pass).

## Keamanan

SHA-256 hashing · JWT (HS256) · bcrypt (cost 12) · Helmet (XSS/headers) ·
express-mongo-sanitize (NoSQL injection) · rate limiting · validasi Zod ·
upload PDF-only (mime+ekstensi, maks 20 MB) · CORS allowlist · HTTPS-ready.

## Lisensi

Skripsi pribadi — komponen open-source di dalamnya bebas digunakan dengan
menyebutkan sumbernya.
