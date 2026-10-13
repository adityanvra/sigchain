# SIGCHAIN-UAD — Database (MongoDB Atlas)

SIGCHAIN-UAD menggunakan **MongoDB** (MongoDB Atlas pada produksi) yang diakses
melalui **Mongoose** dari backend Node.js/Express. Skema didefinisikan secara
*code-first* di `backend/src/models`. Dokumen ini merangkum struktur koleksi,
indeks, dan cara melakukan seeding.

## Koneksi

Set `MONGODB_URI` pada `backend/.env`:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/sigchain?retryWrites=true&w=majority
```

> Jika `MONGODB_URI` dikosongkan, backend otomatis menjalankan **mock mode**
> dengan MongoDB in-memory (`mongodb-memory-server`) — cocok untuk demo cepat.
> Datanya tidak permanen.

## Koleksi

### `users`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `nama` | String | Nama lengkap |
| `email` | String | Unik, lowercase, terindeks |
| `password` | String | Hash bcrypt (cost 12), `select:false` |
| `role` | String | `admin` \| `staff_akademik` \| `staff_administrasi` \| `mahasiswa` |
| `jabatan` / `unit` / `nim` | Array / String / String | Kapasitas jabatan per orang, unit dan NIM mahasiswa |
| `walletAddress` | String\|null | Alamat wallet lama (opsional; tidak dibutuhkan untuk persetujuan akun) |
| `createdAt` / `updatedAt` | Date | Timestamps |

Indeks: `email` (unique).

### `documents`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `namaDokumen` | String | Nama dokumen |
| `description` | String | Deskripsi opsional |
| `filePath` | String | Lokasi berkas PDF di server |
| `fileName` | String | Nama berkas asli |
| `mimeType` | String | Selalu `application/pdf` |
| `fileSize` | Number | Ukuran (byte) |
| `hashDokumen` | String | SHA-256 hex (terindeks) |
| `transactionHash` | String\|null | Tx hash on-chain |
| `blockNumber` | Number\|null | Nomor block |
| `blockchainTimestamp` | Date\|null | Timestamp block |
| `uploader` | ObjectId → `users` | Pengunggah |
| `status` | String | DRAFT, UNSIGNED, SUBMITTED, READY_TO_SIGN, PARTIALLY_SIGNED, PENDING_APPROVAL, NEEDS_REVISION, REJECTED, PENDING_BLOCKCHAIN, SIGNED |
| `reviewer` / `signingSteps` / `currentStep` | ObjectId / Array / Number | Pemeriksa TU, tahap personal dan giliran aktif |
| `version` / `previousVersionId` / `supersededBy` | Number / ObjectId / ObjectId | Versi dokumen dan hubungan penerus; final lama tetap disimpan |
| `fileData` / `signedFileData` / `requestFileData` | Buffer | PDF awal, PDF bertanda tangan dan permohonan awal sebelum surat keluaran TU; tidak dikirim dalam JSON |
| `createdAt` / `updatedAt` | Date | Timestamps |

Indeks: `hashDokumen`, `uploader`, `status`.

### `signatures`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `documentId` | ObjectId → `documents` | Dokumen yang ditandatangani |
| `signer` | ObjectId → `users` | Penandatangan |
| `walletAddress` | String atau null | Wallet server pencatat akhir; null untuk persetujuan tahap perantara |
| `recordingMethod` / `capacity` / `stepIndex` | String / String / Number | account_approval, server_wallet atau browser_wallet lama; kapasitas dan nomor tahap |
| `signature` | String | Signature wallet server atas pesan persetujuan; data lama bisa berisi signature wallet browser |
| `transactionHash` | String\|null | Tx hash on-chain |
| `blockNumber` | Number\|null | Nomor block |
| `timestamp` | Date | Waktu penandatanganan |

Indeks: `documentId`, `signer`.

### `audittrails`

| Field | Tipe | Keterangan |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `userId` | ObjectId → `users` \| null | Pelaku aktivitas |
| `aktivitas` | String | Deskripsi human-readable |
| `action` | String | `LOGIN`,`LOGOUT`,`UPLOAD`,`DELETE`,`SIGN`,`VERIFY`,`USER_*`,`PROFILE_UPDATE` |
| `metadata` | Mixed | Data tambahan (documentId, txHash, dll.) |
| `ipAddress` | String | IP pelaku |
| `timestamp` | Date | Waktu (terindeks) |

## Seeding

Koleksi `notifications` menyimpan user penerima, documentId, pesan, readAt dan emailStatus (disabled/pending/sent/failed). Akses hanya untuk penerima. Audit mencakup WORKFLOW, SUBMIT, REVIEW dan REVISION beserta metadata versi, tahap dan alasan.

Akun demo (satu per role) dapat dibuat dengan:

```bash
cd backend
npm run seed
```

Akun yang dibuat (password semua: `password123`):

| Email | Role |
| --- | --- |
| `admin@uad.ac.id` | admin |
| `akademik@uad.ac.id` | staff_akademik |
| `administrasi@uad.ac.id` | staff_administrasi |
| `mahasiswa@uad.ac.id` | mahasiswa |

Atau gunakan `database/seed.mongodb.js` di **MongoDB Shell (mongosh)** /
**MongoDB Compass** bila ingin men-seed langsung ke Atlas tanpa menjalankan
backend (lihat catatan hashing di file tersebut).

## Diagram relasi (logical)

```
users 1───∞ documents 1───∞ signatures
  │                              
  └───────────∞ audittrails       
```

Record baru menambahkan `recordingMethod=server_wallet`, `approvalMessage`, dan `approvedAt` pada Signature. `signer` tetap ID akun pemberi persetujuan. Document menyimpan `approvalUserId`, `approvalAt`, dan lease sementara `blockchainLockUntil` untuk mencegah pengiriman ganda.
