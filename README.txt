CELI TOOLS - Base Source Code
============================

Setup
-----
1. Buat proyek Next.js:
   npx create-next-app@latest celi-tools --typescript --tailwind --app --eslint
2. Salin file-file dari folder ini ke struktur berikut (nama file di Drive adalah path yang diratakan):

   middleware.ts                          <- middleware.ts
   lib/supabase/client.ts                 <- lib-supabase-client.ts
   lib/supabase/server.ts                 <- lib-supabase-server.ts
   app/layout.tsx                         <- app-layout.tsx
   app/page.tsx                           <- app-page.tsx
   app/login/page.tsx                     <- app-login-page.tsx
   app/auth/callback/route.ts             <- app-auth-callback-route.ts
   app/dashboard/page.tsx                 <- app-dashboard-page.tsx
   app/profile/page.tsx                   <- app-profile-page.tsx
   app/tools/json-beautify/page.tsx       <- app-tools-json-beautify-page.tsx
   app/tools/api-docs/page.tsx            <- app-tools-api-docs-page.tsx
   app/tools/diagram/page.tsx             <- app-tools-diagram-page.tsx
   components/logout-button.tsx           <- components-logout-button.tsx
   supabase/schema.sql                    <- supabase-schema.sql
   package.json                           <- package.json (gabungkan dependensi jika perlu)
   .env.local                             <- .env.example (isi nilai Anda)

3. Tambahkan app/globals.css jika belum ada (create-next-app sudah membuatnya):
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

4. Jalankan schema.sql di Supabase SQL Editor.
5. Aktifkan provider Google di Supabase (Authentication > Providers > Google) dan isi Client ID serta Secret dari Google Cloud Console.
6. Tambahkan redirect URL http://localhost:3000/auth/callback di Supabase (Authentication > URL Configuration).
7. npm install && npm run dev

Catatan
-------
- Catatan import: app/login/page.tsx dan components/logout-button.tsx memakai "@/lib/supabase/client". Pastikan path ini sesuai.
- Middleware melindungi /dashboard dan /profile.
- Tool JSON Beautify berjalan sepenuhnya di browser.
- Tool API Docs saat ini hanya editor dan preview teks. Rencana pengembangan: render OpenAPI dengan Swagger UI atau Redocly.
- Tool Diagram memakai Mermaid. Use case diagram belum didukung native; bisa ditambahkan nanti.

Deploy
------
Push ke GitHub, import di Vercel, isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di Environment Variables, lalu tambahkan domain Vercel ke URL Configuration di Supabase.
