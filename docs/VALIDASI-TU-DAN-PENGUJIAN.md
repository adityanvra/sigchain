# Paket validasi stakeholder dan pengujian revisi

Status: bahan untuk pelaksanaan, bukan hasil validasi TU atau skor penerimaan. Pengujian otomatis yang dilakukan agen harus ditulis terpisah dari pengujian bersama pengguna sebenarnya.

## Agenda validasi bersama TU

Bawa contoh PDF belum ditandatangani, contoh permohonan mahasiswa, dan contoh surat keluaran TU. Konfirmasi identitas/jabatan narasumber, tanggal, layanan yang dibahas, dan perubahan alur usulan. Narasumber pada PDF awal ditulis Didik Muhamad Arif, S.E.; konfirmasikan ejaan/jabatan saat pencatatan.

Pertanyaan yang perlu disepakati:

1. Unit/layanan dan jenis dokumen mana yang masuk studi kasus? Bedakan surat yang disusun TU dengan dokumen yang disiapkan mahasiswa.
2. Apa data dan lampiran permohonan yang wajib? Siapa pemeriksa dan apakah memerlukan paraf KTU?
3. Siapa penandatangan per jenis dokumen? Dalam kapasitas apa dan dengan urutan apa? Kapan Wakil Dekan atau pejabat pengganti diperbolehkan?
4. Apakah mahasiswa menandatangani permohonan sendiri sebelum upload atau perlu tanda tangan di aplikasi? Implementasi sekarang memperlakukan mahasiswa sebagai pemohon.
5. Siapa boleh mengatur urutan, mengembalikan berkas, serta mengganti pejabat sebelum pengajuan?
6. Apakah notifikasi dalam aplikasi cukup? Jika email diperlukan, siapa pengelola akun SMTP dan alamat pengirim resmi?
7. Apakah halaman QR tambahan pada PDF diterima dalam format surat yang digunakan? Jika tidak, sepakati area QR pada template sebelum mengubah finalisasi.
8. Bagaimana koreksi surat final dilakukan dan bagaimana versi lama ditandai untuk pemakai?

Catat per butir: jawaban narasumber, bukti/template, keputusan, kebutuhan yang berubah, penanggung jawab, dan tanggal persetujuan. Jangan menyatakan alur telah divalidasi hanya berdasarkan foto wawancara lama.

## Uji fungsi bersama pengguna

Gunakan akun terpisah: Mahasiswa A/B, pemeriksa TU, pembimbing, penguji, Dekan, Admin. Isi nama/jabatan sesuai konteks yang disepakati; data dokumen untuk pengujian boleh berupa data uji yang diberi label. Jangan mengirim dokumen rahasia ke chain; yang dicatat hanya hash.

Untuk tiap skenario, rekam kode, FR/use case, prasyarat, input, expected result, actual result, status berhasil/gagal, bukti screenshot/tx/hash, nama/kode tester, role dan tanggal. Jika tester tidak memiliki akses suatu fungsi, tulis tidak dijalankan/NA, bukan berhasil.

Skenario wajib:

- Login: benar/benar, benar/salah, salah/benar, salah/salah. Semua kegagalan memakai pesan generik.
- Mahasiswa: unggah valid/non-PDF, simpan alur, submit, lihat hanya dokumen sendiri, coba URL detail/file/QR mahasiswa lain, coba dashboard/manajemen user.
- TU: hanya reviewer personal menerima dan memeriksa; siapkan surat keluaran; setujui; alasan perbaikan/penolakan wajib.
- Penandatangan: coba sebelum giliran; tiga tahap berurutan; satu akun dalam dua kapasitas; penolakan; PNG transparan; posisi di luar halaman; benturan dengan tanda tangan sebelumnya; klik ganda.
- Final: PDF semua tanda tangan dan QR, hash final dari byte unduhan, receipt cocok, status pending jika jaringan bermasalah, retry pada transaksi yang sama, dua dokumen bersamaan.
- Versi: perbaikan menghasilkan ID baru, hubungan versi tampil, dokumen final lama/hash tidak berubah, pemeriksaan/persetujuan ulang pada penerus.
- Verifikasi: QR referensi tanpa unggahan, PDF asli, nama file berubah, byte berubah terhadap referensi, hash asing tanpa referensi, dokumen belum selesai dan RPC gagal. Pemeriksa harus dapat memahami perbedaannya.
- Notifikasi: reviewer, giliran berikutnya, perbaikan, selesai; hanya pemilik boleh menandai dibaca; email bila SMTP sudah dikonfigurasi.
- Responsivitas: laptop dan ponsel, menu, formulir, PDF, penggeseran/resize dengan sentuhan, unduhan dan QR.
- Nonfungsional: akses API/URL, HTTPS pada deployment nyata, integritas PDF, waktu proses pada ukuran file/jaringan yang dicatat. Bedakan waktu pengolahan PDF dari waktu konfirmasi jaringan.

Rekap black-box = jumlah skenario berhasil / jumlah skenario yang benar-benar dijalankan × 100%. Pisahkan per role dan versi aplikasi. Jika menggabungkan beberapa tester, jelaskan apakah denominator adalah skenario unik atau eksekusi tester. Jangan membawa angka 27/27 lama sebagai hasil fitur yang baru ditambahkan.

## Evaluasi kegunaan

Mintakan persetujuan pembimbing tentang instrumen, jumlah/karakteristik responden, versi terjemahan dan interpretasi. SUS disebut jelas dalam transkrip; istilah alternatif yang terdengar tidak dipastikan. Pengguna perlu mencoba tugas representatif sebelum mengisi kuesioner.

SUS menggunakan 10 butir dan lima tingkat jawaban. Gunakan butir standar/terjemahan yang disepakati, jangan mengganti pertanyaan dengan daftar fitur buatan. Rekam jawaban mentah Q1–Q10, kode responden, role, tanggal, tugas yang dicoba, serta kendala. Skor individu kemudian direkap dengan jumlah responden dan variasi hasil; keterbatasan sampel kecil perlu dijelaskan. Ini skor instrumen, bukan persentase skenario black-box. [Sumber metodologi dan butir standar](https://arxiv.org/html/2101.00455).

Belum ada responden atau data SUS hasil revisi pada sesi ini. Karena itu skor, kategori penerimaan, dan pernyataan “diterima pengguna” belum boleh dimasukkan sebagai hasil penelitian.

## Bukti untuk semhas/sidang

Siapkan: catatan validasi TU, daftar kebutuhan final, diagram sesuai kode, screenshot alur Mahasiswa → TU → beberapa penandatangan, PDF asli/final/berubah, perbandingan hash, bukti transaksi Sepolia nyata, rekap black-box bertanggal, jawaban evaluasi pengguna, serta kesimpulan yang menjawab dua rumusan.

Rekam konfigurasi jaringan dan lingkungan pengujian tanpa private key, token JWT, password SMTP atau kredensial database. Tes RPC lokal memberikan bukti fungsi kode, bukan bukti transaksi Etherscan; transaksi Sepolia nyata harus dibuktikan dari lingkungan yang sudah dikonfigurasi.
