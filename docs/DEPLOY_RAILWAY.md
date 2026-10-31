# Menghubungkan Railway dengan web Celi Tools di Vercel

Repository: `meimanjayagea/celi-tools`. Web production yang ditemukan saat pemeriksaan: `https://web-tau-ivory-11.vercel.app`.

## 1. Buat layanan backend Railway

Pilih **New Project → Deploy from GitHub Repo** dan repository ini. Ini membuat layanan berbayar/berbasis pemakaian sesuai paket akun Railway Anda; periksa kapasitas dan biaya sebelum mengaktifkannya.

- Branch: `main` setelah perubahan konfigurasi ini di-push.
- **Root Directory: `/` (root repository), bukan `apps/api`.** Backend membutuhkan lockfile root dan package bersama.
- Config file: `/railway.json` (default). File ini memilih `apps/api/Dockerfile` dan readiness check `/ready`.
- Start command: kosongkan override; gunakan `CMD` image Docker.
- Jangan deploy worker Python `apps/api/server` sebagai layanan tersendiri. Node API menjalankan worker tersebut dari dalam image yang sama.

Isi Railway → Variables:

```env
NODE_ENV=production
HOST=0.0.0.0
WEB_ORIGINS=https://web-tau-ivory-11.vercel.app,https://web-jayas-projects-97030461.vercel.app,https://web-git-main-jayas-projects-97030461.vercel.app
FILE_TOOLS_TRUST_PROXY=true
FILE_TOOLS_TRUSTED_PROXY_HOPS=1
```

Rate limit aplikasi membatasi satu upload aktif dan enam upload per menit per alamat klien, serta 30 pemeriksaan `/ready` atau capabilities per menit. `FILE_TOOLS_TRUST_PROXY=true` membuat alamat itu dibaca dari `X-Forwarded-For`; gunakan hanya saat semua traffic datang melalui ingress Railway yang tepercaya. Jika ada beberapa proxy, sesuaikan `FILE_TOOLS_TRUSTED_PROXY_HOPS`. Terapkan juga limit request dan rate limit pada ingress agar batas berlaku lintas instance dan terhadap klien yang berganti alamat.

Biarkan Railway memasok `PORT`. Jika mengaturnya sendiri, gunakan `3001` dan samakan target port domain. Python, LibreOffice, dan direktori runtime sudah diatur di Dockerfile; tidak perlu key Supabase pada backend.

Di **Networking → Public Networking → Generate Domain**, buat domain HTTPS untuk layanan API. Gunakan port yang didengarkan proses dari log `File API ready`. Catat URL aktual, misalnya `https://<domain-api>.up.railway.app`. Placeholder ini tidak boleh disalin sebagai nilai environment.

Deployment belum siap jika `/ready` masih 503. Periksa build/runtime log, ketersediaan engine Python/Office/FFmpeg, dan memori layanan. Pastikan batas request/time limit Railway yang berlaku mendukung file yang akan diproses; konfigurasi ini tidak menaikkan batas platform.

## 2. Hubungkan web Vercel

Gunakan proyek Vercel **web**, Root Directory **apps/web**, framework **Next.js**. Pada Settings → Environment Variables, isi Production:

```env
FILE_API_URL=https://<domain-api-aktual>.up.railway.app
SUPABASE_URL=https://<project-anda>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<public-publishable-key-proyek-anda>
```

Gunakan nilai URL/key Supabase yang sama dengan konfigurasi lokal yang berfungsi. Legacy `SUPABASE_ANON_KEY` juga didukung. Jangan isi Google Client Secret atau service-role key di variabel publik.

Lakukan **Redeploy web setelah environment tersimpan**, karena tiga nilai konfigurasi browser dipetakan secara eksplisit oleh `next.config.ts` saat build. Tidak diperlukan rewrite atau proxy file melalui Vercel: browser mengunggah langsung ke Railway agar file besar tidak melewati batas payload Vercel Functions.

Proyek Vercel `api` dan `server-4ia5` bukan backend container Railway. Jangan gunakan domain kedua proyek itu sebagai `FILE_API_URL`. Tidak perlu menghapus proyek untuk menghubungkan layanan baru.

## 3. Hubungkan autentikasi Supabase

Di Authentication → URL Configuration:

```text
Site URL: https://web-tau-ivory-11.vercel.app
Redirect URLs:
https://web-tau-ivory-11.vercel.app/auth/callback**
https://web-tau-ivory-11.vercel.app/auth/confirm**
```

Tambahkan redirect URL domain lain hanya jika benar-benar digunakan. Google OAuth diarahkan ke `https://<project-anda>.supabase.co/auth/v1/callback` pada Google Cloud. Client ID/Secret dimasukkan langsung ke provider Google di Supabase. Lihat [AUTH.md](./AUTH.md).

## 4. Periksa koneksi

Setelah kedua deployment selesai, jalankan dari root repository dengan URL API aktual:

```sh
npm run check:deployment -- --web https://web-tau-ivory-11.vercel.app --api https://<domain-api-aktual>.up.railway.app
```

Skrip memeriksa web, status autentikasi, health/readiness engine, CORS, preflight, header download, serta kompresi ZIP memakai teks sintetis. Skrip berhenti dengan exit code 1 jika ada kegagalan dan tidak membaca kredensial/file pengguna. Uji juga upload dari browser untuk membuktikan bundle web menggunakan URL API yang benar.

| Gejala | Yang diperiksa |
| --- | --- |
| `/api/auth/providers` pada web mengembalikan 503 | Environment public Supabase Vercel dan redeploy web |
| Halaman file menyebut layanan belum terhubung | `FILE_API_URL` kosong pada build web |
| Request file menuju domain Vercel lama atau localhost | URL API pada build web belum diperbarui |
| API 403 / CORS error | Origin aktual browser belum ada dalam `WEB_ORIGINS` Railway |
| Redirect login Vercel / 401 | Deployment protection memblokir akses; gunakan domain yang memang diizinkan, jangan menonaktifkan proteksi tanpa meninjau kebijakan akses |
| `/ready` 503 atau deployment gagal health check | Engine belum siap; baca log backend dan periksa dependency/memori |
| `PYTHON_ENTRYPOINT_NOT_FOUND` pada `server-4ia5` | Worker ditempatkan sebagai proyek Python Vercel; gunakan backend Docker Railway |

Referensi: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Railway config as code](https://docs.railway.com/config-as-code/reference), [batas Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size).
