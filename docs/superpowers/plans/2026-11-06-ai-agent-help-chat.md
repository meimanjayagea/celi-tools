# AI Agent Help Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated, bottom-right celimanapp help chat and an administrator UI for managing encrypted, multi-provider AI configuration.

**Architecture:** Keep provider profiles and AES-256-GCM ciphertext in the existing PostgreSQL database. Protect settings with a server-side email allowlist and keep only the encryption master key in Vercel env. Use Vercel AI SDK streaming with native OpenAI, Anthropic, and Google providers plus a configurable OpenAI-compatible endpoint; the chat sends only bounded message history and has no tools or access to application data.

**Tech Stack:** Next.js App Router, React, Auth.js, PostgreSQL (`pg`), existing migration runner, Vercel AI SDK, Vercel Production.

**Spec:** `docs/superpowers/specs/2026-11-06-ai-agent-help-chat-design.md`

## Global Constraints

- Do not return provider API keys or the encryption key to browser code.
- Restrict configuration APIs and settings UI to `AI_AGENT_ADMIN_EMAILS`.
- Restrict chat to signed-in portal users; do not persist conversation history or send private workspace data.
- Keep one PostgreSQL database and add a forward-only migration; do not seed provider credentials.
- Restrict compatible provider URLs to public HTTPS endpoints.
- Keep Indonesian/English labels and the existing dark/light theme.
- Deploy only after local production build and lint complete successfully.

## Review Focus

- Mixed-case, missing, or non-allowlisted email must not pass administrator checks.
- Missing/invalid encryption key and modified ciphertext must fail closed without contacting a provider.
- Compatible-provider URLs targeting loopback, private, or link-local addresses must be rejected.
- Oversized messages/history and rapid repeated requests must receive bounded errors without model calls.
- Missing provider/database configuration must leave the portal usable and show a clear unavailable state.

---

### Task 1: Provider storage and encryption

**Files:**
- Create: `apps/web/db/migrations/003_ai_agent.sql`
- Create: `apps/web/app/lib/ai-agent/credentials.ts`
- Create: `apps/web/app/lib/ai-agent/repository.ts`
- Create: `apps/web/app/lib/ai-agent/types.ts`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/DEPLOY_VERCEL.md`

**Interfaces:**
- `isAiAgentAdmin(email: string | null | undefined): boolean` checks the normalized email against `AI_AGENT_ADMIN_EMAILS`.
- `encryptProviderKey(plainText: string): EncryptedSecret` and `decryptProviderKey(secret: EncryptedSecret): string` use AES-256-GCM and `AI_AGENT_CREDENTIALS_ENCRYPTION_KEY`.
- Repository methods list profiles without ciphertext, upsert encrypted profiles, delete a profile, and load/decrypt the active server-side profile.
- A profile contains `id`, `name`, `provider`, `modelId`, optional `baseUrl`, `isActive`, `hasApiKey`, and an optional write-only API key input.

- [ ] Add the idempotent `celi_app.ai_provider_profiles` migration with encrypted key fields, encryption version, active state, timestamps, and one-active-profile constraint.
- [ ] Add current Vercel AI SDK dependencies for the chat UI/core, OpenAI, Anthropic, Google, and OpenAI-compatible provider adapters; verify each public API against the installed package docs before coding.
- [ ] Implement admin email normalization and AES-256-GCM encrypt/decrypt helpers using a 32-byte base64 master key; validate the key format and reject authentication-tag failures.
- [ ] Implement parameterized PostgreSQL repository methods. Ensure list/read returns `hasApiKey` only and that key replacement is write-only.
- [ ] Document both env names, key generation/rotation, and local/provider setup without writing secret values.
- [ ] Run `npm run typecheck --workspace=@celi/web`, targeted ESLint, and `npm run build --workspace=@celi/web`.

### Task 2: Secure provider and chat API routes

**Files:**
- Create: `apps/web/app/api/ai-agent/access/route.ts`
- Create: `apps/web/app/api/ai-agent/config/route.ts`
- Create: `apps/web/app/api/ai-agent/test/route.ts`
- Create: `apps/web/app/api/ai-agent/chat/route.ts`
- Create: `apps/web/app/lib/ai-agent/providers.ts`
- Create: `apps/web/app/lib/ai-agent/help-context.ts`

**Interfaces:**
- Access route returns only `{ isAdmin: boolean, available: boolean }` to the signed-in user.
- Config `GET` returns safe profile metadata. `POST` validates and upserts; `DELETE` accepts only a profile id. All require an allowlisted email.
- Test route accepts a profile id, performs one short bounded provider request, and returns a sanitized result.
- Chat route accepts at most 12 recent user/assistant messages and streams text; it requires a session, same-origin request, active provider, and rate-limit allowance.
- `createProviderModel(profile)` returns the AI SDK model adapter for an approved native provider or public OpenAI-compatible endpoint.

- [ ] Implement access/config route handlers with Auth.js checks, same-origin writes, strict JSON validation, and generic errors that never include secrets or upstream response bodies.
- [ ] Validate compatible endpoint URLs as HTTPS and resolve hostnames before rejecting private, loopback, and link-local addresses; pin the validated public address or revalidate on fetch to resist DNS rebinding.
- [ ] Implement OpenAI, Anthropic, Google, and OpenAI-compatible adapter construction using the bundled package-version documentation.
- [ ] Implement administrator-only provider test with a fixed prompt, short timeout, and no prompt/key logging.
- [ ] Implement the chat route with 10 requests/user/minute, max 12 messages, 4,000 chars/message, 12,000 chars total input, 800 max output tokens, fixed celimanapp help instructions, and no tools or database context.
- [ ] Check `auth_ip_rate_limits` storage behavior before reuse; scope keys with a one-way hash and avoid storing raw emails or prompts.
- [ ] Run typecheck, targeted ESLint, and production build.

### Task 3: Administrator configuration page

**Files:**
- Create: `apps/web/app/(portal)/ai-agent/page.tsx`
- Create: `apps/web/app/components/ai-agent-settings.tsx`
- Modify: `apps/web/app/components/navbar.tsx`
- Modify: `apps/web/app/lib/translations.mjs`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Settings client loads `/api/ai-agent/access` and `/api/ai-agent/config`; it never receives stored provider key values.
- Provider key fields are blank after save and show only whether a key is stored.
- The sidebar item is rendered only when the access endpoint reports `isAdmin`.

- [ ] Add the settings route and config UI for provider type, profile name, model ID, optional compatible base URL, write-only API key, active profile, test, save, and delete actions.
- [ ] Add validation and per-action loading, success, unavailable, and sanitized error states.
- [ ] Add the nav item conditionally through the boolean access endpoint; avoid exposing the allowlist in client bundles.
- [ ] Add Indonesian and English copy and style the page to match current panels, theme, and responsive layouts.
- [ ] Run typecheck, targeted ESLint, and production build.

### Task 4: Floating help chat

**Files:**
- Create: `apps/web/app/components/ai-help-chat.tsx`
- Modify: `apps/web/app/components/navbar.tsx`
- Modify: `apps/web/app/lib/translations.mjs`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Chat uses `useChat` with `DefaultChatTransport` pointed at `/api/ai-agent/chat`.
- The widget is rendered only when Auth.js reports a signed-in user; it keeps messages in component memory only.

- [ ] Build the bottom-right launcher and themed responsive chat panel with streamed text, send/stop, clear conversation, keyboard access, and accessible status/error announcements.
- [ ] Render only text parts as text; do not interpret model output as HTML.
- [ ] Add Indonesian and English labels, mobile full-height dialog behavior, and reduced-motion-aware open/close transitions.
- [ ] Show a clear unconfigured/unavailable notice without exposing provider configuration to non-admin users.
- [ ] Run typecheck, targeted ESLint, and production build.

### Task 5: Production configuration, migration, push, and deployment

**Files:**
- Modify: Vercel Production environment variables (no repository file)
- Apply: `apps/web/db/migrations/003_ai_agent.sql`

**Interfaces:**
- Vercel Production receives the project-owner-supplied `AI_AGENT_ADMIN_EMAILS` value and a newly generated `AI_AGENT_CREDENTIALS_ENCRYPTION_KEY`; never print or commit either environment value.
- Production migration uses the existing migration runner and database only.

- [ ] Check production database migration status without printing environment values; apply only pending migration `003_ai_agent.sql` and verify its ledger entry.
- [ ] Add the admin allowlist and generated encryption key to Vercel Production. Confirm the values are available to the production runtime without returning them in logs.
- [ ] Run the final local lint, typecheck, and production build; review `git diff --check` and secret scan output.
- [ ] Commit and push the approved source to GitHub `main`; wait for the linked Vercel Production deployment to reach `READY`.
- [ ] Fetch the production portal/config/chat routes with authenticated Vercel access and confirm successful page delivery plus safe unauthenticated responses for admin/chat APIs.
- [ ] Configure the first provider in the admin screen only after the user supplies its API key; run the built-in connection check.

## Dependency Order

Task 1 → Task 2 → Task 3 and Task 4 → Task 5. The settings and chat interfaces depend on Task 2 response contracts; Task 5 waits for all local implementation steps.
