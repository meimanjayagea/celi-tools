# celimanapp public flow and portal — design QA

> Historical design QA record. The authentication implementation has since changed to Google OAuth only; see [docs/AUTH.md](./AUTH.md). The former registration page now redirects to `/login`, where Google creates a celimanapp account on the user's first successful sign-in.

## Earlier update: standalone landing, login, and registration

At the time of this earlier review, `/` was a public landing page and `/login` and `/register` were separate pages using a public header/footer. `/register` now redirects to `/login`. The selected blue design remains the visual system; the public layout intentionally differs from the original dashboard composition.

Current evidence folder: `C:/Users/meiman.gea/.codex/visualizations/2026/10/29/01a185cc-49e1-7233-867e-068cdf9b8c88/`.

- Desktop production captures: `public-landing-production.jpg`, `public-login-production.jpg`, `public-register-production.jpg`.
- Full-page consistency comparison: `public-pages-comparison.jpg`; focused form comparison: `public-forms-detail.jpg`. Both were opened and inspected together.
- Mobile captures: `public-landing-mobile.jpg`, `public-login-mobile.jpg`, `public-register-mobile.jpg`; dark-state evidence: `public-auth-dark.jpg`.
- Desktop CSS viewport 1440 × 1000, 1:1 density. Login and registration captures are 1440 × 1000; landing capture is 1425 × 990 due to the capture backend's scrollbar-edge exclusion. The overview comparison scales all captures proportionally into equal-size slots; focused forms remain native density.
- Mobile viewport 390 × 844; narrow registration additionally checked at 320 × 780. Document scroll width equals client width at both tested widths.

Fidelity surfaces checked: the same Geist fonts, blue accent, themed neutral surfaces, border/radius system, brand asset, generated illustration, Lucide icons, and shared primary/secondary button components are used throughout. Login and registration share one form component with a route-specific variant; labels, spacing, input heights, icon treatment, and feedback styles were compared at native density. Public headers/footers are shared. No nested portal chrome appears on auth pages.

Issues corrected during this update: registration was previously embedded in the login form; public routes previously inherited dashboard navigation; theme handling was duplicated across shells; the auth form now owns the primary h1; dark-mode primary button text now uses a dark foreground against its light blue background.

Interactions checked: landing-to-login navigation; login-to-registration navigation; separate canonical URLs; no sidebar on either auth page; magic-link mode inside login; native required-field validation preventing empty login submission; mismatched registration passwords showing an alert and focusing confirmation; show/hide password; theme preserved from public to portal and back; dashboard navigation points to `/dashboard`. Disposable mismatched form input was used; no account was created and no email was sent.

Validation: latest production build and TypeScript passed; ESLint passed; 14 existing unit tests passed. Fresh production public-page console showed no warnings or errors. Actual authenticated redirects, email delivery and Supabase redirect-allowlist settings are not end-to-end verified with a real account.

No actionable P0/P1/P2 visual issues remain for this update. Minor differences in desktop composition versus the original dashboard mock are intentional because the user requested standalone public pages. The earlier portal review is retained below for context.

---

## Earlier portal implementation

Selected visual: design 1 (Celi Workspace). Implemented in the existing Next.js application; no separate starter or deployment was created.

## Evidence

- Source: `C:/Users/meiman.gea/.codex/generated_images/01a185cc-49e1-7233-867e-068cdf9b8c88/exec-d32b22e8-9e34-4e47-9fa2-8927c49dc4a8.png`
- Final implementation: `C:/Users/meiman.gea/.codex/visualizations/2026/10/29/01a185cc-49e1-7233-867e-068cdf9b8c88/portal-final-desktop.jpg`
- Full comparison: same folder, `portal-comparison-final.jpg`.
- Focused comparison: same folder, `portal-detail-final.jpg` (workspace rows and typography).
- Additional captures: `portal-json.jpg`, `portal-crypto.jpg`, `portal-mobile.jpg`, `portal-json-mobile.jpg`, `portal-crypto-mobile.jpg`, `portal-dark.jpg`.
- Source pixels: 1487 × 1058. Desktop CSS viewport: 1487 × 1058. Browser capture: 1472 × 1048; the capture backend excludes scrollbar edges. Compared at native 1:1 density, cropping the reference to the captured bounds, without stretching.
- State: dashboard, light theme, logged out. The reference's fictional Admin profile is replaced with the actual signed-out account state.
- Mobile viewport: 390 × 844; dashboard, JSON and Crypto document widths remained within the viewport.

## Comparison history and fixes

1. Initial comparison: hero asset was too small, workspace descriptions were too dense, and the sidebar was narrower than the chosen design. Increased sidebar to 280px, aligned workspace icon/text tracks, increased description typography, and enlarged the generated hero asset.
2. Desktop/mobile navigation: the mobile close control inherited desktop display from the shared icon-button class. Fixed its visibility explicitly. Added focus containment, Escape handling, focus restoration, hidden closed navigation and inert page content when the drawer is open.
3. Revised capture: the enlarged illustration exceeded the available desktop width by approximately 2px. Clipped the hero's decorative overflow. Post-fix browser measurement: document scrollWidth equals clientWidth (1472px).
4. Final full and focused comparison inspected together with the selected reference: no actionable P0/P1/P2 discrepancies remain for the chosen portal layout. Minor raster/font differences are recorded below.

## Required fidelity surfaces

- Typography: Geist sans for product UI and Geist Mono for code; strong headline, section headings and readable secondary copy. Responsive font sizes retained. Some mock-generated lettering differs slightly from the actual font rendering.
- Spacing/layout: persistent white sidebar, slim breadcrumb/account header, hero with illustration, two workspace directory rows, blue tool links and sample code. Same primary hierarchy as the selected design. Mobile uses a drawer and stacked workspace panels.
- Colors/tokens: blue accent, pale blue active states, white sidebar, subtle neutral background and dividers; all applied through shared theme variables. Dark, Ocean and Forest themes also implemented.
- Images/assets: standalone illustration generated from the selected visual and saved in `public/images/workspace-hero.png`. Existing Celi brand mark retained as a reusable SVG asset. Interface icons use lucide-react rather than emoji or hand-drawn illustrations.
- Copy/content: Indonesian product copy; absolute network/privacy promises removed. Mock-only tool labels replaced with existing tools and functioning links. Header shows real authentication state rather than a fabricated admin identity.

## Primary interactions checked

- Dashboard to JSON CSV quick link; selected CSV tab and correct rows.
- JSON formatting, tree, invalid-input error, manual preview update and stale-output warning.
- Crypto SHA-256 known abc vector.
- Hex encode/decode using the reverse-operation control.
- AES encrypt/decrypt round trip with disposable demo text/password.
- Dark theme persisted across navigation.
- Mobile menu open/close, sidebar navigation, focused close control and inert underlying content.
- Browser console: no runtime errors in final dashboard reload. The earlier multiple-Supabase-client warning was addressed by reusing one browser client.
- Login, signup and magic-link presentation retained; live authentication/email sending was not exercised.
- Final production smoke check: dashboard and login rendered; fresh production browser log contained no warnings or errors. Mobile drawer focused its close control, closed with Escape, and did not overflow horizontally. Production capture: `portal-production.jpg` in the evidence folder above.
- Validation: optimized production build and TypeScript passed; ESLint passed without warnings; all 14 unit tests passed, including JSON escape preservation, mixed CSV rejection, known hash vectors, UTF-8 encodings and AES round-trip/wrong-password rejection.

## Follow-up polish / limitations

- Generated mock lettering and the hero illustration are not pixel-identical to the selected raster image; layout, palette, hierarchy and visual direction are preserved.
- Showcase remains an existing, separate mockup route and is not presented as a functional admin dashboard.
- This is a tools portal. No role/permission-management backend was added.
- This is not a full accessibility certification or exhaustive browser compatibility audit.

final result: passed

## Passwordless authentication — 30 October 2026

- Refactored `/login` and `/register` to share Google OAuth and email-link UI with no password fields. Each route resets its form state when switching modes. Desktop and 390-pixel mobile layouts checked; no horizontal document overflow.
- Browser/server Supabase clients now use cookie sessions and S256 PKCE. Added `/auth/callback`, `/auth/confirm` and public provider availability. Callback redirects are restricted to portal routes; responses do not expose provider errors, cache auth results or retain auth credentials in the destination URL.
- Login email requests do not auto-create accounts; registration does. Unknown-email login responses are neutral. A resend cooldown, pending states, session loading and callback-error feedback are included.
- Verification: 24 JavaScript tests passed, including actual Supabase SDK S256 challenge/verifier exchange with a synthetic token endpoint and cookie writes. Auth HTTP route checks passed for invalid credentials, cancelled consent, missing verifier and unsupported email token types. Build, TypeScript and ESLint passed. No real email was sent and no real Google consent/login was completed.
- Restored the existing Supabase project `coli-tools` from INACTIVE to ACTIVE_HEALTHY via the Supabase integration. Public Auth settings returned HTTP 200: Email enabled, registration enabled, Google disabled. Google remains unavailable until its provider is configured/enabled in Supabase with the appropriate Google Cloud OAuth client.
- Evidence: `passwordless-login.jpg`, `passwordless-register-mobile.jpg` in the existing evidence directory. The disabled Google control accurately reflects provider availability. Setup steps and Google/Supabase callback URL differences are documented in README.

## File workspaces — 30 October 2026

- Retained the selected light sidebar/blue accent design, theme tokens, independent landing and auth pages. Shared workspace catalog now covers File Converter, File Compress, JSON and Crypto.
- Landing copy: “Ubah file. Rapikan data. Kerja jadi lebih ringan.” Dashboard and auth descriptions reflect the same file/data functions.
- Browser check: PNG to WebP uploaded and processed successfully; the result showed 1.5 KB to 1.4 KB with a download link. Two synthetic TXT/PNG files produced a 578-byte ZIP, with actual savings and lossless-archive notes.
- Responsive check: compression page tested at 390 and 320 viewport settings with equal document/client widths and stacked panels. Temporary viewport overrides reset afterward.
- Evidence: `file-converter-result.jpg`, `file-compress-mobile.jpg`, `file-tools-landing.jpg` in the existing evidence directory.
- Backend uses isolated Python workers and local native engines. Format availability, batch compatibility, upload limits, quality controls, server privacy messaging, real sizes and error states are part of the UI.
- Production build, TypeScript and ESLint passed; 18 JavaScript unit tests passed. API checks validated real image/PDF/media/spreadsheet/archive output, calculated values, invalid target rejection and cross-site rejection.
- Native Windows Office profiles use short isolated temporary paths to avoid deep extension-cache path failures. A job manifest allows Node to remove profiles after worker timeout. Office TXT export uses PDF text extraction to avoid Writer encoding dialogs.
- Final verification: all 10 Python backend tests passed (408.6 seconds, including Office exports and temporary-directory cleanup). Final production API checks passed, including DOCX to TXT. Python dependency consistency (`pip check`) passed. Final build, lint and TypeScript passed after the profile-cleanup change.
- Limitations: conversion is restricted to the displayed matrix and readable source codecs; arbitrary types can be archived. No OCR. Office layout can change; tabular sheet exports use the first sheet. Docker configuration is provided but has not been built in this Windows validation session. Download-link presentation and API output bytes were verified; the in-app browser's download-event automation timed out while requesting a saved local path.
