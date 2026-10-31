# Celi Tools

Portal untuk konversi dan kompresi file, JSON Workspace, serta Crypto Tools. Login dan registrasi memakai tautan email sekali pakai melalui Auth.js, PostgreSQL, dan SMTP.

## Struktur monorepo

```text
apps/
  web/                  Next.js / React: UI dan autentikasi email Auth.js
    app/                Source aplikasi
    public/             Aset antarmuka
    vercel.json         Konfigurasi Vercel Services dan rewrite web/API
  api/                  HTTP API Node.js yang menjalankan worker Python
    src/                CORS, upload, pemrosesan, health check
    server/             Worker Python, dependency lock, pengujian engine
    Dockerfile          Image backend; build context adalah root repository
packages/
  file-tools/           Daftar format, batas file, validasi bersama web dan API
scripts/                Runner lokal dan pengujian integrasi
tests/                  Tes JavaScript dan batas layanan HTTP
docs/                   Detail autentikasi dan format file
package-lock.json       Satu lockfile npm untuk semua workspaces
compose.yaml            Menjalankan backend Docker secara lokal
```

Web dan API berjalan sebagai dua Vercel Services dalam satu deployment. Browser mengunggah file langsung ke Vercel Blob privat; API mengambil file tersebut, memprosesnya dalam container, lalu menyimpan hasil sementara privat dan mengembalikan tautan unduh berumur satu jam. File input dihapus setelah pemrosesan; hasil dihapus setelah diunduh. Hasil yang tertinggal dibersihkan ketika ada permintaan pemrosesan berikutnya jika usianya lebih dari 24 jam.

## Menjalankan secara lokal

[Daftar sample environment](./docs/ENVIRONMENT.md) menjelaskan konfigurasi web, API, Vercel Blob, PostgreSQL, dan SMTP.

Gunakan Node.js 24 atau lebih baru. Jalankan semua perintah dari root repository:

```sh
npm ci
npm run dev
```

- Web: `http://localhost:3000`
- File API: `http://localhost:3001`
- Health API: `http://localhost:3001/health`
- Kesiapan engine: `http://localhost:3001/ready`

### Environment web (`apps/web`)

Salin [`apps/web/.env.example`](./apps/web/.env.example) ke `apps/web/.env.local`. Web membaca file ini untuk Auth.js, database, dan SMTP. Pada lokal, file diproses langsung oleh API `localhost:3001`; Vercel Blob hanya dipakai pada deployment.

```env
AUTH_SECRET=generate-a-random-secret-of-at-least-32-bytes
AUTH_URL=http://localhost:3000
AUTH_DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://celi_auth:replace-me@localhost:5432/celi_auth
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=replace-with-smtp-username
SMTP_PASSWORD=replace-with-smtp-password
EMAIL_FROM="Celi Tools <no-reply@example.com>"
```

| Variabel | Kegunaan |
| --- | --- |
| `AUTH_SECRET` | Secret acak Auth.js, minimal 32 byte. Buat dengan `openssl rand -base64 32`. |
| `AUTH_URL` | Origin kanonis web; lokal `http://localhost:3000`, production URL HTTPS Vercel. |
| `AUTH_DATABASE_PROVIDER` | Pilih `postgres`, `supabase`, `prisma-postgres`, `neon`, `vercel-postgres`, atau `none`. Opsi selain `none` saat ini memakai driver PostgreSQL. Nilai `none` membuat web berjalan tanpa koneksi database dan menonaktifkan login. |
| `DATABASE_URL` | Opsional saat provider `none`; URL PostgreSQL untuk akun, token sekali pakai, sesi, dan rate limit. Untuk kompatibilitas, `POSTGRES_URL` juga bisa digunakan. Pakai koneksi TLS di production. Supabase dan Prisma Postgres memakai URL koneksi PostgreSQL server-side. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Kredensial server SMTP untuk mengirim tautan email. Port 465 memakai TLS implisit; 587 memakai STARTTLS. |
| `EMAIL_FROM` | Alamat pengirim yang sudah diverifikasi penyedia email, misalnya `"Celi Tools <no-reply@domain-anda.com>"`. |

Jalankan skema `apps/web/db/001_auth.sql` satu kali pada database PostgreSQL tersebut sebelum mengaktifkan auth. Jika menjalankan migrasi via `psql`, gunakan `DATABASE_URL` yang sama seperti environment web. Auth.js memerlukan database, SMTP, secret, dan origin yang valid; jika belum lengkap, login email tetap nonaktif sementara fitur web lain tetap bisa dipakai. Jangan menaruh `AUTH_SECRET`, `DATABASE_URL`, atau password SMTP pada variabel `NEXT_PUBLIC_*` atau file yang di-commit.

Untuk menjalankan web lokal tanpa database, set `AUTH_DATABASE_PROVIDER=none` dan kosongkan `DATABASE_URL`/`POSTGRES_URL`. Untuk Supabase pilih `supabase` dan gunakan connection string PostgreSQL server-side (bukan publishable/anon key); untuk resource Prisma Postgres pilih `prisma-postgres`. Engine database selain PostgreSQL memerlukan adapter Auth.js yang sesuai dan skema khusus; driver itu belum termasuk dalam build ini.

### Environment API (`apps/api`)

Salin [`apps/api/.env.example`](./apps/api/.env.example) ke `apps/api/.env`. API file tidak membutuhkan database auth, SMTP, atau secret Auth.js.

| Variabel | Kegunaan |
| --- | --- |
| `PORT` | Port HTTP; lokal `3001`. Vercel Container Runtime memasok port container. |
| `HOST` | Alamat bind; lokal `127.0.0.1`, container production `0.0.0.0`. |
| `WEB_ORIGINS` | Origin web yang diizinkan API. Vercel mengarahkan API melalui domain yang sama; production harus memuat origin domain web tersebut. |
| `FILE_TOOLS_TRUST_PROXY` | Default `false`. Ubah ke `true` hanya bila semua request melewati reverse proxy tepercaya yang mengatur `X-Forwarded-For`. |
| `FILE_TOOLS_TRUSTED_PROXY_HOPS` | Jumlah hop proxy tepercaya saat membaca alamat klien; sesuaikan topologi deployment. |
| `FILE_TOOLS_PYTHON`, `FILE_TOOLS_OFFICE`, `FILE_TOOLS_FFMPEG`, `FILE_TOOLS_RUNTIME_ROOT` | Override opsional untuk lokasi executable dan direktori runtime engine file. Biasanya tidak perlu pada image Docker. |

Web dan API memakai file environment masing-masing saat lokal. Di production, keduanya dideploy oleh Vercel Services. Simpan variabel Auth.js/SMTP sebagai environment server di Vercel dan hubungkan Vercel Blob privat ke project; jangan simpan credential Blob di bundle browser. Contoh auth production ada di [Vercel](./deploy/vercel/.env.example). Restart server lokal setelah mengubah file `.env`.

### Engine Python di Windows

Engine lokal tetap berada di `.file-tools/` pada root repository, sehingga tidak perlu memindahkan instalasi Python/LibreOffice yang sudah ada.

```powershell
./scripts/setup-file-tools.ps1 -PythonPath 'C:/path/to/python.exe' -WithOffice
```

Setup memakai `apps/api/server/requirements.lock` dan dapat mengekstrak LibreOffice resmi ke direktori lokal proyek setelah pemeriksaan hash. Tidak memasang LibreOffice secara global. Override lokasi runtime melalui `FILE_TOOLS_PYTHON`, `FILE_TOOLS_OFFICE`, atau `FILE_TOOLS_RUNTIME_ROOT` pada backend jika diperlukan.

Alternatif backend lokal dengan Docker:

```sh
docker compose up --build api
```

Jalankan web di terminal lain melalui `npm run dev:web`. Jangan menjalankan dua backend pada port 3001 bersamaan. Image Docker tetap perlu diverifikasi dengan Docker Engine/Linux yang aktif; keberhasilan tes engine Windows bukan bukti build container berhasil.

## Perintah

| Perintah dari root | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan web dan API bersamaan |
| `npm run dev:web` / `npm run dev:api` | Menjalankan satu workspace |
| `npm run build` | Build production web |
| `npm start` | Menjalankan web production |
| `npm run start:api` | Menjalankan API pada proses terpisah |
| `npm run lint` | ESLint untuk source monorepo |
| `npm run typecheck` | TypeScript web |
| `npm test` | Tes helper aplikasi, konfigurasi auth, CORS, dan batas HTTP |
| `npm run test:files` | Tes engine Python; memerlukan dependency backend |
| `npm run test:files -- --fixtures` | Menghasilkan fixture sintetis di `test-output/fixtures` |
| `npm run test:api` | Menguji API nyata port 3001, dengan fixture dan API aktif |
| `npm run test:auth` | Memeriksa route auth web pada port 3000 tanpa mengirim email |
| `npm run check:css` | Diagnostik class CSS web |
| `npm run check:deployment -- --web https://web-anda.example.com` | Memeriksa web, auth, engine, unggah Blob privat, pemrosesan ZIP sintetis, dan unduhan |

Tes API nyata menerima `FILE_TOOLS_TEST_URL` dan `FILE_TOOLS_WEB_ORIGIN` untuk origin lain. `AUTH_TEST_URL` mengubah target pemeriksaan UI/status auth web. Artefak sintetis tetap di direktori `test-output/` yang diabaikan Git.

## Deployment

[Panduan deployment Vercel](./DEPLOY_VERCEL.md) menjelaskan Services, private Blob, PostgreSQL, SMTP, environment, dan pemeriksaan production. Vercel project harus memakai framework Services, Root Directory repository root, dan menghubungkan private Blob store.

## Perilaku dan batas

- Maksimum 10 file, total 100 MiB input dan 200 MiB hasil. Dua job bersamaan per proses API; setiap alamat klien dibatasi satu pekerjaan aktif dan enam job per menit. Readiness/capabilities dibatasi 30 pemeriksaan per menit per alamat. Rate limit dalam memori hanya berlaku per container instance.
- CORS menerima origin eksplisit dari `WEB_ORIGINS`, dipisahkan koma. Wildcard tidak diterima. Akses tool tetap tidak memerlukan login, seperti perilaku sebelumnya; CORS bukan autentikasi API atau pembatas akses untuk klien non-browser. API memakai alamat peer secara default. Aktifkan `FILE_TOOLS_TRUST_PROXY=true` hanya jika semua traffic masuk melalui proxy tepercaya yang menambahkan `X-Forwarded-For`; atur `FILE_TOOLS_TRUSTED_PROXY_HOPS` sesuai jumlah proxy. Terapkan juga rate limit pada ingress untuk membatasi klien yang menyebar ke beberapa alamat atau instance.
- File diproses dalam folder job terpisah dan dihapus setelah hasil selesai dikirim atau saat kegagalan yang tertangani. Hasil dialirkan ke klien agar arsip tidak disalin penuh ke memori server. Pembatalan koneksi menghentikan worker terkait. Hard crash host/proses dapat meninggalkan folder job; bersihkan hanya folder yang sudah tidak aktif.
- Cookie sesi Auth.js hanya digunakan oleh web; browser tidak mengirim cookie sesi ke API file. Database dan SMTP hanya diperlukan oleh web.
- Semua jenis file dapat diarsipkan. Konversi mengikuti matriks format dan codec yang dapat dibaca engine; ukuran tidak selalu berkurang setelah kompresi.
- [Daftar format, batas, dan perilaku pemrosesan](./docs/FILE_TOOLS.md).
- [Konfigurasi tautan email dan SMTP](./docs/AUTH.md).

JSON disimpan secara lokal sesuai preferensi. Crypto input/password hanya berada di memori komponen. Portal ini belum menambahkan RBAC atau manajemen pengguna; identitas pada `AuthProvider` mengatur presentasi, bukan otorisasi server.
