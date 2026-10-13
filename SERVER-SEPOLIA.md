# Pencatatan Sepolia melalui backend lokal

Alur pengajuan: mahasiswa login → mengunggah PDF → menyimpan pemeriksa TU dan penandatangan berurutan → mengajukan ke TU → pemeriksaan TU → persetujuan personal setiap tahap. Penandatangan terakhir mengesahkan PDF yang sudah memuat semua tanda tangan dan QR. Backend menghitung SHA-256 dan mencatat hash final dengan wallet server; detail menyediakan bukti Sepolia Etherscan saat transaksi nyata berhasil. Tahap sebelumnya hanya mencatat persetujuan akun dan belum mengirim transaksi blockchain. Lihat [REVISI-SEMHAS.md](REVISI-SEMHAS.md).

Pengguna tidak memasang atau menghubungkan MetaMask. Persetujuan dicatat atas ID akun pengguna yang terautentikasi. `Signature.signer` menunjuk pengguna tersebut, sedangkan `walletAddress` merupakan wallet server yang mencatat transaksi. Signature pesan server mengikat ID dokumen, hash, pengguna pemberi persetujuan, dan waktu persetujuan; ini bukan tanda tangan wallet pribadi dosen atau sertifikasi PSrE.

## Konfigurasi lokal

Isi `backend/.env` secara lokal:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/ISI_RPC_ANDA
CHAIN_ID=11155111
CONTRACT_ADDRESS=0xALAMAT_KONTRAK_SEPOLIA_ANDA
BLOCKCHAIN_PRIVATE_KEY=0xPRIVATE_KEY_WALLET_PENCATAT_TEST
BLOCK_EXPLORER=https://sepolia.etherscan.io
```

Gunakan wallet khusus Sepolia dengan saldo test ETH untuk gas. Isi private key langsung pada konfigurasi backend, bukan di chat, frontend, atau variabel `VITE_*`. `.env` tidak boleh dikomit. Wallet deployer dan wallet pencatat dapat berbeda pada kontrak saat ini, tetapi pilih dan dokumentasikan wallet pencatat institusi yang digunakan.

Jalankan `npm run dev` dari folder backend dan frontend pada terminal terpisah. Frontend lokal menggunakan `VITE_API_URL=http://localhost:5000/api`. Database tetap memakai `MONGODB_URI` yang dikonfigurasi; bila kosong, database demo hanya bertahan selama proses berjalan.

Periksa `GET /api/health`: untuk pencatatan nyata, `blockchain.mock` harus `false` dan `blockchain.signingReady` harus `true`. `signingReady` hanya menunjukkan key diisi; validitas key, jaringan, koneksi, kontrak dan saldo tetap diperiksa saat transaksi. Config publik tidak memuat private key.

Jika RPC/kontrak kosong, mode demo lama tetap tersedia dan diberi label simulasi. Jika RPC/kontrak tersedia tetapi key server kosong, pengesahan gagal dengan pesan konfigurasi, bukan menghasilkan transaksi simulasi. Bukti demo tidak diberi tautan Etherscan.

## Bukti untuk semhas/sidang

1. Unggah PDF baru dan terapkan tanda tangan lewat editor.
2. Tunggu status `SIGNED`. Backend menunggu receipt berhasil dan memeriksa alamat kontrak, pengirim serta event `DocumentStored` dengan hash PDF yang tepat.
3. Buka tab Blockchain pada detail dokumen: transaction hash, nomor blok, timestamp dan tautan Etherscan tampil.
4. Buka tautan `https://sepolia.etherscan.io/tx/<transactionHash>` untuk melihat transaksi nyata. Pengirim transaksi adalah wallet pencatat server.
5. Unduh PDF final, unggah ke verifikasi, lalu cocokkan hash dengan catatan. Mengganti nama file saja tidak mengubah hash; mengubah byte PDF menghasilkan hash berbeda.

Waktu konfirmasi bergantung jaringan. Jika koneksi atau waktu tunggu gagal setelah transaksi terkirim, status tetap `PENDING_BLOCKCHAIN`; nomor transaksi disimpan. Klik **Sahkan Dokumen** untuk melanjutkan pemeriksaan transaksi tersebut. Jangan menerapkan ulang gambar tanda tangan pada PDF final yang menunggu pencatatan. Transaksi gagal/revert dapat dikirim ulang setelah penyebabnya diperbaiki.

## Perubahan API

`POST /documents/:id/sign/confirm` menerima JSON `{}` dan Bearer token. Backend memilih hash PDF tersimpan, pengguna pemberi persetujuan, wallet pencatat dan transaksi. Payload walletAddress/signature/transactionHash dari browser ditolak. Endpoint `sign/prepare` tetap tersedia sebagai informasi status/config publik.

Satu proses backend lokal mengantre pengiriman dari wallet bersama untuk menghindari nonce sama. Lease dokumen di MongoDB mencegah klik ganda. Jika deployment menggunakan beberapa worker/proses dengan wallet sama, gunakan antrean transaksi bersama sebelum meningkatkan concurrency; antrean nonce saat ini berada dalam satu proses.

## Pengujian

Dari folder `backend`:

```powershell
npm run typecheck
npm run test:server-signing
```

Pengujian menggunakan MongoDB sementara, PDF uji, akun uji, dan mode simulasi terisolasi. Untuk menguji transaksi RPC nyata tanpa menggunakan saldo Sepolia, jalankan node Hardhat pada port terpisah dari folder `smart_contract`:

```powershell
npm run node -- --port 18545
```

Lalu di folder `backend`:

```powershell
$env:TEST_CHAIN_RPC_URL='http://127.0.0.1:18545'
npm run test:server-signing
Remove-Item Env:TEST_CHAIN_RPC_URL
```

Tes membuat wallet sementara, mendanainya dari akun node uji, serta deploy kontrak uji. Tes memeriksa akses, payload palsu, klik ganda, hash PDF unduhan, verifikasi, receipt salah hash, key server kosong, dan retry setelah timeout. Pengujian node lokal ini tidak menghasilkan bukti Etherscan; bukti publik baru ada setelah pencatatan nyata ke Sepolia dengan konfigurasi Anda.

## Penyesuaian skripsi

Ganti alur otorisasi MetaMask browser menjadi persetujuan pengguna terautentikasi dan pencatatan hash oleh wallet server. Sesuaikan kebutuhan fungsional, arsitektur, sequence/activity diagram, implementasi, screenshot, pengujian, abstrak dan kesimpulan. Jelaskan pemisahan pemberi persetujuan (akun dosen) dan pengirim transaksi (wallet server). Blockchain tetap Ethereum Sepolia, bukan blockchain privat/lokal; yang berjalan lokal adalah backend aplikasi.
