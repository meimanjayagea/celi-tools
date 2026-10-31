# Deploy Celi Tools ke Vercel

Repository ini menjalankan web Next.js dan API file container dalam satu project Vercel menggunakan **Vercel Services**. File besar tidak dikirim sebagai body Function Vercel: browser mengunggah langsung ke private Vercel Blob, lalu API menariknya ke container untuk diproses.

## 1. Konfigurasi project

Hubungkan repository `celi-tools` ke project Vercel, lalu atur:

| Pengaturan | Nilai |
| --- | --- |
| Root Directory | Repository root (`.`) |
| Framework Preset | **Services** |
| Node.js Version | **26.x** (Vercel mengelola patch keamanan terbaru secara otomatis) |
| Include source files outside Root Directory | Aktif |

Konfigurasi kedua service, build commands, Dockerfile, dan routing ada di [vercel.json](./vercel.json). Frontend memakai `apps/web`; backend membangun `Dockerfile.api` dari root repository agar Docker context mencakup semua package workspace. Vercel container menerima trafik HTTP pada port 80 secara default; Dockerfile juga menjalankan API pada port 80, kecuali platform memasok `PORT` lain.

Project framework harus Services agar konfigurasi `services` dipakai. Jangan mengubah Root Directory ke `apps/web` atau `apps/api`, karena kedua service membutuhkan konfigurasi monorepo dan Docker context root.

## 2. Hubungkan private Vercel Blob

Pada project yang sama, buka **Storage → Create → Blob** dan pilih akses **Private**, lalu hubungkan store ke project. Runtime server menggunakan integrasi Vercel; jangan menyalin token Blob ke `NEXT_PUBLIC_*` atau menyimpannya dalam repository. Bila store private sudah ada, cukup hubungkan ke project ini.

Client upload dikunci ke prefix `celi-input`, tipe dan ukuran file divalidasi lagi oleh API, dan pathname tidak pernah dipakai sebagai URL fetch bebas. Hasil disimpan pada `celi-output` dan diberikan lewat signed GET URL privat selama satu jam. API menghapus file input setelah proses, dan menghapus hasil ketika download dimulai. Hasil yang tertinggal karena tab ditutup dihapus saat permintaan file berikutnya jika usianya lebih dari 24 jam.

## 3. Environment Production

Masukkan konfigurasi autentikasi di **Settings → Environment Variables**. Gunakan [contoh env Vercel](./deploy/vercel/.env.example) sebagai daftar nama tanpa nilai kredensial asli.

Variabel penting:

| Variabel | Catatan |
| --- | --- |
| `AUTH_SECRET` | Secret acak server-side, minimal 32 byte |
| `AUTH_URL` | Origin web Production, HTTPS |
| `AUTH_DATABASE_PROVIDER` | `prisma-postgres`, `supabase`, atau driver PostgreSQL yang didukung |
| `DATABASE_URL` | Koneksi PostgreSQL TLS untuk schema Auth.js `celi_auth` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Provider email untuk magic link |
| `WEB_ORIGINS` | Daftar origin HTTPS yang diizinkan API, dipisahkan koma |
| `FILE_TOOLS_TRUST_PROXY` | `true` untuk membaca IP klien dari `x-vercel-forwarded-for` |

Tidak perlu mengatur `FILE_API_URL`: web dan API dilayani pada domain sama melalui rewrite. Tidak ada migrasi database file baru; skema auth yang telah dibuat di schema `celi_auth` tetap digunakan. Pertahankan variabel auth yang sudah terpasang. Jangan memasukkan nilai rahasia SMTP, DB, Auth.js, atau Blob ke konfigurasi frontend.

Jika memakai database baru untuk Auth.js, jalankan [apps/web/db/001_auth.sql](./apps/web/db/001_auth.sql) satu kali pada schema target sebelum login dipakai. Koneksi production yang ada memakai schema terisolasi `celi_auth`.

## 4. Deploy dan verifikasi

Commit dan push perubahan ke branch Production yang terhubung. Tunggu deployment sampai **Ready**, lalu periksa:

1. `/`, `/login`, dan `/register` memberi HTTP 200.
2. `/api/auth/status` memberi `available: true`; `/api/auth/providers` menampilkan provider email.
3. `/health`, `/ready`, dan `/api/files/capabilities` berhasil; semua engine yang diumumkan bernilai `true`.
4. Jalankan pemeriksaan sintetis tanpa mengirim email:

   ```sh
   npm run check:deployment -- --web https://domain-production-anda
   ```

   Ini mengunggah file sintetis melalui private Blob, meminta API membuat ZIP, mengunduh hasil dengan URL bertanda tangan, memeriksa byte ZIP, lalu menghapus hasilnya.

5. Uji manual file lebih dari 4,5 MB dan hasil besar dari browser. Buka DevTools Network dan pastikan konten file diunggah ke Blob dan API hanya menerima metadata file.
6. Untuk memverifikasi SMTP sepenuhnya, gunakan alamat uji yang diizinkan pemiliknya, kirim magic link, dan buka link tersebut. Pemeriksaan deployment tidak mengirim email.

## 5. Menjalankan lokal

```sh
npm ci
npm run dev
```

Web lokal berjalan pada port 3000 dan API pada 3001. Web lokal mengirim multipart langsung ke API lokal, jadi Blob Vercel tidak dibutuhkan. Gunakan `npm test`, `npm run lint`, dan `npm run typecheck` untuk pemeriksaan source. Dockerfile tetap dapat dijalankan terpisah melalui `docker compose up --build api`.

## Referensi

- [Vercel Services](https://vercel.com/kb/guide/vercel-services)
- [Menjalankan container di Vercel](https://vercel.com/kb/guide/docker)
- [Client uploads Vercel Blob](https://vercel.com/docs/vercel-blob/client-upload)
- [Private Vercel Blob](https://vercel.com/docs/vercel-blob/private-storage)
- [Signed URLs Vercel Blob](https://vercel.com/changelog/signed-urls-are-now-available-for-vercel-blob)
- [Batas Vercel Functions](https://vercel.com/docs/functions/limitations)
