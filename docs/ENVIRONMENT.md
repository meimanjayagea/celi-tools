# Panduan environment

| Kebutuhan | Contoh | Cara memakai |
| --- | --- | --- |
| Web lokal | [apps/web/.env.example](../apps/web/.env.example) | Salin ke `apps/web/.env.local` |
| API lokal | [apps/api/.env.example](../apps/api/.env.example) | Salin ke `apps/api/.env` |
| Auth production | [deploy/vercel/.env.example](../deploy/vercel/.env.example) | Masukkan ke Vercel → Project → Settings → Environment Variables |
| File storage production | Vercel Blob **Private** | Buat/hubungkan Blob store melalui tab Storage project; token dikelola Vercel |

## Web

`AUTH_SECRET`, `AUTH_URL`, `DATABASE_PROVIDER`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, dan `GOOGLE_CLIENT_SECRET` dipakai server web untuk Auth.js, Google OAuth, dan data aplikasi. Migrasi PostgreSQL berurutan berada di [apps/web/db/migrations](../apps/web/db/migrations); periksa dan terapkan dengan `npm run db:status` dan `npm run db:migrate` dari root repository. `FILE_API_SIGNING_SECRET` dipakai server web untuk menerbitkan token API file berumur lima menit; set secret acak yang sama pada frontend dan API Vercel. Jangan publikasikan rahasia melalui `NEXT_PUBLIC_*` atau commit ke git.

Untuk lokal, ubah `DATABASE_PROVIDER=none` dan kosongkan URL database bila auth belum dipakai. File web lokal mengirim FormData langsung ke API localhost. Tidak perlu `FILE_API_URL` dan tidak perlu Vercel Blob untuk kerja lokal.

## API lokal

API lokal berjalan pada `http://localhost:3001`, menggunakan `WEB_ORIGINS=http://localhost:3000`, dan menerima upload multipart langsung agar fixture lokal mudah diuji. API yang dijalankan langsung di host melewati antivirus hanya jika `FILE_TOOLS_CLAMAV_REQUIRED=true` dan ClamAV tersedia di socket `FILE_TOOLS_CLAMAV_SOCKET`. Docker Compose/API image menjalankan ClamAV sendiri. `FILE_TOOLS_TRUST_PROXY` sebaiknya `false` kecuali seluruh trafik melewati reverse proxy tepercaya. Docker Compose mengatur port lokal 3001.

## Production di Vercel

`vercel.json` pada root repository membangun Next.js (`apps/web`) dan worker container (`Dockerfile.api`) sebagai dua Vercel Services dengan domain dan route bersama. Project framework Vercel harus disetel ke **Services**, Root Directory harus repository root, dan service frontend/API memakai rewrites dari `vercel.json`. Jalankan `npm run check:layout` setelah mengganti lokasi source agar root service dan entrypoint tetap valid.

Hubungkan **private Vercel Blob store** ke project. Vercel memasok akses storage ke runtime server; tidak menambahkan token Blob ke browser atau file `.env`. File klien diunggah langsung ke Blob, API mengambil dan menghapus input setelah proses. Hasil berada di private Blob dengan tautan unduh bertanda tangan selama satu jam. Hasil dihapus beberapa menit setelah unduhan dimulai; jika tab ditutup sebelum download, API menghapus hasil yang lebih tua dari 24 jam pada permintaan pemrosesan berikutnya.

`WEB_ORIGINS` harus berisi origin HTTPS web yang digunakan. Set `FILE_API_SIGNING_SECRET` yang sama pada frontend dan API service; production API menolak start jika secret kosong atau kurang dari 32 byte. Endpoint konversi, kompresi, dan penghapusan hanya menerima token bertanda tangan yang diterbitkan setelah sesi Auth.js tervalidasi. Route upload Blob juga mewajibkan sesi dan Origin yang diizinkan. Set `FILE_TOOLS_TRUST_PROXY=true` untuk membaca IP klien dari `x-vercel-forwarded-for` yang disetel platform. `x-forwarded-for` hanya menjadi fallback sesuai jumlah hop tepercaya.

API container juga menjalankan ClamAV. Entrypoint memperbarui signature sebelum membuka port, memulai pembaruan berkala dengan `freshclam`, dan menunggu daemon siap. Callback upload Blob memindai file setelah tersimpan privat secara terpisah dari respons upload; API mewajibkan scan berhasil sebelum pemrosesan. File terenkripsi dan konten yang melewati batas pemindaian juga ditolak agar tidak dianggap bersih. Worker pemroses file berjalan dengan environment minimum tanpa token Blob atau signing secret.

## Alur sistem

1. Browser meminta token upload terbatas dari route server web, lalu mengunggah file ke Blob privat tanpa meneruskan isi file melalui Function Vercel.
2. Browser mengirim nama, ukuran, dan pathname Blob ke API. API hanya menerima pathname `celi-input/<uuid>/<nama>` yang divalidasi, menarik Blob melalui SDK privat, menjalankan worker lokal pada container, lalu menghapus input.
3. API menyimpan hasil sementara pada private Blob dan mengembalikan URL `GET` bertanda tangan dengan masa berlaku satu jam. Token dibatasi untuk satu objek dan operasi download.
4. Auth.js memverifikasi identitas Google dan menyimpan pengguna, akun OAuth, serta sesi di PostgreSQL. Akun baru dibuat otomatis saat login Google pertama.

Jangan mengatur `FILE_API_URL`/`NEXT_PUBLIC_FILE_API_URL` di production; request file tetap pada domain web yang sama dan rewrite Vercel mengarahkannya ke API container. Lihat [AUTH.md](./AUTH.md) dan [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md).
