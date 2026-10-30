# Celi Tools

Browser-based developer tools (JSON formatter/converter, crypto & encoding) built with Next.js 16, React 19 and Supabase auth.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Supabase credentials go in `.env.local` (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the dev server                                 |
| `npm run build`     | Production build                                     |
| `npm run lint`      | ESLint                                               |
| `npm test`          | Unit tests (`node --test`) for `app/lib`             |
| `npm run check:css` | List class names used in components but missing from `globals.css` |

## Project layout

```
app/
  (public)/page.tsx   /          Public landing page
  (public)/login/     /login     Standalone sign in
  (public)/register/  /register  Standalone registration
  (portal)/dashboard/ /dashboard Admin tools dashboard
  (portal)/json/      /json      JSON workbench
  (portal)/preferences/ /preferences Theme and local-data preferences
  (portal)/crypto/    /crypto    Encrypt, decrypt, hash, encode
  (portal)/showcase/  /showcase  Dashboard theme mockups
  layout.tsx          Root layout: fonts, AuthProvider, ThemeProvider
  globals.css         All app styles (plain CSS + Tailwind import)
  components/         Client components (one per tool, plus navbar/auth)
  lib/                Framework-free logic (.mjs + .d.mts types), Supabase clients
tests/                node:test suites for app/lib
scripts/              Dev utilities
```

Tool logic lives in `app/lib/*.mjs` so it can be unit-tested with plain Node; each has a matching `.d.mts` for types.

## Portal

The dashboard links to File Converter, File Compress, JSON Workspace and Crypto Tools. Themes apply to the shared shell and tools. JSON input is stored locally; Crypto input and passwords remain in component memory. Authentication is optional for tools. File workspaces upload to this application's backend for processing.

Quick links: `/json?view=csv`, `/json?view=xml`, `/json?view=yaml`, `/crypto?tool=sha256`, `/crypto?tool=aes-encrypt`.

The portal is a tools interface, not an RBAC or user-management backend.

Public routes use a shared marketing/auth header and footer without portal navigation. Portal routes use the sidebar layout. Login and registration use Google OAuth 2.0/OIDC or passwordless email. Successful sign-in and authenticated auth-page visits redirect to `/dashboard`. Email login does not create accounts; email registration creates an account only after email confirmation. Existing password-account holders can use the same email for a magic link.

## Authentication setup

The app uses `@supabase/ssr` browser/server clients with cookie sessions and S256 PKCE. `/auth/callback` exchanges the Google authorization code; `/auth/confirm` supports email token hashes (`type=email`) and PKCE codes from standard confirmation links. Callbacks reject external redirect destinations, do not echo provider errors/tokens, and return private, non-cacheable responses. `/api/auth/providers` reads public provider availability so the UI can disable unavailable options. Supabase remains responsible for Google/OIDC validation, email delivery, session revocation and account linking.

1. Ensure the existing Supabase project is active and reachable. The configured project `coli-tools` (`bklokpkgpbijgqidqmnv`) was restored from `INACTIVE` to `ACTIVE_HEALTHY` during implementation. Its public Auth settings returned HTTP 200 with Email enabled, signup enabled and Google disabled; Google provider configuration remains required. No replacement project was created.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains supported. Use only a publishable/anon key in public variables, never a service-role key or Google client secret. Restart/rebuild after changing public variables.
3. In Google Cloud, create a **Web application** OAuth client and configure the consent screen with only `openid`, `email`, `profile`. Authorized app origins include `http://localhost:3000` and your production origin. Set Google's **Authorized redirect URI** to `https://bklokpkgpbijgqidqmnv.supabase.co/auth/v1/callback` (use the matching Supabase host if changing projects). This is the Supabase provider callback, distinct from the application's callback. Add test users if the Google app is in testing mode.
4. In Supabase Auth → Sign In / Providers → Google, enable Google and enter the client ID and client secret **there**. No Google secret belongs in this repository or browser bundle.
5. Keep Email enabled; enable new-user signup if registration is required. Set Site URL to your production origin (or `http://localhost:3000` for local development). Add these Redirect URLs for each approved app origin: `http://localhost:3000/auth/callback**` and `http://localhost:3000/auth/confirm**`. The trailing wildcard allows the flow/query parameters while restricting redirects to these paths. Use the corresponding exact production host; avoid a wildcard domain.
6. Standard confirmation links must preserve Supabase's generated `{{ .ConfirmationURL }}`. Open these in the same browser that requested them so the PKCE verifier cookie is available. For cross-browser email confirmation, configure both Magic Link and Confirm Signup templates to use the hash-based endpoint below. This requires the correct Site URL and template-editing permission; newer free-tier projects using default SMTP may require custom SMTP before templates can be edited.

```html
<h2>Masuk ke Celi Tools</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Konfirmasi email dan lanjutkan</a></p>
```

Configure a production SMTP provider for delivery to your users; Supabase's default sender has delivery and rate restrictions. No test email is sent to a real address by automated unit tests. Login and signup share one Google flow: the first successful Google sign-in creates the account when Supabase signup policy allows it. Email submission has a 60-second resend cooldown and neutral responses for unknown login emails. One pending standard PKCE email/OAuth flow per browser is recommended; requesting another link can invalidate an earlier verifier, so use the newest email. Google/SMTP credentials and provider activation must be verified before claiming a real end-to-end login succeeds.

Current portal tools remain available without signing in, matching the existing product behavior. This refactor does not turn the portal into an authorization boundary. Session data in `AuthProvider` controls presentation only; future protected server routes must validate identity with `getUser()`/`getClaims()` and implement the applicable access policy. Browser clients refresh sessions; server-side session reads outside the callback routes would additionally require a Supabase session-refresh proxy.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## File processing backend

`/converter` and `/compress` call Node route handlers under `/api/files/`. Each job runs a Python worker with Pillow/HEIF, PyMuPDF, LibreOffice and FFmpeg. The format picker only exposes compatible destinations and available engines. Unsupported formats receive an explicit error.

| Category | Supported input examples | Destinations |
| --- | --- | --- |
| Images | JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO, HEIC/HEIF, JPEG 2000, SVG | JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, ICO, PDF |
| PDF | PDF | TXT, DOCX, all pages as PNG/JPEG in ZIP |
| Documents | DOC/DOCX, ODT, RTF, TXT, HTML, EPUB, Markdown | PDF, DOCX, ODT, RTF, TXT, HTML, EPUB |
| Spreadsheets | XLS/XLSX, ODS | XLSX, XLS, ODS, CSV, TSV, JSON, PDF, HTML |
| Presentations | PPT/PPTX, ODP | PPTX, ODP, PDF |
| Structured data | JSON, YAML, XML, CSV, TSV | JSON, YAML, XML, CSV, TSV, XLSX, TXT |
| Audio | MP3, WAV, FLAC, AAC, M4A, OGG, Opus, WMA, AIFF | MP3, WAV, FLAC, AAC, M4A, OGG, Opus |
| Video | MP4, MOV, MKV, WebM, AVI, M4V, MPEG, WMV, FLV, 3GP, TS | MP4, WebM, MKV, MOV, AVI; audio extraction to MP3, WAV, M4A |

All file types can be archived losslessly to ZIP/TAR.GZ, or individually to GZIP/BZIP2/XZ. Specialized compression optimizes images to WebP, PDFs, audio to MP3, and video to MP4. Already compressed files may grow; the interface reports actual sizes rather than promising savings. Format support depends on the source codec and file contents, not only its extension.

Limits: 10 files and 100 MiB total per upload, 200 MiB result, two concurrent jobs per Node process, four minutes per job, 90 seconds per Office conversion, 10 minutes of media, 200 PDF pages (80 for PDF-to-DOCX), and 12 MiB per structured data source. Batch conversion returns ZIP. PDF text extraction does not include OCR. Spreadsheet tabular exports use calculated values from the first sheet only. EPUB-to-Office reconstruction can lose images/layout. Lossy output and format changes can reduce quality; relevant notes appear beside settings and results.

Files are uploaded to this application's server, processed in separate temporary job folders and removed after the response is prepared or a handled failure occurs. No third-party conversion API is used. A hard process/server crash can leave job folders: periodically remove **inactive** `.file-tools/jobs/job-*` directories in production. Do not log uploaded contents. Archives are created, never extracted. Encrypted PDFs, signed PDFs and external Office references are rejected. Native file parsers still require OS/container isolation for an internet-facing service.

### Windows setup

Install Node and Python 3.12, then from the repository root:

```powershell
npm ci
./scripts/setup-file-tools.ps1 -PythonPath 'C:/path/to/python.exe' -WithOffice
npm run dev
```

The setup creates a project-local `.file-tools/venv`, installs pinned Python dependencies, and optionally extracts the official LibreOffice MSI into `.file-tools/libreoffice` after checking its SHA-256. It does not install Office globally. These runtime files are ignored by Git. Without Office, document/spreadsheet/presentation conversion is disabled while other engines remain available. Override executable locations with `FILE_TOOLS_PYTHON` and `FILE_TOOLS_OFFICE` when using existing installations. Run `python server/file_worker.py --capabilities` with the configured Python to check engines.

### Deployment and verification

For Vercel, follow [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md). `vercel.json` explicitly selects Next.js to avoid Python framework selection. This deploys the web app; the current local Python file-processing backend still needs a separate service to work with a Vercel frontend.

Use a long-running Node server/container with Python and native engines installed; static hosting and a stock serverless function cannot run this backend. `Dockerfile` supplies a Linux runtime with LibreOffice, Python dependencies and bundled FFmpeg. The Docker image must be built and verified on the destination host; local verification uses the Windows runtime. Set reverse-proxy upload/time limits to match the application. Native runtime directories are excluded from Next.js output tracing and must be provisioned separately.

```sh
npm test
npm run test:files
npm run lint
npm run build
```

`test:files` generates synthetic documents/media and verifies real output files, archive round trips, PDF page/text retention, animation, calculated spreadsheet values and rejected unsafe inputs. It requires all engines for complete coverage. `server/requirements.lock` pins the verified dependency versions; `server/requirements.txt` documents compatible ranges. Review native engine and library licenses before redistribution, including PyMuPDF, pdf2docx and the FFmpeg build bundled by imageio-ffmpeg.

With the app running, generate reusable fixtures using `npm run test:files -- --fixtures`, then run `node scripts/test-file-api.mjs` for multipart upload/result/error checks against localhost:3000. Set `FILE_TOOLS_TEST_URL` to test another local application origin. Fixtures and generated outputs stay in ignored `test-output/`.
