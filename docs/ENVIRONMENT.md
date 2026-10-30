# Contoh konfigurasi environment

| Kebutuhan | Contoh | Cara memakai |
| --- | --- | --- |
| Web lokal | [apps/web/.env.example](../apps/web/.env.example) | Salin ke `apps/web/.env.local` |
| API lokal | [apps/api/.env.example](../apps/api/.env.example) | Salin ke `apps/api/.env` |
| Web production | [deploy/vercel/.env.example](../deploy/vercel/.env.example) | Masukkan nilainya ke Vercel → proyek web → Environment Variables |
| API production | [deploy/railway/.env.example](../deploy/railway/.env.example) | Masukkan nilainya ke Railway → layanan API → Variables |
| Google OAuth dan email | [deploy/supabase/.env.example](../deploy/supabase/.env.example) | Referensi field untuk diisi manual di Supabase Cloud dan Google Cloud; bukan file yang dibaca aplikasi |

Semua key/password pada contoh adalah placeholder. URL Supabase dan domain Vercel yang dicantumkan adalah referensi proyek ini; samakan dengan proyek/domain yang benar-benar dipakai. `FILE_API_URL` harus diganti dengan domain Railway aktual.

## Nama environment web

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, dan `FILE_API_URL` dipetakan secara eksplisit oleh `apps/web/next.config.ts` ke konfigurasi browser saat build. Nama baru diprioritaskan. Alias lama `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `NEXT_PUBLIC_FILE_API_URL` masih didukung. Jangan mengisi nama lama dan baru dengan nilai berbeda.

Supabase publishable/anon key memang boleh terlihat di browser. Menghapus prefix `NEXT_PUBLIC_` tidak membuatnya rahasia; peringatan Vercel mengenai nilai publik bukan error. Google Client Secret, SMTP password, database password, dan Supabase secret/service-role key tidak termasuk konfigurasi browser.

Setelah mengganti environment Vercel, redeploy web. Untuk lokal, restart `npm run dev`. Mengisi variabel Google atau SMTP di web/API tidak mengaktifkan login: simpan kredensial provider di Supabase sesuai referensi field.

## Alur koneksi

1. Browser → web Vercel; web/browser memakai URL dan publishable key Supabase untuk Auth.
2. Login Google → Supabase → Google → callback Supabase → `/auth/callback` web.
3. Login email → Supabase mengirim pesan melalui SMTP yang dikonfigurasi pada Supabase.
4. Upload/konversi/kompresi → browser langsung ke `FILE_API_URL` Railway; origin web harus ada di `WEB_ORIGINS`.

Implementasi saat ini tidak membuka koneksi PostgreSQL langsung dan tidak membaca `DATABASE_URL`. Identitas pengguna dikelola Supabase Auth; API file tidak menyimpan upload ke database.

Lanjutkan dengan [panduan autentikasi](./AUTH.md) dan [panduan Railway + Vercel](./DEPLOY_RAILWAY.md). Setelah keduanya aktif:

```sh
npm run check:deployment -- --web https://web-tau-ivory-11.vercel.app --api https://DOMAIN-API-AKTUAL.up.railway.app
```

Referensi: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [jenis API key Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
