# Sticky Note

Sticky Note adalah ruang kerja privat yang disimpan dalam PostgreSQL yang sama dengan Auth.js. Catatan tidak memuat ID pemilik dari browser: route mengambil `session.user.id`, lalu setiap query baca/tulis mengikat hasil pada ID tersebut. Penghapusan akun Auth.js menghapus catatan melalui foreign key cascade.

## Komponen

- `app/(portal)/sticky-notes/page.tsx` memeriksa sesi dan memuat workspace.
- `app/components/sticky-notes.tsx` mengelola tampilan canvas, pencarian, filter tag, editor note, drag, dan polling notifikasi.
- `app/api/sticky-notes/route.ts` melayani daftar dan pembuatan.
- `app/api/sticky-notes/[id]/route.ts` melayani edit dan hapus, dengan pemeriksaan Origin dan kepemilikan.
- `app/api/sticky-notes/reminders/route.ts` mengklaim reminder jatuh tempo secara atomik per pemilik.
- `app/lib/sticky-note-repository.ts` berisi operasi SQL berparameter; `sticky-note-validation.mjs` menolak bentuk input dan properti di luar batas.

## Data dan migrasi

Jalankan `npm run db:status` lalu `npm run db:migrate` dari root repo pada database PostgreSQL yang sama. Migrasi Flyway berurutan di `apps/web/db/migrations/` membuat tabel catatan privat, batas panjang dan posisi, daftar warna, serta indeks reminder. Flyway menyimpan versi dan checksum di `celi_meta.flyway_schema_history`. Migrasi tidak menanamkan contoh catatan; data dummy dapat mencemari catatan pengguna production. `DATABASE_URL` adalah satu-satunya URL aplikasi. `DATABASE_PROVIDER` memilih driver PostgreSQL kompatibel (Postgres, Prisma Postgres, Neon, atau Supabase PostgreSQL); database non-PostgreSQL memerlukan adapter dan konfigurasi migrasi khusus.

## Pengingat

Pengingat disimpan sebagai timestamp UTC. Browser harus memberi izin notifikasi, dan halaman Sticky Note harus terbuka agar polling tiap menit dapat menampilkan notifikasi. Reminder yang sudah diklaim hanya ditampilkan sekali. Jika halaman ditutup atau browser tidak berjalan, aplikasi ini belum memakai web push/service worker sehingga tidak dapat mengirim notifikasi latar belakang.
