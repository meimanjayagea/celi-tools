# Contoh konfigurasi environment

| Kebutuhan | Contoh | Cara memakai |
| --- | --- | --- |
| Web lokal | [apps/web/.env.example](../apps/web/.env.example) | Salin ke `apps/web/.env.local` |
| API lokal | [apps/api/.env.example](../apps/api/.env.example) | Salin ke `apps/api/.env` |
| Web production | [deploy/vercel/.env.example](../deploy/vercel/.env.example) | Masukkan ke Vercel → proyek web → Environment Variables |
| API production | [deploy/railway/.env.example](../deploy/railway/.env.example) | Masukkan ke Railway → layanan API → Variables |

## Environment web

`AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, dan `EMAIL_FROM` dipakai server web untuk Auth.js. Semuanya rahasia kecuali origin URL dan alamat pengirim; tetap jangan publikasikan kredensialnya ke browser. Jalankan skema [001_auth.sql](../apps/web/db/001_auth.sql) pada PostgreSQL auth terlebih dahulu. Setelah mengubah nilai Vercel, redeploy web; untuk lokal restart `npm run dev`.

`FILE_API_URL` adalah konfigurasi publik yang dipakai browser untuk menghubungi API file dan disisipkan saat build Next.js. Nama lama `NEXT_PUBLIC_FILE_API_URL` masih diterima sebagai fallback. Jangan isi kredensial SMTP, password database, atau `AUTH_SECRET` ke konfigurasi publik.

## Alur layanan

1. Browser memuat web Vercel dan mengirim file langsung ke `FILE_API_URL` Railway.
2. Login/register diproses oleh Auth.js pada web. Auth.js mengirim link via SMTP dan menyimpan token sekali pakai, pengguna, serta sesi di PostgreSQL.
3. API file tidak menggunakan database atau sesi auth web; akses tool tetap mengikuti perilaku aplikasi yang ada.

Panduan setup selengkapnya ada di [AUTH.md](./AUTH.md) dan [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md). `FILE_API_URL` harus menggunakan domain Railway aktual, bukan placeholder.
