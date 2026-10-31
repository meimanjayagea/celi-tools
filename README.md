# Celi Tools

Portal untuk konversi dan kompresi file, JSON Workspace, serta Crypto Tools. Login dan registrasi memakai Google OAuth/PKCE atau tautan email melalui Supabase.

## Struktur monorepo

```text
apps/
  web/                  Next.js / React: UI, halaman publik, callback Supabase
    app/                Source aplikasi
    public/             Aset antarmuka
    vercel.json         Konfigurasi proyek Vercel (Root Directory: apps/web)
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

Browser mengambil halaman dari web dan mengirim file **langsung ke API**. Request upload dan hasil besar tidak melewati fungsi Vercel. Web tidak menjalankan Python dan tidak menyimpan file upload. Backend tetap menjalankan engine yang sebelumnya dipakai di aplikasi ini.

## Menjalankan secara lokal

[Daftar sample environment](./docs/ENVIRONMENT.md) memisahkan konfigurasi lokal, Vercel, Railway, Google OAuth, dan SMTP Supabase.

Gunakan Node.js 22 atau lebih baru. Jalankan semua perintah dari root repository:

```sh
npm ci
npm run dev
```

- Web: `http://localhost:3000`
- File API: `http://localhost:3001`
- Health API: `http://localhost:3001/health`
- Kesiapan engine: `http://localhost:3001/ready`

Untuk checkout baru, salin `apps/web/.env.example` menjadi `apps/web/.env.local`, lalu isi public key dan URL Supabase. Jika sudah memiliki file environment, pertahankan nilai yang ada. Migrasi lokal memindahkan `.env`/`.env.local` lama ke `apps/web/` tanpa menampilkan nilainya.

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_public_key
FILE_API_URL=http://localhost:3001
```

Legacy `SUPABASE_ANON_KEY` tetap didukung. Konfigurasi URL/API key publik dipetakan ke bundle browser saat build; perubahan URL API production memerlukan build/deployment web baru.

Nama lama `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `NEXT_PUBLIC_FILE_API_URL` tetap diterima sebagai fallback. Nama baru di atas diprioritaskan. Nilai ini tetap publik meskipun prefix dihapus; gunakan hanya Supabase publishable/anon key.

Backend dapat dikonfigurasi lewat `apps/api/.env` berdasarkan `apps/api/.env.example`. Default lokal hanya mengizinkan origin `http://localhost:3000`. Untuk web dengan port lain, sesuaikan `WEB_ORIGINS`.

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
| `npm test` | Tes helper aplikasi, protokol OAuth, CORS, dan batas HTTP |
| `npm run test:files` | Tes engine Python; memerlukan dependency backend |
| `npm run test:files -- --fixtures` | Menghasilkan fixture sintetis di `test-output/fixtures` |
| `npm run test:api` | Menguji API nyata port 3001, dengan fixture dan API aktif |
| `npm run test:auth` | Memeriksa route callback web pada port 3000 tanpa mengirim email |
| `npm run check:css` | Diagnostik class CSS web |
| `npm run check:deployment -- --web https://web-anda.example.com --api https://api-anda.example.com` | Memeriksa koneksi deployment, autentikasi, engine, CORS, dan ZIP sintetis |

Tes API nyata menerima `FILE_TOOLS_TEST_URL` dan `FILE_TOOLS_WEB_ORIGIN` untuk origin lain. `AUTH_TEST_URL` mengubah target pemeriksaan callback web. Artefak sintetis tetap di direktori `test-output/` yang diabaikan Git.

## Deployment

Gunakan repository yang sama untuk dua layanan:

| Layanan | Target | Konfigurasi utama |
| --- | --- | --- |
| `apps/web` | Vercel, framework Next.js | `FILE_API_URL=https://api-anda.example.com` dan public key Supabase |
| `apps/api` | Container/server Node + Python | `apps/api/Dockerfile`, context root repository, `WEB_ORIGINS=https://web-anda.vercel.app` |

[Panduan deployment monorepo](./DEPLOY_VERCEL.md) menjelaskan instalasi workspace, Root Directory Vercel, backend Docker, CORS, dan domain OAuth. Backend file memerlukan runtime yang menerima upload 100 MB serta proses native; backend ini tidak dipasang sebagai fungsi Vercel biasa.

[Panduan Railway + Vercel](./docs/DEPLOY_RAILWAY.md) memakai `railway.json` root untuk membangun backend Docker dan memeriksa kesiapan engine sebelum menerima traffic.

## Perilaku dan batas

- Maksimum 10 file, total 100 MiB upload dan hasil 200 MiB. Dua job bersamaan per proses API; setiap alamat klien dibatasi satu pekerjaan aktif dan enam upload per menit. Readiness/capabilities dibatasi 30 pemeriksaan per menit per alamat. Tetapkan batas upload, waktu, dan rate limit reverse proxy backend agar perlindungan juga berlaku lintas instance.
- CORS menerima origin eksplisit dari `WEB_ORIGINS`, dipisahkan koma. Wildcard tidak diterima. Akses tool tetap tidak memerlukan login, seperti perilaku sebelumnya; CORS bukan autentikasi API atau pembatas akses untuk klien non-browser. API memakai alamat peer secara default. Aktifkan `FILE_TOOLS_TRUST_PROXY=true` hanya jika semua traffic masuk melalui proxy tepercaya yang menambahkan `X-Forwarded-For`; atur `FILE_TOOLS_TRUSTED_PROXY_HOPS` sesuai jumlah proxy. Terapkan juga rate limit pada ingress untuk membatasi klien yang menyebar ke beberapa alamat atau instance.
- File diproses dalam folder job terpisah dan dihapus setelah hasil selesai dikirim atau saat kegagalan yang tertangani. Hasil dialirkan ke klien agar arsip tidak disalin penuh ke memori server. Pembatalan koneksi menghentikan worker terkait. Hard crash host/proses dapat meninggalkan folder job; bersihkan hanya folder yang sudah tidak aktif.
- Browser tidak mengirim cookie Supabase ke API file. API tidak memerlukan public Supabase key atau Google client secret. Supabase Auth tetap digunakan hanya oleh web/callback-nya.
- Semua jenis file dapat diarsipkan. Konversi mengikuti matriks format dan codec yang dapat dibaca engine; ukuran tidak selalu berkurang setelah kompresi.
- [Daftar format, batas, dan perilaku pemrosesan](./docs/FILE_TOOLS.md).
- [Konfigurasi Google OAuth dan tautan email](./docs/AUTH.md).

JSON disimpan secara lokal sesuai preferensi. Crypto input/password hanya berada di memori komponen. Portal ini belum menambahkan RBAC atau manajemen pengguna; identitas pada `AuthProvider` mengatur presentasi, bukan otorisasi server.
