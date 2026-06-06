# SIGCHAIN-UAD — Backend API

REST API untuk SIGCHAIN-UAD. Dibangun dengan **Node.js + Express + TypeScript**,
**MongoDB (Mongoose)**, **Ethers.js v6**, dan autentikasi **JWT**.

## Menjalankan secara lokal

```bash
cd backend
npm install
cp .env.example .env          # isi nilai, atau biarkan kosong untuk MOCK MODE
npm run seed                  # buat 3 akun demo (opsional)
npm run dev                   # http://localhost:5000
```

- **MOCK MODE**: bila `MONGODB_URI` kosong → MongoDB in-memory; bila
  `SEPOLIA_RPC_URL`/`CONTRACT_ADDRESS` kosong → blockchain disimulasikan.
  Semua endpoint tetap berjalan.
- Build produksi: `npm run build && npm run start`.

## Environment

Lihat `.env.example`. Variabel penting: `JWT_SECRET`, `MONGODB_URI`,
`SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS`, `CORS_ORIGINS`, `PUBLIC_VERIFY_URL`.

## Autentikasi

Semua endpoint terproteksi memakai header:

```
Authorization: Bearer <JWT>
```

Role: `admin`, `staff_akademik`, `staff_administrasi`.

## Daftar Endpoint

| Method | Path | Auth | Keterangan |
| --- | --- | --- | --- |
| GET | `/api/health` | – | Status server + konfigurasi blockchain |
| POST | `/api/auth/login` | – | Login → `{ token, user }` |
| POST | `/api/auth/register` | admin | Buat user (bootstrap) |
| GET | `/api/auth/me` | ✓ | Profil user saat ini |
| PUT | `/api/auth/profile` | ✓ | Update nama / wallet |
| POST | `/api/auth/logout` | ✓ | Logout (audit) |
| GET | `/api/users` | admin | List user |
| POST | `/api/users` | admin | Buat user |
| PUT | `/api/users/:id` | admin | Update user |
| DELETE | `/api/users/:id` | admin | Hapus user |
| POST | `/api/documents` | staff/admin | Upload PDF (multipart `file`) → hash SHA-256 |
| GET | `/api/documents` | ✓ | List dokumen (`?status=&q=`) |
| GET | `/api/documents/:id` | ✓ | Detail + signatures + QR |
| GET | `/api/documents/:id/file` | ✓ | Preview/Download PDF (`?download=1`) |
| GET | `/api/documents/:id/qrcode` | ✓ | QR code PNG |
| DELETE | `/api/documents/:id` | ✓ | Hapus dokumen |
| POST | `/api/documents/:id/sign/prepare` | admin/akademik | Data untuk MetaMask |
| POST | `/api/documents/:id/sign/confirm` | admin/akademik | Catat tanda tangan + on-chain |
| GET | `/api/verify/:hash` | – | Verifikasi publik (QR) |
| POST | `/api/verify` | – | Verifikasi via upload PDF (`file`) |
| GET | `/api/audit` | ✓ | Audit trail (admin: semua) |
| GET | `/api/audit/me` | ✓ | Audit trail milik sendiri |
| GET | `/api/dashboard/stats` | ✓ | Statistik dashboard |

### Contoh alur tanda tangan (real mode)

1. `POST /api/documents/:id/sign/prepare` → `{ hash, contractAddress, chainId }`.
2. Frontend memanggil `storeDocumentHash(hash, wallet)` lewat MetaMask → `txHash`.
3. `POST /api/documents/:id/sign/confirm` `{ walletAddress, signature, transactionHash }`.
4. Backend menunggu receipt, mencatat `blockNumber` + `timestamp`, set status `SIGNED`.

Pada **mock mode** langkah 2 dilewati; backend menyimpan hash di registry
in-memory dan menghasilkan receipt simulasi.

## Keamanan

- Password hashing **bcrypt** (cost 12).
- **JWT** HS256 + middleware `authorize(...roles)`.
- **helmet** (header keamanan / XSS), **express-mongo-sanitize** (NoSQL
  injection), **express-rate-limit** (limit umum + ketat untuk login).
- Validasi input via **zod**; upload hanya PDF (mime + ekstensi), maks 20 MB.
- CORS dibatasi via `CORS_ORIGINS`.

## Struktur

```
backend/src
├── app.ts            # express app + middleware global
├── server.ts         # bootstrap (connect DB → listen)
├── config/           # env.ts, db.ts
├── models/           # User, Document, Signature, AuditTrail (Mongoose)
├── middleware/       # auth, validate, rateLimiter, upload, errorHandler
├── controllers/      # auth, user, document, signature, verification, audit, dashboard
├── routes/           # router per domain + index
├── services/         # hashService, blockchainService, qrService, auditService
├── blockchain/       # abi.json (di-sync dari smart_contract saat deploy)
├── seed/             # seed.ts (akun demo)
└── utils/            # jwt, ApiError, asyncHandler
```
