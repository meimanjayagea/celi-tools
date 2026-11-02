# Menghubungkan Railway dengan web Celi Tools di Vercel

Repository: `meimanjayagea/celi-tools`. Web production yang ditemukan saat pemeriksaan: `https://web-tau-ivory-11.vercel.app`.

## 1. Buat layanan backend Railway

Pilih **New Project → Deploy from GitHub Repo** dan repository ini. Ini membuat layanan berbayar/berbasis pemakaian sesuai paket akun Railway Anda; periksa kapasitas dan biaya sebelum mengaktifkannya.

- Branch: `main` setelah perubahan konfigurasi ini di-push.
- **Root Directory: `/` (root repository), bukan `apps/api`.** Backend membutuhkan lockfile root dan package bersama.
- Config file: `/railway.json` (default). File ini memilih `Dockerfile.api` pada root repository dan readiness check `/ready`.
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

Biarkan Railway memasok `PORT`. Jika mengaturnya sendiri, gunakan `3001` dan samakan target port domain. Python, LibreOffice, direktori runtime, dan ClamAV sudah diatur di Dockerfile; backend tidak memerlukan konfigurasi autentikasi.

Image API membuka port segera dan mengunduh signature ClamAV di latar belakang, lalu memperbaruinya berkala dengan `freshclam`. `/ready` dan pemrosesan file menolak permintaan sampai scanner siap. File ditolak jika terdeteksi, tidak dapat dipindai, terenkripsi, atau melewati batas scan. Pastikan layanan memiliki RAM memadai serta akses keluar DNS/HTTPS untuk mengambil signature.

Di **Networking → Public Networking → Generate Domain**, buat domain HTTPS untuk layanan API. Gunakan port yang didengarkan proses dari log `File API ready`. Catat URL aktual, misalnya `https://<domain-api>.up.railway.app`. Placeholder ini tidak boleh disalin sebagai nilai environment.

Deployment belum siap jika `/ready` masih 503. Periksa build/runtime log, ketersediaan engine Python/Office/FFmpeg, dan memori layanan. Pastikan batas request/time limit Railway yang berlaku mendukung file yang akan diproses; konfigurasi ini tidak menaikkan batas platform.

## 2. Hubungkan web Vercel dan email auth

Gunakan proyek Vercel **web**, Root Directory **apps/web**, framework **Next.js**. Pada Settings → Environment Variables, isi Production:

```env
FILE_API_URL=https://<domain-api-aktual>.up.railway.app
AUTH_SECRET=<secret-acak-minimal-32-byte>
AUTH_URL=https://web-tau-ivory-11.vercel.app
DATABASE_URL=<koneksi-postgresql-dengan-tls>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

Jalankan `npm run db:status` lalu `npm run db:migrate` dari root repository pada PostgreSQL sebelum mengaktifkan auth. Isi rahasia hanya di Environment Variables proyek **web**, jangan pada API Railway atau prefix `NEXT_PUBLIC_`. Gunakan database khusus auth dan role database dengan hak minimal. Daftarkan Authorized redirect URI `${AUTH_URL}/api/auth/callback/google` pada Google OAuth Client.

Lakukan **Redeploy web setelah environment tersimpan**. Hanya `FILE_API_URL` yang disisipkan ke bundle browser. Tidak diperlukan rewrite atau proxy file melalui Vercel: browser mengunggah langsung ke Railway agar file besar tidak melewati batas payload Vercel Functions.

Proyek Vercel `api` dan `server-4ia5` bukan backend container Railway. Jangan gunakan domain kedua proyek itu sebagai `FILE_API_URL`. Tidak perlu menghapus proyek untuk menghubungkan layanan baru.

## 3. Periksa koneksi

Setelah kedua deployment selesai, jalankan dari root repository dengan URL API aktual:

```sh
npm run check:deployment -- --web https://web-tau-ivory-11.vercel.app --api https://<domain-api-aktual>.up.railway.app
```

Skrip memeriksa web, status autentikasi, health/readiness engine, CORS, preflight, header download, serta kompresi ZIP memakai teks sintetis. Skrip berhenti dengan exit code 1 jika ada kegagalan dan tidak membaca kredensial/file pengguna. Uji juga upload dari browser untuk membuktikan bundle web menggunakan URL API yang benar.

| Gejala | Yang diperiksa |
| --- | --- |
| `/api/auth/status` pada web mengembalikan 503 | Isi environment server Auth.js, jalankan skema PostgreSQL, lalu redeploy web |
| Halaman file menyebut layanan belum terhubung | `FILE_API_URL` kosong pada build web |
| Request file menuju domain Vercel lama atau localhost | URL API pada build web belum diperbarui |
| API 403 / CORS error | Origin aktual browser belum ada dalam `WEB_ORIGINS` Railway |
| Login Google gagal | Periksa Client ID/Secret, `AUTH_URL`, Authorized redirect URI, dan log web |
| `/ready` 503 atau deployment gagal health check | Engine belum siap; baca log backend dan periksa dependency/memori |
| `PYTHON_ENTRYPOINT_NOT_FOUND` pada `server-4ia5` | Worker ditempatkan sebagai proyek Python Vercel; gunakan backend Docker Railway |

Referensi: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Railway config as code](https://docs.railway.com/config-as-code/reference), [batas Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size).
