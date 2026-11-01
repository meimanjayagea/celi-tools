# Autentikasi Google

Web menggunakan Auth.js, PostgreSQL, dan Google OAuth. Google adalah satu-satunya metode autentikasi. Saat login pertama berhasil, Auth.js membuat akun Celi Tools dan menautkan identitas Google; login berikutnya menggunakan akun yang sama. Tidak ada form registrasi terpisah atau login tautan email.

Pengguna lama yang pernah masuk dengan tautan email dapat melanjutkan dengan Google bila alamat emailnya sama dan diverifikasi Google. Auth.js menautkannya ke user yang sudah ada; callback server menolak profil Google yang tidak memiliki `email_verified=true`. Status keberadaan email tidak disediakan lewat endpoint publik.

## Siapkan database

Gunakan PostgreSQL database khusus atau database PostgreSQL yang sudah dipakai aplikasi. Migrasi menempatkan semua tabel auth di schema `celi_auth`, sehingga tabel `users`/`sessions` milik aplikasi lain tidak berubah. Jalankan migrasi dari root repository menggunakan kredensial yang boleh membuat schema:

```sh
npm run db:status
npm run db:migrate
npm run db:status
```

Perintah memakai `DATABASE_URL` dari environment shell. Untuk database lokal di `apps/web/.env.local`, gunakan `npm run db:status:local` dan `npm run db:migrate:local`; pastikan URL menunjuk ke target yang benar. Runner menerapkan `apps/web/db/migrations/*.sql` berurutan, dalam transaksi, dan mencatat checksum serta versi pada schema terpisah `celi_meta.schema_migrations`. Migrasi lama yang sudah membuat tabel `celi_auth` bisa diadopsi tanpa menghapus tabel atau baris.

Login Google memerlukan tabel `users`, `accounts`, dan `sessions`. Tabel `verification_token` serta limiter email/IP dari versi terdahulu tetap berada di database, tetapi tidak digunakan atau dihapus oleh versi ini. Gunakan role migrasi yang dapat membuat schema metadata. Jangan jalankan aplikasi dengan kredensial superuser; role runtime hanya perlu akses pada schema dan tabel Auth.js serta `celi_app` yang diperlukan aplikasi.

Backup database sebelum migrasi production. Migrasi yang sudah pernah dipakai jangan diedit; tambahkan perubahan berikutnya sebagai file bernomor baru. Jangan menambahkan seed user atau note ke database production karena identitas dan catatan adalah data privat.

## Environment web

Salin `apps/web/.env.example` ke `apps/web/.env.local`. Variabel berikut harus berada di environment **server-side**:

| Variabel | Fungsi |
| --- | --- |
| `AUTH_SECRET` | Kunci acak Auth.js minimal 32 byte; buat dengan `openssl rand -base64 32`. |
| `AUTH_URL` | Origin kanonis web, misalnya `http://localhost:3000` atau origin HTTPS production. |
| `DATABASE_PROVIDER` | `postgres` (default), `supabase`, `prisma-postgres`, `neon`, `vercel-postgres`, atau `none`. PostgreSQL provider memakai satu pool `pg`. `none` menonaktifkan login dan persistence database. |
| `DATABASE_URL` | Satu-satunya koneksi PostgreSQL server-side untuk Auth.js dan catatan aplikasi. Gunakan TLS di production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Kredensial OAuth Client bertipe Web application dari Google Cloud Console. Client Secret hanya disimpan server-side. |

Daftarkan Authorized redirect URI `${AUTH_URL}/api/auth/callback/google` di Google Cloud Console. Gunakan OAuth Client ID dan Client Secret, bukan API key. Buka aplikasi menggunakan origin `AUTH_URL`; aplikasi mengarahkan alias Vercel lain ke origin itu supaya cookie PKCE yang bersifat host-only tetap tersedia saat callback Google kembali. Supabase dan Prisma Postgres memakai koneksi PostgreSQL langsung; jangan gunakan Supabase publishable/anon key sebagai database URL. Engine selain PostgreSQL memerlukan adapter Auth.js dan skema khusus.

Jangan menaruh `AUTH_SECRET`, `DATABASE_URL`, atau Google Client Secret pada variabel `NEXT_PUBLIC_*`, file yang di-commit, atau bundle browser. Auth status di `/api/auth/status` hanya mengembalikan boolean konfigurasi dan tidak membuka kredensial.

## Perilaku login

- Tombol login memulai OAuth Google. Aplikasi tidak meminta atau mengirim tautan email.
- Google memverifikasi identitas dan email. Profil tanpa email terverifikasi ditolak.
- Akun baru dibuat otomatis setelah login Google pertama berhasil.
- Login selanjutnya menemukan akun melalui identitas Google yang sudah ditautkan.
- User lama dengan email terverifikasi yang sama dapat ditautkan tanpa kehilangan ID atau data Sticky Note.
- `/register` mengarahkan pengguna ke `/login` agar tautan lama tetap berfungsi.
- Logout menghapus sesi database.

## Deployment dan pemeriksaan

1. Pastikan koneksi PostgreSQL target dan schema sudah siap dengan `npm run db:status`; terapkan migrasi pending menggunakan `npm run db:migrate` bila diperlukan.
2. Isi `AUTH_SECRET`, `AUTH_URL`, `DATABASE_PROVIDER`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `FILE_API_SIGNING_SECRET` pada environment server Vercel. Signing secret juga harus ada di API service.
3. Pastikan Google OAuth Client menerima callback URI production yang tepat.
4. Setelah deploy, `/api/auth/status` harus mengembalikan HTTP 200 dengan `available: true` dan `google: true`. `/api/auth/providers` hanya menampilkan Google.
5. Uji dengan akun Google yang Anda kuasai. Periksa sesi, logout, kemudian login lagi untuk memastikan akun yang sama digunakan. Untuk akun lama, pastikan email Google yang sama dan terverifikasi.

Sticky Note menggunakan sesi Auth.js dan selalu membatasi query berdasarkan user ID dari sesi server; `user_id` tidak diterima dari klien. Pengingat browser berjalan saat halaman Sticky Note terbuka dan izin notifikasi aktif, bukan melalui push service saat browser ditutup.

Route converter, compress, dashboard, JSON, Crypto, dan Sticky Note mensyaratkan sesi Auth.js. Route upload juga memeriksa sesi dan Origin. API file production memverifikasi token HMAC singkat yang hanya diterbitkan web setelah sesi tervalidasi.
