# Autentikasi email

Web menggunakan Auth.js passwordless dengan PostgreSQL adapter dan SMTP. Koneksi database opsional saat menjalankan fitur web tanpa login; login email otomatis nonaktif sampai koneksi dan semua konfigurasi email tersedia. Google OAuth serta Supabase Auth tidak dipakai. Auth.js mengirim link bertanda tangan, menyimpan token verifikasi sekali pakai pada database, lalu membuat sesi database setelah link dikonfirmasi. Link berlaku 10 menit; permintaan dibatasi 10 kali per IP dan satu kali per alamat email dalam 60 detik.

## Siapkan database

Gunakan PostgreSQL database khusus atau database PostgreSQL yang sudah dipakai aplikasi. Migrasi menempatkan semua tabel auth di schema terpisah `celi_auth`, sehingga tabel `users`/`sessions` milik aplikasi lain tidak berubah. Jalankan migrasi berikut sekali menggunakan kredensial yang boleh membuat schema:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/db/001_auth.sql
```

Jangan jalankan aplikasi dengan kredensial superuser. Jika migrasi dijalankan dengan role terpisah, berikan role runtime hanya akses baca/tulis tabel auth dan sequence terkait setelah migrasi:

```sql
GRANT USAGE ON SCHEMA celi_auth TO celi_auth_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA celi_auth TO celi_auth_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA celi_auth TO celi_auth_app;
```

Sesuaikan nama role dengan database Anda. Pool Auth.js mengatur `search_path` ke `celi_auth,public`; role runtime hanya perlu akses ke schema `celi_auth`. Database menyimpan identitas pengguna, sesi, token verifikasi, serta HMAC email/IP untuk pembatasan. Vercel menyediakan `x-vercel-forwarded-for`; pada production, pengiriman email ditolak jika IP tepercaya tersebut tidak tersedia. Token link disimpan dengan hash yang dibuat Auth.js, bukan token mentah.

## Atur web dan SMTP

Salin `apps/web/.env.example` ke `apps/web/.env.local`. Isi variabel berikut di environment **server-side** untuk lokal maupun Vercel:

| Variabel | Fungsi |
| --- | --- |
| `AUTH_SECRET` | Kunci acak Auth.js untuk mengamankan token/cookie; buat rahasia minimal 32 byte |
| `AUTH_URL` | Origin kanonis web, misalnya `http://localhost:3000` atau origin HTTPS production |
| `AUTH_DATABASE_PROVIDER` | `postgres` (default), `supabase`, `prisma-postgres`, `neon`, `vercel-postgres`, atau `none`. Provider PostgreSQL memakai driver `pg`; `none` tidak membuat pool dan menonaktifkan auth. |
| `DATABASE_URL` | Opsional jika provider `none`; koneksi PostgreSQL server-side. `POSTGRES_URL` diterima sebagai fallback. Gunakan TLS untuk production. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Kredensial SMTP penyedia email; port 465 memakai TLS implisit, port 587 memakai STARTTLS |
| `EMAIL_FROM` | Alamat pengirim yang sudah diverifikasi oleh penyedia SMTP |

Buat secret lokal dengan `openssl rand -base64 32`. Untuk menjalankan web tanpa database, atur `AUTH_DATABASE_PROVIDER=none`; halaman dan fitur publik tetap tersedia, sedangkan endpoint Auth.js menolak permintaan dengan status 503. Provider Supabase dan Prisma Postgres menggunakan URL PostgreSQL langsung dari sisi server. Jangan gunakan publishable/anon key Supabase untuk koneksi database. Jangan menaruh `AUTH_SECRET`, password database, atau SMTP password pada variabel `NEXT_PUBLIC_*`, file yang di-commit, atau bundle browser. Batas per alamat dan IP ada di database; aktifkan juga kuota/batas pengiriman pada SMTP dan Vercel Firewall untuk mengendalikan traffic terdistribusi.

Adapter `pg` ini hanya mendukung PostgreSQL dan layanan yang kompatibel dengannya. Prisma Postgres adalah layanan PostgreSQL sehingga dapat dipakai langsung. Untuk MySQL, SQLite, SQL Server, atau MongoDB, tambahkan adapter Auth.js yang sesuai dan sesuaikan skema; jangan mengubah hanya URL database karena tabel/Auth adapter dan limiter berbeda antar-engine.

Auth.js menyediakan route `/api/auth/*`; `/api/auth/status` hanya mengembalikan status konfigurasi yang dibutuhkan UI. POST login menggunakan endpoint sign-in `nodemailer` dan mengirim email tanpa mengungkap apakah pengguna sudah ada. Saat link email valid dikonfirmasi, Auth.js membuat pengguna bila belum ada. Logout menghapus sesi database.

## Deployment dan pemeriksaan

1. Pilih `AUTH_DATABASE_PROVIDER` dan jalankan `apps/web/db/001_auth.sql` pada database PostgreSQL production. Lewati langkah ini jika auth belum akan diaktifkan.
2. Tambahkan `AUTH_SECRET`, `AUTH_URL`, `AUTH_DATABASE_PROVIDER`, `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `EMAIL_FROM` ke environment server Vercel. Jangan publikasikan rahasia ke frontend atau container API.
3. Pastikan domain pengirim sudah diverifikasi pada penyedia SMTP, dan redirect domain web melalui `AUTH_URL` menggunakan HTTPS.
4. Deploy ulang web. Endpoint `/api/auth/status` harus mengembalikan HTTP 200 dengan `available: true`.
5. Kirim link ke mailbox yang dikuasai, buka link sebelum 10 menit, lalu periksa sesi dan logout. Jangan mengklaim email live berfungsi sebelum melakukan pemeriksaan ini.

Jalankan pembersihan terjadwal harian pada database agar sesi/token kedaluwarsa dan catatan limiter lama tidak menumpuk:

```sql
DELETE FROM celi_auth.verification_token WHERE expires < now();
DELETE FROM celi_auth.sessions WHERE expires < now();
DELETE FROM celi_auth.auth_email_rate_limits WHERE last_sent_at < now() - interval '30 days';
DELETE FROM celi_auth.auth_ip_rate_limits WHERE window_started_at < now() - interval '30 days';
```

Fitur file tetap bisa dibuka tanpa login sesuai perilaku aplikasi sebelumnya. `AuthProvider` mengatur UI; ia bukan pembatas akses untuk route/API file. Jika nanti ada data atau operasi yang membutuhkan akun, route server wajib memanggil `auth()` dan memeriksa otorisasi di server.

## Peralihan dari sesi sebelumnya

Sesi Supabase lama tidak dipindahkan. Pengguna perlu masuk ulang dengan email; setelah link dikonfirmasi, Auth.js membuat identitas pengguna baru pada PostgreSQL. Saat ini aplikasi tidak mengaitkan data tersimpan dengan ID pengguna. Jika integrasi lain memakai Supabase user ID, migrasikan mapping data secara terpisah sebelum mengandalkan ID Auth.js.
