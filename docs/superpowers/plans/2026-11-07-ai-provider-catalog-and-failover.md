# AI Provider Catalog and Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let celimanapp admins fetch supported models from AI providers and configure an ordered provider chain that safely fails over on quota and temporary service failures.

**Architecture:** Extend the encrypted PostgreSQL provider-profile table with an order value and allow multiple enabled profiles. Use server-only adapters and an admin-only model catalog route; keep the chat help-only and stream through a bounded fallback coordinator that can retry only before text is sent.

**Tech Stack:** Next.js 16.4.1 App Router, Node.js 26, TypeScript, AI SDK 7, PostgreSQL migrations, React, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-07-ai-provider-catalog-and-failover-design.md`

## Global Constraints

- Provider API keys remain AES-256-GCM encrypted in PostgreSQL and server-only; never return, log, or serialize keys or raw provider errors.
- Providers: OpenAI, Anthropic, Google Gemini, Groq, xAI Grok, OpenRouter, OpenCode Zen; Hermes and other custom providers use reachable HTTPS OpenAI-compatible endpoints.
- Hermes/OpenCode CLIs do not run inside Vercel functions; the chat remains help-only and has no tools or user workspace access.
- Custom endpoints require HTTPS, public IP validation, DNS pinning, same-origin binding, and redirects disabled.
- Retry only recognized quota/rate-limit and transient network/5xx errors before the first text delta; do not retry invalid requests, unsupported models, invalid credentials, or errors after text is sent.
- One authenticated-user rate-limit entry applies to the complete bounded provider chain; cancellation aborts current and later attempts.
- Migrations are forward-only and preserve existing profiles/encrypted keys; seed no dummy providers, keys, or models.

## Review Focus

- Provider-specific nested quota codes — test normalization and only advance for documented retryable failures.
- Control/start events before a pre-text stream failure — test fallback emits one valid UI stream without duplicate message state.
- Failure after first text delta — test no second provider is called and the stream ends safely.
- Custom endpoint DNS change/redirect — test pinned origin and public-address checks reject unsafe targets.
- Malformed/oversized model catalog request — test rejection, bounded output, and no key leakage.

---

### Task 1: Profile ordering and migration

**Files:** Create `apps/web/db/migrations/004_ai_provider_fallback.sql`; modify `apps/web/app/lib/ai-agent/types.ts` and `repository.ts`; create `tests/ai-agent-migrations.test.mjs`.

**Interfaces:** `ProviderProfile` and `SaveProfileInput` gain `fallbackOrder: number`; `isActive` remains enabled/eligible. `listProviderProfiles()` sorts by fallback order then stable creation time and ID. Add `listEnabledProviderProfiles()` that returns enabled profiles with server-decrypted keys.

- [x] **Step 1: Write migration contract test** asserting migration 004 adds fallback order, drops `ai_provider_one_active_idx`, creates a nonunique enabled-order index, and preserves encrypted-secret columns.
- [x] **Step 2: Run `node --test tests/ai-agent-migrations.test.mjs`** and confirm it fails before the migration is added.
- [x] **Step 3: Implement migration 004** with `fallback_order integer NOT NULL DEFAULT 0`, drop the single-active unique index if present, add a nonunique deterministic ordering index for enabled profiles, and preserve current data/constraints.
- [x] **Step 4: Update types, row mapping, save, and list methods** to persist and return deterministic fallback order; decrypt only enabled profiles when building a runtime chain.
- [x] **Step 5: Run migration test and `npm run typecheck --workspace=@celi/web`**; expect PASS/exit code 0.

### Task 2: Provider adapters and model catalog

**Files:** Create `apps/web/app/lib/ai-agent/catalog.ts` and `apps/web/app/lib/ai-agent/catalog-normalize.mjs`; create `apps/web/app/api/ai-agent/models/route.ts`; modify `types.ts`, `providers.ts`, and `repository.ts`; create `tests/ai-agent-catalog.test.mjs`.

**Interfaces:** `AiProvider` is `"openai" | "anthropic" | "google" | "groq" | "xai" | "openrouter" | "opencode-zen" | "openai-compatible"`. `normalizeProviderModels(provider, payload): Array<{ id: string; name: string }>` in `catalog-normalize.mjs` filters/normalizes provider data; `fetchProviderModels(input, fetchImpl = fetch): Promise<Array<{ id: string; name: string }>>` performs server calls and returns sanitized, bounded chat-model options. `POST /api/ai-agent/models` accepts either `{ profileId }` or `{ provider, baseUrl?, apiKey }`, is same-origin/admin-only/rate-limited, and never returns raw provider data or secrets.

- [x] **Step 1: Write catalog tests** for OpenAI-compatible and Gemini response normalization, unsupported-model filtering, result bounds, and safe errors with no key/body leakage.
- [x] **Step 2: Run `node --test tests/ai-agent-catalog.test.mjs`** and confirm it fails because catalog exports are absent.
- [x] **Step 3: Implement adapters** for OpenAI `/v1/models`, Anthropic `/v1/models`, paginated Gemini `v1beta/models`, Groq `/openai/v1/models`, xAI `/v1/language-models` or `/v1/models`, OpenRouter `/api/v1/models`, OpenCode Zen `/v1/models`, and compatible/Hermes `/v1/models`. Use provider-specific auth, filter to text-generation models, cap pages/results, set timeouts, and normalize errors. Reuse `publicPinnedFetch()` for custom discovery and add unit cases proving redirects and nonpublic DNS results are rejected.
- [x] **Step 4: Extend `createProviderModel()`** with native SDKs where available and compatible chat adapters for Groq, xAI, OpenRouter, OpenCode Zen, Hermes, and generic endpoints; retain pinned safe fetch for custom hosts.
- [x] **Step 5: Add the admin model route** with same-origin checks, bounded JSON, saved-profile decryption or transient-key use, admin rate limit, no-store headers, and `{ models: [{ id, name }] }` only.
- [x] **Step 6: Run catalog tests, targeted ESLint, and web typecheck**; expect PASS.

### Task 3: Admin model picker and ordered profiles

**Files:** Modify `apps/web/app/components/ai-agent-settings.tsx`, `apps/web/app/lib/translations.mjs`, `apps/web/app/globals.css`, `apps/web/app/api/ai-agent/config/route.ts`, `providers.ts`, and `repository.ts`.

**Interfaces:** Config responses return safe profile metadata `{ fallbackOrder, isActive, hasApiKey }`; the admin can fetch models from a saved profile or transient key, select a model, toggle profile eligibility, and reorder enabled profiles.

- [x] **Step 1: Add model-fetch UI state** for provider choice, API-key entry, loading, empty, success, and failure; ensure keys are never stored in URL or browser storage.
- [x] **Step 2: Add provider choices and searchable model selector**; saved profiles fetch by ID, new profiles send transient key in same-origin POST and discard it after receiving results.
- [x] **Step 3: Add fallback order and enable/disable controls** using compact up/down actions consistent with the existing theme/responsive layout.
- [x] **Step 4: Update config validation and persistence** to allow multiple enabled profiles, validate order/provider URL, retain write-only key behavior, and never return secrets.
- [x] **Step 5: Add Indonesian/English labels and states**; run translation lint and focused typecheck.

### Task 4: Bounded streaming failover

**Files:** Create `apps/web/app/lib/ai-agent/failover.ts` and `apps/web/app/lib/ai-agent/failover-policy.mjs`; modify `apps/web/app/api/ai-agent/chat/route.ts` and `providers.ts`; create `tests/ai-agent-failover.test.mjs`.

**Interfaces:** `classifyProviderFailure(error): { retryable: boolean; category: string }` in `failover-policy.mjs` recognizes documented quota/rate-limit, transient network, and 5xx failures. `streamWithFallback({ profiles, messages, system, signal, maxAttempts })` in `failover.ts` tries enabled profiles in order with a shared deadline and preserves one UI message stream.

- [x] **Step 1: Write failover tests** for ordered success, quota/429, 503/network, invalid key/no retry, abort, pre-text fallback discarding attempt events, and post-text failure not restarting.
- [x] **Step 2: Run `node --test tests/ai-agent-failover.test.mjs`** and confirm the classifier/coordinator are missing.
- [x] **Step 3: Implement `classifyProviderFailure()` and pre-text attempt-selection policy** in `failover-policy.mjs`; normalize HTTP status/provider code without logging raw errors and only add documented quota/rate-limit codes as retryable.
- [x] **Step 4: Implement the stream coordinator** with installed AI SDK `createUIMessageStream`, `toUIMessageStream`, and `streamText`: buffer attempt control events until first text delta, discard and advance only for retryable pre-text errors, commit one attempt at first text, and emit sanitized failure on exhaustion.
- [x] **Step 5: Update chat route** to load the ordered enabled chain, preserve auth/same-origin/message limits/help-only instructions, apply the existing per-user limiter once, pass one deadline/abort signal, and return safe unavailable state for no configured profile.
- [x] **Step 6: Run failover tests, targeted ESLint, and web typecheck**; expect PASS.

### Task 5: Verification and release readiness

**Files:** Update the existing AI/environment deployment guide discovered during implementation; verify migration 004 and `/api/ai-agent/{models,config,test,chat}`.

- [x] **Step 1: Run focused tests** with `node --test tests/ai-agent-migrations.test.mjs tests/ai-agent-catalog.test.mjs tests/ai-agent-failover.test.mjs`; expect all PASS.
- [x] **Step 2: Run `npm run typecheck --workspace=@celi/web`, targeted ESLint, `npm run build --workspace=@celi/web` under Node 26, and `git diff --check`; expect exit code 0.
- [ ] **Step 3: Review migration status and apply migration forward-only** to the existing PostgreSQL database; preserve `celi_auth`, `celi_app`, and `celi_meta` data, then restore Read-only.
- [ ] **Step 4: Verify authenticated admin flow with mocked provider APIs**: model retrieval, no key echo, encryption, provider test, ordered fallback, abort, and sanitization without live billing.
- [ ] **Step 5: Verify production deployment/runtime errors.** A real-provider handshake and live failover remain unverified until the admin configures a valid provider key and model in `/ai-agent`.

## Execution Notes

- Native execution was previously selected for the AI Agent feature; implement this plan in the current worktree and review the complete change before release.
- No provider API key is currently configured in the profile database; keep live-provider checks mocked until the owner configures a real key.