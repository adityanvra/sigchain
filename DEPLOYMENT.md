# SIGCHAIN-UAD — Panduan Deployment (Free Tier)

Deploy SIGCHAIN-UAD sepenuhnya **gratis**: Vercel (frontend) + Render (backend) +
MongoDB Atlas (database) + Alchemy (RPC) + Sepolia (testnet). Estimasi ~30 menit.

| Komponen | Layanan | Free tier |
| --- | --- | --- |
| Smart contract | Ethereum Sepolia | testnet, ETH via faucet |
| RPC node | Alchemy | jutaan request/bulan |
| Database | MongoDB Atlas | M0 cluster 512 MB |
| Backend | Render | 750 jam/bulan (sleep saat idle) |
| Frontend | Vercel | 100 GB bandwidth/bulan |

## 1. Persiapan akun & wallet

1. **MetaMask** — pasang dari <https://metamask.io>. Buat **dompet test khusus**
   (jangan pakai dompet utama).
2. **Sepolia ETH** — klaim di <https://sepoliafaucet.com> (cukup 0.01 ETH).
3. **Alchemy** — <https://alchemy.com> → buat App: Network *Ethereum*, Chain
   *Sepolia*. Salin **HTTPS URL** (`https://eth-sepolia.g.alchemy.com/v2/<KEY>`).
4. **MongoDB Atlas** — <https://mongodb.com/atlas> → buat *M0 Free cluster*,
   region Singapore. Buat *Database User* + izinkan IP `0.0.0.0/0` (Network
   Access). Salin **connection string** (`mongodb+srv://...`).

## 2. Deploy smart contract

```bash
cd smart_contract
npm install
cp .env.example .env
```

Isi `.env`:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<KEY>
PRIVATE_KEY=<private key dompet test>
ETHERSCAN_API_KEY=<opsional>
```

Lalu:

```bash
npm test                 # 9 test pass
npm run deploy:sepolia
```

Output:

```
DocumentSignatureRegistry deployed at: 0xABC...123
Tx hash                              : 0x...
Block                                : 6xxxxxx
```

Catat **alamat kontrak**. Script otomatis meng-export ABI ke
`backend/src/blockchain/abi.json` dan `frontend/src/blockchain/abi.json`.

## 3. Deploy backend (Render)

1. Push repo ke GitHub.
2. Render → **New → Blueprint** → pilih repo (membaca `backend/render.yaml`).
3. Set environment variables:

   ```
   NODE_ENV          = production
   JWT_SECRET        = <random panjang>           (Render bisa generate)
   JWT_EXPIRES_IN    = 7d
   CORS_ORIGINS      = https://<frontend>.vercel.app
   MONGODB_URI       = mongodb+srv://USER:PASS@cluster/sigchain?retryWrites=true&w=majority
   SEPOLIA_RPC_URL   = https://eth-sepolia.g.alchemy.com/v2/<KEY>
   CHAIN_ID          = 11155111
   CONTRACT_ADDRESS  = 0xABC...123                ← dari langkah 2
   BLOCK_EXPLORER    = https://sepolia.etherscan.io
   MAX_UPLOAD_MB     = 20
   PUBLIC_VERIFY_URL = https://<frontend>.vercel.app/verify
   ```

4. Deploy. Cek `GET https://<backend>.onrender.com/api/health`.
5. (Opsional) buat akun demo: jalankan `npm run seed` di Render Shell, atau buat
   user admin lewat endpoint setelah membuat satu admin manual di DB.

> Render free tier **sleep** setelah 15 menit idle; request pertama ~30 detik.

> Catatan: penyimpanan berkas Render bersifat *ephemeral*. Untuk produksi nyata,
> integrasikan object storage (mis. S3) untuk `filePath`. Hash & metadata tetap
> aman di MongoDB + blockchain.

## 4. Deploy frontend (Vercel)

1. Vercel → **New Project** → import repo.
2. **Root Directory** → `frontend`. Build: `npm run build`, Output: `dist`.
3. Environment variables:

   ```
   VITE_API_URL          = https://<backend>.onrender.com/api
   VITE_CHAIN_ID         = 11155111
   VITE_CHAIN_NAME       = Sepolia
   VITE_CONTRACT_ADDRESS = 0xABC...123
   VITE_BLOCK_EXPLORER   = https://sepolia.etherscan.io
   ```

4. Deploy → URL `https://<frontend>.vercel.app`.
5. Kembali ke Render, pastikan `CORS_ORIGINS` & `PUBLIC_VERIFY_URL` memakai URL
   Vercel itu, lalu redeploy backend.

## 5. Uji end-to-end

1. Buka frontend, login (akun admin/akademik).
2. **Connect MetaMask** (di Profil) → switch ke Sepolia.
3. **Upload** PDF → hash SHA-256 muncul.
4. **Tandatangani** → MetaMask konfirmasi tx `storeDocumentHash` → tunggu ~15 dtk.
5. **Verifikasi** PDF sama → **VALID**; ubah 1 byte → **TIDAK VALID**.
6. Pindai **QR** → halaman verifikasi publik.

## Troubleshooting

| Gejala | Solusi |
| --- | --- |
| `/api/health` `blockchain.mock=true` padahal produksi | `SEPOLIA_RPC_URL` atau `CONTRACT_ADDRESS` belum di-set di Render |
| CORS error di browser | Tambahkan URL Vercel ke `CORS_ORIGINS`, redeploy backend |
| MetaMask *insufficient funds for gas* | Klaim Sepolia ETH lagi di faucet |
| Request Render lambat 30 dtk | Free tier sleep — wajar, ada loading state |
| `MongoServerError: bad auth` | Periksa user/password & Network Access (0.0.0.0/0) di Atlas |
| Upload hilang setelah redeploy | Disk Render ephemeral — gunakan object storage untuk produksi |

## Biaya

**Rp 0** selama memakai testnet + free tier. Migrasi ke mainnet menambah biaya
gas per transaksi tanda tangan.
