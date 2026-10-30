# Deploy Celi Tools ke Vercel

Panduan ini men-deploy aplikasi sebagai **Next.js**, sehingga Vercel tidak mencari entrypoint Python seperti `app.py` atau `main.py`.

## Cakupan deployment

| Bagian aplikasi | Status pada konfigurasi Vercel ini |
| --- | --- |
| Landing page, dashboard, tema, navigasi | Dapat di-deploy sebagai Next.js |
| JSON Workspace dan Crypto Tools | Pemrosesan berjalan di browser |
| Login/registrasi Google dan tautan email | Memerlukan Supabase aktif, provider terkonfigurasi, dan URL production diizinkan |
| Halaman File Converter dan File Compress | Halaman dapat ditampilkan |
| Pemrosesan File Converter dan File Compress, termasuk ZIP | Belum didukung oleh konfigurasi Vercel ini; backend saat ini menjalankan worker Python lokal |

Backend file menggunakan Python, FFmpeg, LibreOffice, dan direktori job yang dapat ditulis. Engine lokal di `.file-tools/` tidak ikut diunggah. Alur upload saat ini melewati Next.js dan mendukung total 100 MB; Vercel Functions memiliki batas payload request/response 4,5 MB. Mengganti framework tidak menghapus batas tersebut. Jangan menganggap pemrosesan file sudah aktif hanya karena build web berhasil.

Untuk mengaktifkan seluruh pemrosesan file sambil mempertahankan frontend Vercel, perlu refactor terpisah: layanan HTTP pemrosesan file di server/container, upload langsung ke layanan/storage tersebut, serta pengambilan status dan hasil job. Saat ini belum ada environment variable URL backend remote yang menghubungkan worker lokal ke layanan eksternal.

## 1. Siapkan repository

Pastikan versi aplikasi terbaru sudah di-push ke repository Git yang akan dihubungkan ke Vercel. Periksa perubahan terlebih dahulu, termasuk file baru di `app/`, `public/`, `scripts/`, dan konfigurasi proyek. Jangan hanya mengirim file konfigurasi jika perubahan aplikasi belum masuk repository.

Sertakan file berikut:

- `package.json` dan `package-lock.json`.
- Source aplikasi dan `next.config.ts`.
- `vercel.json` dari folder utama proyek.
- `.vercelignore` untuk unggahan CLI; engine lokal dan file `.env*` dikecualikan.

File `.env`, `.env.local`, `.file-tools/`, dan `node_modules/` tidak perlu di-push. `.gitignore` juga sudah mengecualikan file lokal tersebut. Jangan menambahkan entrypoint Python dummy: `server/file_worker.py` adalah worker CLI, bukan aplikasi ASGI/WSGI.

## 2. Import atau perbaiki proyek Vercel

Untuk proyek baru: buka Vercel → **Add New → Project**, lalu import repository.

Untuk proyek yang sudah gagal: buka pengaturan proyek → **Build and Deployment**, lalu periksa konfigurasi berikut. Nama bagian UI dapat berubah; cari pengaturan framework dan root directory.

| Pengaturan | Nilai |
| --- | --- |
| Root Directory | Folder yang berisi `package.json`, `app/`, dan `vercel.json`; biasanya root repository |
| Framework Preset | **Next.js** |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Gunakan default Next.js; jangan isi `out` atau `public` |
| Start Command | Gunakan pengelolaan runtime Next.js bawaan Vercel |

Jika repository berisi beberapa proyek, pilih subfolder `celi-tools` yang benar. Jangan memilih folder `server`, `app`, atau `public` sebagai Root Directory.

`vercel.json` menetapkan framework `nextjs` secara eksplisit. Pastikan file ini berada di Root Directory yang dipakai Vercel. Konfigurasi ini tidak dijalankan oleh `next build` lokal, sehingga pengaturan proyek di Vercel tetap perlu diperiksa.

## 3. Tambahkan environment variables

Di pengaturan Environment Variables Vercel, isi:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bklokpkgpbijgqidqmnv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public_publishable_key_dari_supabase
```

Jika proyek masih menggunakan legacy anon key, gunakan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sebagai pengganti `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ambil kunci publik dari proyek Supabase yang sama dengan URL di atas. Aplikasi memprioritaskan publishable key jika keduanya diisi.

Pilih environment **Production**. Tambahkan juga **Preview** jika deployment preview akan diuji. Gunakan field environment variables Vercel, bukan mengunggah `.env.local`.

Google Client ID dan Client Secret diisi pada provider Google di **Supabase**, bukan pada variabel `NEXT_PUBLIC_` Vercel. Database tetap berada di Supabase; tidak ada database lokal yang perlu dipindahkan ke Vercel.

Perubahan `NEXT_PUBLIC_` harus diikuti deployment baru karena nilai untuk browser dibundel saat build.

## 4. Deploy dan tentukan domain

Klik **Deploy** untuk import pertama, atau **Redeploy** pada deployment proyek yang sudah ada. Untuk percobaan setelah mengganti framework/root directory, jalankan sekali tanpa memakai build cache lama jika opsi tersebut tersedia.

Gunakan domain production yang stabil, misalnya `https://nama-aplikasi.vercel.app` atau custom domain Anda. Nama domain contoh berikut harus diganti dengan domain deployment Anda sendiri.

## 5. Konfigurasi login untuk domain production

Di Supabase → Authentication → URL Configuration:

**Site URL**:

```text
https://nama-aplikasi.vercel.app
```

**Redirect URLs**:

```text
https://nama-aplikasi.vercel.app/auth/callback**
https://nama-aplikasi.vercel.app/auth/confirm**
```

Wildcard di akhir path mengizinkan parameter flow/callback; hostname tetap dibatasi ke deployment Anda. Pertahankan URL localhost yang sudah dipakai jika masih mengembangkan aplikasi secara lokal. Untuk preview, tambahkan hanya hostname preview yang akan dipakai menguji login, lalu hapus saat tidak diperlukan.

Di Supabase → Authentication → Sign In / Providers:

- Email: aktifkan untuk tautan masuk email; izinkan signup jika registrasi dibutuhkan.
- Google: aktifkan dan isi OAuth Client ID/Client Secret Google Cloud milik aplikasi.

**Authorized redirect URI Google Cloud tetap menuju Supabase**, bukan menuju domain Vercel:

```text
https://bklokpkgpbijgqidqmnv.supabase.co/auth/v1/callback
```

Perbarui domain/origin aplikasi di pengaturan Google Cloud jika diperlukan oleh konfigurasi OAuth Anda. Jika aplikasi Google masih dalam mode Testing, akun yang dipakai menguji harus termasuk test users.

Untuk email, template standar harus mempertahankan `{{ .ConfirmationURL }}` dan tautan dibuka di browser yang sama. Panduan template hash-based serta konfigurasi SMTP ada di bagian **Authentication setup** pada README. Jika template memakai `{{ .SiteURL }}`, tautannya akan mengikuti Site URL production yang baru.

## 6. Verifikasi deployment

Periksa melalui domain production:

1. `/`, `/dashboard`, `/login`, dan `/register` terbuka tanpa error.
2. `/json` dapat memformat contoh JSON; `/crypto` menghasilkan hash.
3. `/api/auth/providers` merespons JSON. HTTP 200 berarti pengaturan provider dapat dibaca; tetap periksa nilai `google`, `email`, dan `registration`. HTTP 503 berarti koneksi/konfigurasi Supabase belum siap.
4. Setelah Google diaktifkan, uji Google consent dan kembalinya pengguna ke dashboard. Uji email dengan alamat milik Anda sendiri, lalu buka tautan terbaru.
5. `/api/files/capabilities` bukan bukti engine tersedia di Vercel. Engine yang gagal/503 menandakan backend file terpisah masih diperlukan pada arsitektur ini.

## Jika error Python muncul lagi

`PYTHON_ENTRYPOINT_NOT_FOUND` berarti proses deployment masih mencoba memuat aplikasi Python.

- Periksa Root Directory terlebih dahulu. Jika mengarah ke `server/`, Vercel tidak memakai konfigurasi Next.js di folder utama.
- Pastikan framework proyek **Next.js**, bukan Python, FastAPI, Flask, atau konfigurasi service Python terpisah.
- Pastikan deployment menggunakan commit terbaru yang menyertakan `vercel.json`.
- Hapus override Build Command yang menjalankan `pip`, `uv`, atau server Python; gunakan `npm run build`.
- Jalankan Redeploy setelah mengubah pengaturan. Mengubah file lokal tanpa mengirim commit baru tidak mengubah build dari Git.

Jika build web berhasil tetapi fitur file gagal, itu masalah runtime/backend terpisah, bukan error entrypoint yang sama.

## Dokumentasi resmi

- [Next.js pada Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Framework override pada vercel.json](https://vercel.com/docs/project-configuration/vercel-json#framework)
- [Berkas yang dikecualikan dari deployment](https://vercel.com/docs/deployments/vercel-ignore)
- [Batas payload Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size)
- [Google OAuth Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
