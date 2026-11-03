# celimanapp

Portal untuk konversi dan kompresi file, JSON Workspace, Crypto Tools, Sticky Note, dan API Client. Login memakai Google OAuth melalui Auth.js dan PostgreSQL; akun celimanapp dibuat otomatis saat login Google pertama.

## Struktur monorepo

```text
apps/
  web/                  Next.js / React: UI dan autentikasi Google OAuth/Auth.js
    app/                Source aplikasi
    public/             Aset antarmuka
    db/
      migrate.mjs       Runner migrasi PostgreSQL
      migrations/       SQL berurutan; jangan edit setelah diterapkan
  api/                  HTTP API Node.js yang menjalankan worker Python
    src/                CORS, upload, pemrosesan, health check
    server/             Worker Python, dependency lock, pengujian engine
packages/
  file-tools/           Daftar format, batas file, validasi bersama web dan API
scripts/                Runner lokal dan pengujian integrasi
tests/                  Tes JavaScript dan batas layanan HTTP
docs/                   Panduan auth, environment, deployment, dan fitur
deploy/                 Contoh environment per deployment provider
Dockerfile.api          Image backend; build context adalah root repository
vercel.json             Root service, build, dan rewrite Vercel
railway.json            Root Dockerfile dan readiness Railway
package-lock.json       Satu lockfile npm untuk semua workspaces
compose.yaml            Menjalankan backend Docker lokal
```

Web dan API berjalan sebagai dua Vercel Services dalam satu deployment. Browser mengunggah file langsung ke Vercel Blob privat; API mengambil file tersebut, memprosesnya dalam container, lalu menyimpan hasil sementara privat dan mengembalikan tautan unduh berumur satu jam. File input dihapus setelah pemrosesan; hasil dihapus setelah diunduh. Hasil yang tertinggal dibersihkan ketika ada permintaan pemrosesan berikutnya jika usianya lebih dari 24 jam.

## API Client

Setelah login, buka **API Client** di sidebar. Request tunggal dikirim melalui server ke alamat IPv4 publik dengan batas 20 request per pengguna dan 120 request total per menit. Header seperti `Cookie` dapat dikirim; header transport seperti `Host` dan `Transfer-Encoding` ditolak. Redirect otomatis dan alamat privat tidak didukung. Pengujian race tetap berjalan langsung dari browser dan bergantung pada CORS. Cookie dan header rahasia umum tidak disimpan ke koleksi; periksa body, URL, dan skrip sebelum menyimpan karena dapat berisi rahasia.

Menu impor menerima cURL, request JSON, dan koleksi Postman. Opsi cURL yang tidak didukung ditolak. Hapus konfigurasi autentikasi bawaan Postman dari JSON sebelum impor, lalu isi header `Authorization` secara manual; ganti juga variabel environment dengan nilainya. Contoh JSON request:

```json
{"method":"POST","url":"https://example.com/api","headers":{"Authorization":"Bearer example"},"body":{"name":"Celi"}}
```

Impor dibatasi 1 MiB dan respons dibatasi 2 MiB. PNG, JPEG, GIF, dan WebP yang memiliki signature sesuai dapat dipratinjau; respons juga dapat diunduh. Body file biner atau satu file form-data dibatasi 512 KiB dan harus lulus pemindaian ClamAV sebelum dikirim. Pemindai yang tidak tersedia menyebabkan file ditolak. Variabel `{{timestamp}}`, `{{timestemp}}`, `{{localdate}}`, `{{$timestamp}}`, `{{$isoTimestamp}}`, dan `{{$guid}}` dihitung untuk setiap request. Implementasi ini belum memiliki seluruh kemampuan Postman, termasuk skrip JavaScript bebas, seluruh jenis collection, dan layanan monitor.

## Menjalankan secara lokal

[Daftar sample environment](./docs/ENVIRONMENT.md) menjelaskan konfigurasi web, Google OAuth, API, Vercel Blob, dan PostgreSQL.

Gunakan Node.js 26.12.1 (Vercel memakai runtime 26.x dan mengelola patch keamanan otomatis). Jalankan semua perintah dari root repository:

```sh
npm ci
npm run dev
```

- Web: `http://localhost:3000`
- File API: `http://localhost:3001`
- Health API: `http://localhost:3001/health`
- Kesiapan engine: `http://localhost:3001/ready`

### Environment web (`apps/web`)

Salin [`apps/web/.env.example`](./apps/web/.env.example) ke `apps/web/.env.local`. Web membaca file ini untuk Auth.js, database, dan Google OAuth. Pada lokal, file diproses langsung oleh API `localhost:3001`; Vercel Blob hanya dipakai pada deployment.

```env
AUTH_SECRET=generate-a-random-secret-of-at-least-32-bytes
AUTH_URL=http://localhost:3000
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://celi_auth:replace-me@localhost:5432/celi_auth
# Google OAuth credentials (OAuth Client ID and Client Secret, not an API key).
GOOGLE_CLIENT_ID=replace-with-google-oauth-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-oauth-client-secret
```

| Variabel | Kegunaan |
| --- | --- |
| `AUTH_SECRET` | Secret acak Auth.js, minimal 32 byte. Buat dengan `openssl rand -base64 32`. |
| `AUTH_URL` | Origin kanonis web; lokal `http://localhost:3000`, production URL HTTPS Vercel. |
| `DATABASE_PROVIDER` | Pilih `postgres`, `supabase`, `prisma-postgres`, `neon`, `vercel-postgres`, atau `none`. Semua provider PostgreSQL memakai satu pool `pg` untuk Auth.js dan data Sticky Note. `none` menonaktifkan penyimpanan dan login. `AUTH_DATABASE_PROVIDER` dibaca sebagai fallback lama. |
| `DATABASE_URL` | Satu-satunya URL PostgreSQL server-side untuk Auth.js dan data aplikasi. `POSTGRES_URL` tidak dipakai. Gunakan koneksi TLS di production. Supabase dan Prisma Postgres memakai URL koneksi PostgreSQL server-side. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Wajib untuk login dan pembuatan akun dengan Google OAuth. Buat OAuth Client bertipe Web application di Google Cloud Console; jangan gunakan API key. Redirect URI harus `${AUTH_URL}/api/auth/callback/google`. Simpan Client Secret hanya di environment server Vercel. |

Google mengautentikasi pemilik alamat email. Login pertama otomatis membuat akun; login berikutnya membuka akun yang sama. Akun lama yang menggunakan email terverifikasi dapat ditautkan ke akun Google dengan email sama, dan aplikasi hanya menerima profil Google dengan `email_verified=true`. Tidak ada form registrasi atau login tautan email.

Semua migrasi PostgreSQL berada di `apps/web/db/migrations/` dan dijalankan berurutan menggunakan satu `DATABASE_URL`:

```sh
npm run db:list      # Daftar file migrasi tanpa koneksi database
npm run db:status    # Bandingkan file dengan ledger pada database
npm run db:migrate   # Terapkan migrasi pending dalam transaksi
npm run db:status:local   # Gunakan apps/web/.env.local secara eksplisit
npm run db:migrate:local  # Terapkan ke DATABASE_URL dari apps/web/.env.local
```

Perintah tanpa suffix `:local` memakai `DATABASE_URL` dari environment shell. Suffix `:local` membaca `apps/web/.env.local`; pastikan file itu menunjuk ke database yang dimaksud sebelum menerapkan migrasi. Runner memverifikasi urutan dan checksum, mencatat versi dalam schema metadata terpisah `celi_meta.schema_migrations`, memakai advisory lock, dan tidak menghapus tabel atau baris. Jangan mengedit migrasi yang pernah diterapkan; tambahkan file berikutnya dengan nomor urut. Backup database sebelum menjalankan migrasi production. Migrasi tidak berjalan otomatis saat deploy. Skema tidak menyisipkan akun, catatan, atau data dummy: data tersebut milik pengguna dan seed bersama dapat mencemari production. Auth.js memerlukan database, secret, origin, serta Google OAuth yang valid. Jangan menaruh `AUTH_SECRET`, `DATABASE_URL`, atau OAuth Client Secret pada variabel `NEXT_PUBLIC_*` atau file yang di-commit.

Untuk menjalankan web lokal tanpa database, set `DATABASE_PROVIDER=none` dan kosongkan `DATABASE_URL`/`POSTGRES_URL`. Untuk Supabase pilih `supabase` dan gunakan connection string PostgreSQL server-side (bukan publishable/anon key); untuk resource Prisma Postgres pilih `prisma-postgres`. Engine database selain PostgreSQL memerlukan adapter Auth.js yang sesuai dan skema khusus; driver itu belum termasuk dalam build ini.

### Environment API (`apps/api`)

Salin [`apps/api/.env.example`](./apps/api/.env.example) ke `apps/api/.env`. API file tidak membutuhkan database auth atau secret Auth.js.

| Variabel | Kegunaan |
| --- | --- |
| `PORT` | Port HTTP; lokal `3001`. Vercel Container Runtime memasok port container. |
| `HOST` | Alamat bind; lokal `127.0.0.1`, container production `0.0.0.0`. |
| `WEB_ORIGINS` | Origin web yang diizinkan API. Vercel mengarahkan API melalui domain yang sama; production harus memuat origin domain web tersebut. |
| `FILE_TOOLS_TRUST_PROXY` | Default `false`. Ubah ke `true` hanya bila semua request melewati reverse proxy tepercaya yang mengatur `X-Forwarded-For`. |
| `FILE_TOOLS_TRUSTED_PROXY_HOPS` | Jumlah hop proxy tepercaya saat membaca alamat klien; sesuaikan topologi deployment. |
| `FILE_TOOLS_PYTHON`, `FILE_TOOLS_OFFICE`, `FILE_TOOLS_FFMPEG`, `FILE_TOOLS_RUNTIME_ROOT` | Override opsional untuk lokasi executable dan direktori runtime engine file. Biasanya tidak perlu pada image Docker. |

Web dan API memakai file environment masing-masing saat lokal. Di production, keduanya dideploy oleh Vercel Services. Simpan variabel Auth.js/Google OAuth sebagai environment server di Vercel dan hubungkan Vercel Blob privat ke project; jangan simpan credential Blob di bundle browser. Contoh auth production ada di [Vercel](./deploy/vercel/.env.example). Restart server lokal setelah mengubah file `.env`.

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
| `npm run check:layout` | Pastikan root service, entrypoint, shared install, dan file migrasi sesuai repo |
| `npm run db:list` / `npm run db:status` / `npm run db:migrate` | Lihat, periksa, atau terapkan migrasi PostgreSQL menggunakan `DATABASE_URL` dari environment shell |
| `npm run db:status:local` / `npm run db:migrate:local` | Periksa atau terapkan migrasi menggunakan `apps/web/.env.local` |
| `npm run check:deployment -- --web https://web-anda.example.com` | Memeriksa web, status Google OAuth, engine, CORS, dan perlindungan endpoint tanpa sesi |

Tes API nyata menerima `FILE_TOOLS_TEST_URL` dan `FILE_TOOLS_WEB_ORIGIN` untuk origin lain. `AUTH_TEST_URL` mengubah target pemeriksaan UI/status auth web. Artefak sintetis tetap di direktori `test-output/` yang diabaikan Git.

## Deployment

[Panduan deployment Vercel](./docs/DEPLOY_VERCEL.md) menjelaskan Services, private Blob, PostgreSQL, Google OAuth, environment, dan pemeriksaan production. Vercel project harus memakai framework Services, Root Directory repository root, dan menghubungkan private Blob store.

## Perilaku dan batas

- Maksimum 10 file, total 100 MiB input dan 200 MiB hasil. Dua job bersamaan per proses API; setiap alamat klien dibatasi satu pekerjaan aktif dan enam job per menit. Readiness/capabilities dibatasi 30 pemeriksaan per menit per alamat. Rate limit dalam memori hanya berlaku per container instance.
- CORS menerima origin eksplisit dari `WEB_ORIGINS`, dipisahkan koma; wildcard tidak diterima. `/converter` dan `/compress` mensyaratkan sesi Auth.js. Upload Blob mensyaratkan sesi serta Origin same-site yang diizinkan. Di Vercel, frontend menerbitkan token API HMAC berumur lima menit setelah memvalidasi sesi; API production menolak operasi konversi, kompresi, dan penghapusan tanpa token tersebut. `FILE_API_SIGNING_SECRET` minimal 32 byte dan harus sama pada frontend dan API service. CORS bukan autentikasi API. API memakai alamat peer secara default. Aktifkan `FILE_TOOLS_TRUST_PROXY=true` hanya jika semua traffic masuk melalui proxy tepercaya yang mengatur IP klien; atur `FILE_TOOLS_TRUSTED_PROXY_HOPS` sesuai jumlah proxy. Terapkan juga rate limit ingress untuk membatasi klien yang menyebar ke beberapa alamat atau instance.
- File diproses dalam folder job terpisah dan dihapus setelah hasil selesai dikirim atau saat kegagalan yang tertangani. Hasil dialirkan ke klien agar arsip tidak disalin penuh ke memori server. Pembatalan koneksi menghentikan worker terkait. Hard crash host/proses dapat meninggalkan folder job; bersihkan hanya folder yang sudah tidak aktif.
- API container menjalankan ClamAV dengan signature yang diperbarui oleh `freshclam`. Upload Blob privat dipindai saat upload selesai dan dipindai ulang sebelum diteruskan ke konverter atau kompresor. File terdeteksi, terenkripsi, melewati batas pemindaian, atau gagal dipindai ditolak dan dihapus bila pemindaian gagal. Deteksi berbasis signature tidak menjamin semua malware dikenali.
- Worker Python hanya menerima environment minimum untuk runtime dan engine file; rahasia API/Blob tidak diwariskan ke parser Office atau media. API membuka port saat startup, sementara `/ready` dan request file gagal tertutup sampai ClamAV dan signature siap.
- Cookie sesi Auth.js hanya dikirim ke origin web melalui request same-origin. API container tidak menerima cookie sesi; ia memverifikasi token HMAC singkat yang diterbitkan web. Database dan Google OAuth hanya diperlukan oleh web.
- Semua jenis file dapat diarsipkan. Konversi mengikuti matriks format dan codec yang dapat dibaca engine; ukuran tidak selalu berkurang setelah kompresi.
- [Daftar format, batas, dan perilaku pemrosesan](./docs/FILE_TOOLS.md).
- [Konfigurasi autentikasi Google](./docs/AUTH.md).

JSON disimpan secara lokal sesuai preferensi. Crypto input/password hanya berada di memori komponen. Portal ini belum menambahkan RBAC atau manajemen pengguna; identitas pada `AuthProvider` mengatur presentasi, bukan otorisasi server.
