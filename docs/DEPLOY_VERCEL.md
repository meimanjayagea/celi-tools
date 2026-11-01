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

Konfigurasi kedua service, build commands, Dockerfile, dan routing ada di [vercel.json](../vercel.json). Frontend memakai root service `apps/web`; backend memakai root repository (`.`) dan Dockerfile `Dockerfile.api`, sehingga Docker context mencakup semua package workspace. Path service dan entrypoint ditetapkan relatif terhadap `vercel.json`. Vercel container menerima trafik HTTP pada port 80 secara default; Dockerfile juga menjalankan API pada port 80, kecuali platform memasok `PORT` lain.

Project framework harus Services agar konfigurasi `services` dipakai. Jangan mengubah Root Directory ke `apps/web` atau `apps/api`, karena kedua service membutuhkan konfigurasi monorepo dan Docker context root.

## 2. Hubungkan private Vercel Blob

Pada project yang sama, buka **Storage → Create → Blob** dan pilih akses **Private**, lalu hubungkan store ke project. Runtime server menggunakan integrasi Vercel; jangan menyalin token Blob ke `NEXT_PUBLIC_*` atau menyimpannya dalam repository. Bila store private sudah ada, cukup hubungkan ke project ini.

Client upload dikunci ke prefix `celi-input`, tipe dan ukuran file divalidasi lagi oleh API, dan pathname tidak pernah dipakai sebagai URL fetch bebas. Hasil disimpan pada `celi-output` dan diberikan lewat signed GET URL privat selama satu jam. API menghapus file input setelah proses, dan menghapus hasil ketika download dimulai. Hasil yang tertinggal karena tab ditutup dihapus saat permintaan file berikutnya jika usianya lebih dari 24 jam.

## 3. Environment Production

Masukkan konfigurasi autentikasi di **Settings → Environment Variables**. Gunakan [contoh env Vercel](../deploy/vercel/.env.example) sebagai daftar nama tanpa nilai kredensial asli.

Variabel penting:

| Variabel | Catatan |
| --- | --- |
| `AUTH_SECRET` | Secret acak server-side, minimal 32 byte |
| `AUTH_URL` | Origin web Production, HTTPS |
| `DATABASE_PROVIDER` | `prisma-postgres`, `supabase`, atau driver PostgreSQL yang didukung (opsional; default `postgres`) |
| `DATABASE_URL` | Satu koneksi PostgreSQL TLS untuk Auth.js `celi_auth` dan catatan `celi_app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Wajib untuk login Google dan pembuatan akun otomatis; simpan Client Secret sebagai secret server-side |
| `WEB_ORIGINS` | Daftar origin HTTPS yang diizinkan API, dipisahkan koma |
| `FILE_TOOLS_TRUST_PROXY` | `true` untuk membaca IP klien dari `x-vercel-forwarded-for` |

Tidak perlu mengatur `FILE_API_URL`: web dan API dilayani pada domain sama melalui rewrite. Gunakan satu database PostgreSQL. Sebelum mengaktifkan auth, ekspor `DATABASE_URL` untuk database target ke environment shell, periksa `npm run db:status`, lalu jalankan `npm run db:migrate` bila masih ada migrasi pending. Migrasi tidak dijalankan otomatis saat deploy. Runner merekam versi dan checksum di schema metadata terpisah `celi_meta.schema_migrations`; backup database sebelum penerapan production. Tidak ada dummy user/note dalam migration karena catatan dan identitas adalah data privat. Login hanya memakai Google OAuth dan akun baru dibuat otomatis saat login pertama. Jangan memasukkan nilai rahasia Google, DB, Auth.js, atau Blob ke konfigurasi frontend.

Untuk Google OAuth, buat OAuth Client bertipe Web application dan daftarkan Authorized redirect URI `${AUTH_URL}/api/auth/callback/google`. Nilai OAuth harus Client ID dan Client Secret, bukan API key. Selalu buka aplikasi melalui origin yang sama dengan `AUTH_URL`; Next.js Proxy mengarahkan alias Vercel lain ke sana agar cookie PKCE host-only tetap terkirim saat callback Google. Vercel deployment protection pada domain `vercel.app` dapat menghalangi pengunjung publik mencapai halaman login/callback; gunakan domain khusus publik atau tinjau proteksi deployment sebelum membuka auth ke pengguna.

Jika memakai database baru untuk Auth.js, jalankan `npm run db:migrate` pada koneksi target sebelum login dipakai. Migrasi berada di [apps/web/db/migrations](../apps/web/db/migrations); data Auth.js terisolasi di schema `celi_auth`, sedangkan ledger migrasi berada di schema `celi_meta` yang tidak perlu bisa dibaca oleh role runtime. Google harus mengembalikan alamat email terverifikasi; pengguna baru dibuat otomatis, dan alamat Google terverifikasi yang cocok dapat menautkan akun lama.

## 4. Deploy dan verifikasi

Commit dan push perubahan ke branch Production yang terhubung. Tunggu deployment sampai **Ready**, lalu periksa:

1. `/`, `/login`, dan `/api/auth/status` memberi HTTP 200; `/register` mengarahkan kembali ke `/login`.
2. `/api/auth/status` memberi `available: true` dan `google: true`; `/api/auth/providers` hanya menampilkan provider Google.
3. `/health`, `/ready`, dan `/api/files/capabilities` berhasil; semua engine yang diumumkan bernilai `true`.
4. Jalankan pemeriksaan sintetis tanpa mengirim email:

   ```sh
   npm run check:deployment -- --web https://domain-production-anda
   ```

   Ini mengunggah file sintetis melalui private Blob, meminta API membuat ZIP, mengunduh hasil dengan URL bertanda tangan, memeriksa byte ZIP, lalu menghapus hasilnya.

5. Uji manual file lebih dari 4,5 MB dan hasil besar dari browser. Buka DevTools Network dan pastikan konten file diunggah ke Blob dan API hanya menerima metadata file.
6. Uji login Google dengan akun uji yang diizinkan; pastikan login pertama membuat akun dan login berikutnya membuka akun yang sama.

## 5. Menjalankan lokal

```sh
npm ci
npm run dev
```

Jalankan seluruh perintah dari root repository. Web lokal berjalan pada port 3000 dan API pada 3001. Web lokal mengirim multipart langsung ke API lokal, jadi Blob Vercel tidak dibutuhkan. Gunakan `npm test`, `npm run lint`, `npm run typecheck`, dan `npm run check:layout` untuk pemeriksaan source/path. Dockerfile tetap dapat dijalankan terpisah melalui `docker compose up --build api`.

## Referensi

- [Vercel Services](https://vercel.com/kb/guide/vercel-services)
- [Menjalankan container di Vercel](https://vercel.com/kb/guide/docker)
- [Client uploads Vercel Blob](https://vercel.com/docs/vercel-blob/client-upload)
- [Private Vercel Blob](https://vercel.com/docs/vercel-blob/private-storage)
- [Signed URLs Vercel Blob](https://vercel.com/changelog/signed-urls-are-now-available-for-vercel-blob)
- [Batas Vercel Functions](https://vercel.com/docs/functions/limitations)
