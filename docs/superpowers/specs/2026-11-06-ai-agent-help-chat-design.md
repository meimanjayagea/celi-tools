# AI Agent Help Chat

**Status:** Proposal pending approval  
**Date:** 2026-11-06

## Intent

Add a help chat for signed-in celimanapp users and an admin menu for configuring the AI providers used by the chat. The chat appears as a floating control at the bottom right of portal pages. It answers questions about using the application's tools and does not read or modify private files, API requests, or Sticky Notes.

## Goals

- Add an **AI Agent** settings entry in the portal sidebar for authorized administrators.
- Let administrators create, update, activate, test, and remove provider profiles from the app.
- Keep provider credentials server-side and encrypted at rest in PostgreSQL.
- Add a compact, responsive, accessible help-chat panel in the bottom-right of the portal.
- Stream responses and support Indonesian and English UI labels.
- Support first-party adapters for OpenAI, Anthropic, and Google, plus configurable OpenAI-compatible endpoints for other compatible providers. Provider-specific protocols can be added through adapters.
- Push the code and deploy it to the existing Vercel Production project after configuration and verification.

## Non-goals

- No anonymous/public chat, file uploads, arbitrary web browsing, tool execution, or access to user workspaces.
- No access to private workspace content. After the user's follow-up request on 2026-11-07, store only a bounded encrypted help-chat context per account and provide a clear-chat action.
- No promise to support every proprietary provider protocol in the first release. Providers that implement the OpenAI API can use the configurable compatible endpoint; providers with a different protocol need an adapter.

## Approaches

1. **Selected: encrypted provider profiles in the app.** Store provider/model settings and encrypted API keys in `celi_app`; keep the encryption key and administrator email allowlist in Vercel environment variables. This gives the requested in-app administration without exposing provider keys to browser code.
2. **Vercel environment variables only.** Provider keys remain protected, but administrators cannot manage them in the application and changes require Vercel environment updates and a deployment.
3. **Plaintext provider keys in PostgreSQL.** This is simpler but leaves credentials readable to database access paths and is not acceptable for this application.

The AI SDK offers provider-specific adapters and a configurable OpenAI-compatible provider. Its chat UI uses a transport-based streaming flow. These are the planned integration boundaries: [AI SDK provider overview](https://ai-sdk.dev/providers/ai-sdk-providers), [OpenAI-compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers), and [AI SDK chat UI](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot). Native provider references: [OpenAI](https://platform.openai.com/docs/guides/text?api-mode=responses), [Anthropic Messages](https://platform.claude.com/docs/en/api/go/messages), and [Gemini API](https://ai.google.dev/api/generate-content).

## Design

### Navigation and chat UI

- Add `/ai-agent` under the portal's **Pengaturan** sidebar group. The route and link are visible only to administrators.
- Add one floating help-chat button to the signed-in portal shell. Opening it shows a compact chat panel with encrypted account-bound context, a text composer, send/stop controls, streamed answers, loading/error states, and a clear-chat action.
- On narrow screens, show the panel as a full-height dialog with the app theme and existing Indonesian/English language switch.
- Show a clear unavailable state if no active provider is configured.

### Administrator access

- Use a server-only `AI_AGENT_ADMIN_EMAILS` allowlist because the application does not currently have an administrator-role table.
- Normalize and compare the authenticated Google account email on every settings read/write. Hiding the link is only presentation; every API handler must enforce the allowlist.
- The project owner supplied the first administrator email; keep it in Vercel environment settings and out of repository files.

### Provider configuration

- Support multiple provider profiles with a label, provider type, model ID, optional public HTTPS base URL for compatible APIs, active state, and encrypted key.
- First-party provider types: OpenAI, Anthropic, and Google. Add a configurable OpenAI-compatible profile for services such as compatible hosted gateways and self-hosted endpoints reachable over public HTTPS.
- Provide add/edit, test connection, activate, and delete actions. The API returns only `hasApiKey`; stored keys are never returned or logged. A key can be replaced or explicitly cleared.
- Keep provider-specific code behind adapters using the current Vercel AI SDK. No provider key is exposed through `NEXT_PUBLIC_*` variables or serialized into HTML.

### Credential protection and persistence

- Add an idempotent PostgreSQL migration creating a `celi_app.ai_provider_profiles` table. No demo provider or key is seeded.
- Encrypt each provider key with AES-256-GCM before insertion/update. Use a server-only `AI_AGENT_CREDENTIALS_ENCRYPTION_KEY` Vercel secret; store ciphertext, nonce, authentication tag, and encryption version, not plaintext.
- Do not return the encryption key or decrypted provider key to the client. Do not include prompts, responses, or credentials in logs.
- If the encryption key is absent/invalid, fail closed: settings cannot save keys and chat reports that AI is unavailable.
- Rotating or losing the encryption key requires re-entering the provider keys; document this in the environment guide.

### Chat request flow and safety

1. An authenticated portal user submits a bounded message history to `/api/ai-agent/chat`.
2. The route verifies the session and same-origin request, validates message roles and sizes, applies per-user rate limits, and loads the active provider profile server-side.
3. The route decrypts the key only in server memory, appends fixed celimanapp help instructions and a matching built-in skill, and streams a response through the selected provider adapter.
4. The route reads the user's encrypted bounded help-chat context and writes a completed turn to that same account's memory. It does not read application files, notes, API collections, or settings.

Initial limits: 10 requests per user per minute, at most 25 browser messages per request, 4,000 characters per user message, 12,000 characters total model context, and 600 output tokens per response. Persist at most 24 recent chat messages / 12,000 characters, encrypted with AES-256-GCM using the server-side credentials key. Provide authenticated retrieval and same-origin clearing. Provider URLs must use HTTPS and must reject loopback, link-local, and private-network addresses to prevent SSRF. The chat has no tools or access to files, requests, notes, or other database rows beyond messages deliberately sent to it.

### API surface

- `GET /api/ai-agent/config`: administrator-only, returns profiles and active configuration without secrets.
- `POST /api/ai-agent/config`: administrator-only, validates and saves profiles; secret replacement is write-only.
- `POST /api/ai-agent/test`: administrator-only, tests the selected profile with a short fixed prompt and returns a sanitized status.
- `POST /api/ai-agent/chat`: authenticated-user chat endpoint with same-origin validation, bounded payloads, rate limits, and streamed output.
- `GET|DELETE /api/ai-agent/memory`: authenticated per-account context retrieval and clearing.

### Environment and deployment

- Add `AI_AGENT_ADMIN_EMAILS` (comma-separated Google account emails) and `AI_AGENT_CREDENTIALS_ENCRYPTION_KEY` to the environment guide.
- Add the encryption secret in Vercel Production and Preview as needed. Do not commit secret values.
- Apply the new migration with the existing migration runner before enabling the feature in Production.
- Add the first administrator email after the owner provides it, then configure a provider from the app settings page.

## Acceptance criteria

- Only allowlisted administrators can view or change provider configuration; non-admin requests receive 403.
- A stored key is encrypted at rest and never appears in any settings response, rendered page, client log, or server log.
- An administrator can configure a provider profile and run a sanitized connection test.
- Signed-in portal users can open the bottom-right help chat and receive a streamed application-help answer.
- Signed-out users cannot call the chat endpoint. The assistant cannot execute tools or access user files, API collections, or notes.
- Missing database/provider/encryption configuration produces a clear unavailable state without crashing the portal.
- Indonesian and English labels, dark/light themes, mobile layout, keyboard operation, and reduced-motion preferences remain consistent.
- Build/lint and Production deployment complete successfully; the deployed API Client/portal pages return HTTP 200.

## Implementation calls

- Use the existing PostgreSQL provider and migration runner; do not add a second database.
- Keep only the bounded help-chat memory requested by the user; encrypt it at rest and avoid collecting private workspace content.
- Use an allowlist for admin authorization rather than adding a general role-management system for this single feature.
- The user-selected approach is app-managed provider configuration with server-side encryption and a login-only, help-only chat.
