# Deploy monorepo Celi Tools

Satu repository berisi web Next.js (`apps/web`), API pemrosesan file (`apps/api`), dan manifest format bersama (`packages/file-tools`). Web dideploy ke Vercel. API dideploy sebagai container di host yang mendukung Python, FFmpeg, LibreOffice, dan upload besar. Kedua layanan dihubungkan lewat URL publik dan CORS.

Untuk pilihan Railway, gunakan [panduan Railway + Vercel](./docs/DEPLOY_RAILWAY.md). `railway.json` di root sudah memilih Dockerfile backend dan readiness check; panduan tersebut memuat origin web production yang telah ditemukan.

## 1. Kirim versi monorepo ke repository Git

Sertakan source di `apps/`, `packages/`, `scripts/`, serta `package.json` dan `package-lock.json` root. Jangan membuat lockfile npm terpisah per aplikasi. File `.env*`, `.file-tools/`, `node_modules/`, `.next/`, dan fixture upload tidak diikutkan. File `.env.example` aman sebagai contoh konfigurasi tanpa kredensial asli.

## 2. Deploy backend file

Pada layanan Docker seperti Render/Railway atau server container Anda, gunakan repository yang sama dan pengaturan berikut:

| Pengaturan | Nilai |
| --- | --- |
| Docker build context | Root repository (`.`) |
| Dockerfile | `apps/api/Dockerfile` |
| Start command | Gunakan `CMD` bawaan image |
| Health check | `GET /health` |
| Readiness engine | `GET /ready` |

Contoh build manual dari root repository:

```sh
docker build -f apps/api/Dockerfile -t celi-file-api .
docker run --rm -p 3001:3001 -e WEB_ORIGINS=https://nama-web.vercel.app celi-file-api
```

Pada platform managed, isi environment backend:

```env
NODE_ENV=production
HOST=0.0.0.0
WEB_ORIGINS=https://nama-web.vercel.app
```

Platform dapat mengisi `PORT`; jika tidak, API menggunakan 3001. Image sudah mengatur path Python, LibreOffice, dan direktori runtime yang dapat ditulis. Environment autentikasi web tidak diperlukan pada layanan ini. Pastikan proxy host menerima request setidaknya 101 MiB (file 100 MiB ditambah multipart) dan tidak memutus pemrosesan empat menit. Hasil dapat mencapai 200 MiB.

Catat domain HTTPS backend, misalnya `https://api-contoh.example.com`. Periksa `/health`, `/ready`, dan `/api/files/capabilities` melalui domain itu. `/health` hanya memeriksa proses; `/ready` mengembalikan 503 jika ada engine yang belum tersedia.

Untuk Render, pilih runtime Docker dan biarkan Root Directory layanan pada root repository karena image memerlukan manifest npm root serta `packages/file-tools`. Atur Dockerfile Path menjadi `./apps/api/Dockerfile`. Untuk Railway, gunakan context repository root dan konfigurasi Dockerfile Path yang sama (atau variabel `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile` sesuai pengaturan Railway). Periksa biaya/kapasitas layanan pada platform sebelum membuat layanan.

## 3. Import frontend ke Vercel

Import repository yang sama menjadi proyek Vercel dengan:

| Pengaturan Vercel | Nilai |
| --- | --- |
| Root Directory | **`apps/web`** |
| Framework Preset | **Next.js** |
| Node.js Version | **24.x** (sesuai versi yang dipin di `package.json`) |
| Include source files outside Root Directory | Aktifkan agar paket workspace bersama dapat diakses |
| Install Command | `npm ci --prefix ../.. --include=dev` |
| Build Command | `npm run build` |
| Output Directory | Default Next.js |

`apps/web/vercel.json` sudah menetapkan framework dan perintah tersebut. `next.config.ts` mengatur root monorepo untuk Turbopack dan tracing. Tidak ada worker Python dalam web atau route upload file yang menjalankan subprocess. Folder `apps/api` tidak dipilih sebagai aplikasi Vercel.

Jika proyek Vercel sebelumnya memakai root repository atau `server`, ubah Root Directory ke `apps/web`. Error `PYTHON_ENTRYPOINT_NOT_FOUND` tidak diselesaikan dengan menambahkan entrypoint Python dummy; pastikan Vercel membaca konfigurasi Next.js dari workspace web dan commit monorepo terbaru.

## 4. Isi environment web dan autentikasi email

Tambahkan ke environment Production Vercel (dan Preview jika diperlukan):

```env
AUTH_SECRET=<secret-acak-minimal-32-byte>
AUTH_URL=https://nama-web.vercel.app
AUTH_DATABASE_PROVIDER=prisma-postgres
DATABASE_URL=<koneksi-postgresql-dengan-tls>
SMTP_HOST=<host-smtp>
SMTP_PORT=587
SMTP_USER=<username-smtp>
SMTP_PASSWORD=<password-smtp>
EMAIL_FROM="Celi Tools <no-reply@domain-terverifikasi.example>"
FILE_API_URL=https://api-contoh.example.com
```

Jalankan `apps/web/db/001_auth.sql` pada PostgreSQL terlebih dahulu jika login akan diaktifkan. Auth database boleh tidak diatur untuk deployment web yang belum memerlukan login; set `AUTH_DATABASE_PROVIDER=none` agar endpoint auth nonaktif tanpa menggagalkan fitur publik. `supabase` dan `prisma-postgres` menggunakan connection string PostgreSQL, bukan credential browser. Auth secret, database password, dan SMTP password harus menjadi server-only environment variables; jangan gunakan prefix `NEXT_PUBLIC_`. Hanya `FILE_API_URL` yang dipetakan ke bundle browser. Lihat [docs/AUTH.md](./docs/AUTH.md) untuk provider database dan langkah menyiapkan email.

`FILE_API_URL` adalah origin backend HTTPS tanpa path endpoint. Web menambahkan `/api/files/capabilities`, `/api/files/convert`, atau `/api/files/compress`. Jangan mengisinya dengan localhost pada deployment production. Mengubah variabel publik membutuhkan deployment web baru.

## 5. Hubungkan CORS dan autentikasi

Setelah domain web diketahui, pastikan `WEB_ORIGINS` backend sama dengan origin web, termasuk protokol dan port jika ada. Untuk beberapa domain yang memang dipakai:

```env
WEB_ORIGINS=https://nama-web.vercel.app,https://tools.example.com
```

Hostname preview harus ditambahkan secara eksplisit jika ingin menguji fitur file dari preview. `*` dan wildcard domain tidak diterima. Jangan menambahkan path seperti `/converter` ke daftar origin.

Auth.js menggunakan `AUTH_URL` sebagai origin kanonis untuk tautan verifikasi. Pastikan nilainya origin HTTPS dari domain web production. Tidak diperlukan konfigurasi OAuth provider.

## 6. Verifikasi kedua layanan

1. Buka landing, dashboard, login, registrasi, JSON, dan Crypto di domain Vercel.
2. Periksa `/api/auth/status` pada domain web; konfigurasi siap ditandai `available: true`.
3. Buka File Converter/Compress. Status engine harus tampil sebagai tersedia.
4. Di browser DevTools → Network, pastikan request file menuju **domain API**, bukan domain Vercel. Request auth tetap menuju web dan database/email hanya diakses server.
5. Konversikan gambar kecil, lalu coba arsip ZIP dengan file lebih dari 4,5 MB. Unduh hasil dan periksa isinya.
6. Origin yang tidak ada di `WEB_ORIGINS` harus ditolak. Jika browser menampilkan CORS error, samakan origin aktual browser dengan konfigurasi backend lalu restart layanan backend.

Batas request/response Vercel Functions 4,5 MB tidak menjadi jalur upload pada arsitektur ini: file dan hasil dikirim langsung antara browser dan API. Batas upload/time limit host API tetap harus dikonfigurasi dengan benar.

## Validasi sebelum deploy

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Setelah engine siap dan API lokal berjalan:

```sh
npm run test:files -- --fixtures
npm run test:api
```

Source dan konfigurasi deployment monorepo disiapkan di repository; deployment publik belum dijalankan oleh perubahan ini. Build Docker harus diuji pada Docker Engine/Linux yang aktif. Tes engine Windows dan build Next.js tidak menggantikan validasi image Docker.

## Referensi

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Framework Vercel](https://vercel.com/docs/project-configuration/vercel-json#framework)
- [Batas Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size)
- [Docker pada Render](https://render.com/docs/docker)
- [Dockerfile pada Railway](https://docs.railway.com/builds/dockerfiles)
