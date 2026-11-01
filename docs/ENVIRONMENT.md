# Panduan environment

| Kebutuhan | Contoh | Cara memakai |
| --- | --- | --- |
| Web lokal | [apps/web/.env.example](../apps/web/.env.example) | Salin ke `apps/web/.env.local` |
| API lokal | [apps/api/.env.example](../apps/api/.env.example) | Salin ke `apps/api/.env` |
| Auth production | [deploy/vercel/.env.example](../deploy/vercel/.env.example) | Masukkan ke Vercel → Project → Settings → Environment Variables |
| File storage production | Vercel Blob **Private** | Buat/hubungkan Blob store melalui tab Storage project; token dikelola Vercel |

## Web

`AUTH_SECRET`, `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `EMAIL_FROM` dipakai server web untuk Auth.js. `FILE_API_SIGNING_SECRET` dipakai server web untuk menerbitkan token API file berumur lima menit; set secret acak yang sama pada frontend dan API Vercel. Buat skema [001_auth.sql](../apps/web/db/001_auth.sql) pada PostgreSQL auth sebelum login diaktifkan. `AUTH_URL` adalah origin web kanonis. Jangan publikasikan rahasia melalui `NEXT_PUBLIC_*` atau commit ke git.

Untuk lokal, ubah `AUTH_DATABASE_PROVIDER=none` dan kosongkan URL database bila auth belum dipakai. File web lokal mengirim FormData langsung ke API localhost. Tidak perlu `FILE_API_URL` dan tidak perlu Vercel Blob untuk kerja lokal.

## API lokal

API lokal berjalan pada `http://localhost:3001`, menggunakan `WEB_ORIGINS=http://localhost:3000`, dan menerima upload multipart langsung agar fixture lokal mudah diuji. `FILE_TOOLS_TRUST_PROXY` sebaiknya `false` kecuali seluruh trafik melewati reverse proxy tepercaya. Docker Compose mengatur port lokal 3001.

## Production di Vercel

`vercel.json` membangun Next.js (`apps/web`) dan worker container (`Dockerfile.api`) sebagai dua Vercel Services dengan domain dan route bersama. Project framework Vercel harus disetel ke **Services**, Root Directory harus repository root, dan service frontend/API memakai rewrites dari `vercel.json`.

Hubungkan **private Vercel Blob store** ke project. Vercel memasok akses storage ke runtime server; tidak menambahkan token Blob ke browser atau file `.env`. File klien diunggah langsung ke Blob, API mengambil dan menghapus input setelah proses. Hasil berada di private Blob dengan tautan unduh bertanda tangan selama satu jam. Hasil dihapus beberapa menit setelah unduhan dimulai; jika tab ditutup sebelum download, API menghapus hasil yang lebih tua dari 24 jam pada permintaan pemrosesan berikutnya.

`WEB_ORIGINS` harus berisi origin HTTPS web yang digunakan. Set `FILE_API_SIGNING_SECRET` yang sama pada frontend dan API service; production API menolak start jika secret kosong atau kurang dari 32 byte. Endpoint konversi, kompresi, dan penghapusan hanya menerima token bertanda tangan yang diterbitkan setelah sesi Auth.js tervalidasi. Route upload Blob juga mewajibkan sesi dan Origin yang diizinkan. Set `FILE_TOOLS_TRUST_PROXY=true` untuk membaca IP klien dari `x-vercel-forwarded-for` yang disetel platform. `x-forwarded-for` hanya menjadi fallback sesuai jumlah hop tepercaya.

## Alur sistem

1. Browser meminta token upload terbatas dari route server web, lalu mengunggah file ke Blob privat tanpa meneruskan isi file melalui Function Vercel.
2. Browser mengirim nama, ukuran, dan pathname Blob ke API. API hanya menerima pathname `celi-input/<uuid>/<nama>` yang divalidasi, menarik Blob melalui SDK privat, menjalankan worker lokal pada container, lalu menghapus input.
3. API menyimpan hasil sementara pada private Blob dan mengembalikan URL `GET` bertanda tangan dengan masa berlaku satu jam. Token dibatasi untuk satu objek dan operasi download.
4. Auth.js mengirim link email melalui SMTP dan menyimpan pengguna, sesi, token verifikasi, serta data rate limit di PostgreSQL.

Jangan mengatur `FILE_API_URL`/`NEXT_PUBLIC_FILE_API_URL` di production; request file tetap pada domain web yang sama dan rewrite Vercel mengarahkannya ke API container. Lihat [AUTH.md](./AUTH.md) dan [DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md).
