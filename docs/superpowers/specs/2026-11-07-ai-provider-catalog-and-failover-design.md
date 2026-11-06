# AI Provider Catalog and Failover

**Status:** Approved for implementation
**Date:** 2026-11-07

## Intent

Extend the existing celimanapp help chat so an administrator can retrieve the models available to a configured provider, choose models from a live list, and configure an ordered set of provider profiles for automatic fallback when a model quota or provider service is temporarily unavailable.

The chat remains a signed-in, help-only assistant. It does not run coding agents, execute tools, or access users' files, API requests, or notes.

## Goals

- Fetch available model IDs from the selected provider instead of requiring administrators to guess model names.
- Keep API keys encrypted at rest and server-only during model discovery, provider tests, chat, and fallback.
- Add direct model adapters for OpenAI, Anthropic, Google Gemini, Groq, xAI Grok, OpenRouter, and OpenCode Zen.
- Support Hermes Agent through its remotely reachable OpenAI-compatible API server, and support other providers through the existing guarded OpenAI-compatible endpoint.
- Let administrators enable multiple profiles and set their fallback order.
- Retry a later profile for recognized quota/rate-limit and temporary availability/network failures, while preserving streaming where possible.
- Keep provider/model-specific errors sanitized and never log keys, prompts, provider response bodies, or generated text.

## Non-goals

- Running OpenCode CLI or Hermes Agent as an autonomous coding agent inside the app or a Vercel function.
- Adding shell, file, browser, workspace, or arbitrary tool access to the help assistant.
- Persisting user conversations or provider error payloads.
- Guaranteeing fallback for invalid keys, invalid requests, unsupported models, or errors after response text has already been sent.
- Automatically switching billing accounts without profiles explicitly configured by the administrator.

## Approaches

1. **Selected: server-side provider adapters with ordered profiles.** Use the existing encrypted profile store and AI SDK; add provider-specific model discovery and adapters, then treat enabled profiles as an ordered fallback chain. This keeps keys server-side, provides per-provider visibility, and fits Vercel Functions.
2. **Single model gateway.** Route all traffic through one gateway such as OpenRouter. This reduces provider-specific code but moves model availability and fallback control outside celimanapp.
3. **Run full agent runtimes.** Launch OpenCode/Hermes as separate agent services and connect to them. This provides autonomous-agent behavior but requires always-available services, broader credentials and capabilities, and is unsuitable as an in-function Vercel runtime.

The user selected approach 1. Implementation calls below are defaults proposed for review: support both Groq and xAI Grok (the request's “grox” may mean either), use OpenCode Zen's compatible API, use Hermes only through its HTTPS API server, and keep other providers available through the existing custom compatible endpoint.

## Provider and model catalog

- The settings form has a provider selector, API-key field, optional base URL for compatible services, and a **Get models** action. The model field becomes a searchable selector populated with server-returned IDs and safe display names.
- For an unsaved profile, model discovery receives the API key over the authenticated, same-origin admin endpoint, uses it only for the provider request, and discards it after the request. For a saved profile, the endpoint accepts the profile ID and decrypts the stored key server-side.
- The model catalog endpoint is administrator-only, rate-limited, bounded, non-cacheable, and returns only model identifiers and display names. It never echoes a key or raw provider response.
- Provider adapters use their respective model-list APIs. The chat adapter only offers text-generation/chat models that this help-chat implementation can call; image, embedding, speech, and agent-only models are filtered or identified as unsupported.
- Groq and xAI Grok are separate providers. OpenRouter and OpenCode Zen are separate compatible-service presets with fixed HTTPS hosts. Hermes is an endpoint preset using a reachable Hermes API server's OpenAI-compatible `/v1/models` and chat endpoints. Generic compatible endpoints retain HTTPS-only, public-address DNS pinning, origin checks, and redirect blocking.
- UI messages are localized in Indonesian and English. Available model names are provider data; they are displayed as text and never treated as markup.

## Ordered profiles and failover

- Add an integer fallback order to stored profiles. Replace the current one-active-profile unique index with an index that permits multiple enabled profiles while preserving deterministic order.
- Administrators can enable/disable profiles and move them up/down in the fallback order. The first enabled profile is the primary profile; later enabled profiles are fallback candidates. Existing profiles retain their active state and sort before newly added ones by default.
- Failover candidates are tested sequentially. Retry only recognized quota exhaustion/rate limiting (including provider-specific insufficient-quota codes), transient network timeouts/resets, and service-unavailable/5xx errors. Do not retry malformed requests, unsupported models, invalid credentials, or access-denied responses by default; surface a safe configuration hint instead.
- Preserve streaming. Buffer only control/start events until the first text delta so a retryable error before any text is emitted can discard that attempt and start the next provider. Once the first text delta is sent, stop retrying and finish/report that stream's error; this avoids duplicated or contradictory answers. The request abort signal stops both the active attempt and any fallback.
- Apply the existing per-user rate limit once per chat request, not once per fallback attempt. Add a strict total attempt/deadline limit so a long chain cannot exceed Vercel function limits.
- Track which profile succeeded only in an in-memory request result; do not log provider IDs together with prompts or responses. A later UI indicator may say which provider answered, but this design does not require it.

## Data migration and persistence

- Add a forward-only migration to add the fallback-order column, remove the single-active-profile constraint, and create an ordering index. Preserve all encrypted credentials and existing profiles.
- Do not seed dummy providers, keys, or model rows. Model lists are fetched on demand and are not persisted; the selected model ID remains in the existing profile row.
- Keep AES-256-GCM encryption and `AI_AGENT_CREDENTIALS_ENCRYPTION_KEY`; no new browser-readable environment variables.

## API surface

- `POST /api/ai-agent/models`: admin-only, same-origin, retrieves a provider catalog using either a saved profile ID or a transient API key plus provider/base URL. Returns sanitized `{ id, name }` entries.
- `POST /api/ai-agent/config`: continues to save and update encrypted profiles, now including enabled state and fallback order.
- `POST /api/ai-agent/test`: tests the selected saved profile and returns only a safe success/failure result.
- `POST /api/ai-agent/chat`: loads enabled profiles in order and performs bounded failover under the rules above.
- `GET /api/ai-agent/config`: returns safe profile metadata, order, enabled state, and `hasApiKey` only.

Every endpoint enforces the administrator email allowlist and same-origin policy where it mutates state or uses a transient key. Provider calls use strict timeouts and safe error translation.

## Security and reliability

- Never serialize provider keys, decrypted secrets, raw provider errors, or full provider response data to the browser.
- Use fixed provider origins for built-in integrations. Validate custom base URLs as HTTPS and retain DNS pinning, public-IP checks, origin binding, and redirect rejection for both model discovery and inference.
- Redact potentially credential-bearing query parameters and headers before any diagnostic output. Avoid logging request/response bodies.
- Limit model catalog size, page count, timeouts, and request body size; reject unknown providers and profile IDs.
- Run fallback with a bounded number of enabled profiles and a shared deadline. Abort remaining attempts when the user stops the request.
- If no provider can respond, return a generic localized error; show a configuration hint only to administrators.

## Acceptance criteria

- An administrator can select each built-in provider/preset, request its available models, and save a selected supported chat model.
- Hermes and other compatible endpoints work only when supplied as reachable, public HTTPS API servers; the app does not attempt to invoke local machines or start a CLI agent.
- Multiple configured profiles can be ordered and enabled together; one primary provider can fall back to the next eligible profile.
- Simulated quota/rate-limit and transient provider failures before the first text delta advance to the next profile; invalid configuration does not silently trigger a chain; an error after visible text does not restart the answer.
- API keys remain encrypted in PostgreSQL and are absent from API responses, HTML, browser logs, and application logs.
- The existing help-only scope, authentication, rate limits, bilingual UI, theme, streaming chat, and Vercel deployment remain intact.
- Typecheck and production build pass; the migration is applied safely to the existing single PostgreSQL database; production model discovery, provider test, and controlled failover are verified with valid credentials before reporting inference as live.

## References

- [Groq Models API](https://console.groq.com/docs/api-reference)
- [xAI Models API](https://docs.x.ai/developers/rest-api-reference/inference/models)
- [OpenCode Providers](https://opencode.ai/docs/providers)
- [OpenCode Go models API](https://docs.opencode.ai/docs/go/)
- [Hermes programmatic API](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md)
- [Hermes provider/model configuration](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/configuring-models.md)
- [Gemini models.list API](https://ai.google.dev/api/models)
- [OpenRouter models API](https://openrouter.ai/docs/api/api-reference/models/get-models)

## Implementation calls

- Treat “grox” as ambiguous and include both Groq and xAI Grok in the supported provider choices.
- Integrate OpenCode through its hosted Zen endpoint and Hermes through its HTTPS API server. Do not claim to run either CLI agent inside Vercel.
- Keep all providers optional and administrator-configured; a missing provider/API key leaves help chat unavailable with a clear state.
- No production inference can be declared active until the administrator adds provider credentials and a supported model in `/ai-agent`.
