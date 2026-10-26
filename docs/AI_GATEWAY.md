# TECH360 Shared AI Gateway

One policy-controlled inference entry point for Tech360 applications,
implemented **inside the existing Next.js architecture** (same repo, same
MySQL/Prisma platform, no new runtime dependency). CRM, the agent
workforce (AgentOS in this codebase), and any future research
application call the gateway instead of holding provider keys.

## Endpoints

| Route | Purpose | Auth |
|---|---|---|
| `POST /api/ai-gateway/v1/chat/completions` | Inference (OpenAI-shaped response) | Gateway app token |
| `GET /api/ai-gateway/v1/chat/completions` | Caller identity check | Gateway app token |
| `GET /api/ai-gateway/health` | Process liveness only | None |
| `GET /api/ai-gateway/ready` | Fail-closed readiness (registry + real provider) | None — booleans/ids only |
| `GET /api/ai-gateway/metrics` | Private counters (never public) | Gateway app token |

Liveness is not readiness: `/ready` returns 503 until the app registry
is valid **and** a real provider is configured. Mock mode never
satisfies readiness and is forbidden in production.

## Security model

- **Application identity:** every caller presents a bearer token; only
  its SHA-256 digest lives in `AI_GATEWAY_APPS`. Placeholder digests,
  duplicate ids, and invalid classifications fail config validation.
- **Classification policy:** requests carry `PUBLIC | INTERNAL |
  CONFIDENTIAL | RESTRICTED`. A request above the app's registered
  ceiling is denied. `CONFIDENTIAL`/`RESTRICTED` can never be routed
  to an external provider.
- **External inference** requires ALL of: `AI_EXTERNAL_DATA_POLICY=approved`,
  the provider in `AI_PROVIDER_ALLOWLIST`, the app's `allowExternal=true`,
  the app's model allowlist, and classification ≤ `INTERNAL`.
  Defaults keep external inference off; local is preferred, external is
  a fallback only when `AI_GATEWAY_EXTERNAL_FALLBACK_ENABLED=true`.
- **Limits:** per-app rate limit, global concurrency cap, request-size
  cap (413 before any provider call), output-token clamp, provider
  timeouts, bounded retries (transient only), per-provider circuit
  breaker.
- **Budgets:** when `AI_MONTHLY_BUDGET_LIMIT` or
  `AI_MAX_COST_PER_REQUEST` is set, providers/models with unknown cost
  are **refused** (`UNKNOWN_COST`). Free router models are known-zero;
  local serving cost is recorded as unknown, never invented.
- **Audit:** one structured `ai_gateway.request` event per request
  (app, provider, model, classification, tokens, cost, latency,
  outcome, correlation id). Tokens, prompts, and completions are never
  logged; prompt/completion logging is refused in production.
- **Response validation:** empty/malformed provider output is a
  retryable bad response, never returned as a fabricated answer.

## Applications

| App id | Status in this repo |
|---|---|
| `agentos` | **Integrated** — the agent engine calls the gateway first when `AI_GATEWAY_BASE_URL` + `AGENTOS_GATEWAY_TOKEN` are set (`src/lib/ai-gateway/client.ts`); otherwise its existing direct chain is unchanged. |
| `crm` | CRM exists in this platform (clients/projects in Prisma); it may be registered in `AI_GATEWAY_APPS` today. No CRM feature was rewritten to force traffic through the gateway — migration is an owner-approved follow-up (P2). |
| `phd` | **No PhD/research application exists in this repository** (verified by code and schema search). Nothing was fabricated; the gateway is ready to register it when that app exists. |

## Configuration

See `.env.ai-gateway.example`. Generate a token, store only its digest:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" YOUR_TOKEN
```

Never commit the raw token or a real gateway env file (`.gitignore`
blocks `.env.ai-gateway` / `ai-gateway.env`).

## Operational notes / limits (honest)

- Rate, circuit, concurrency, and monthly-spend state is in-process
  (survives dev reloads via `globalThis`). A multi-instance production
  deployment must move this state to MySQL/Redis — tracked as P2 in
  `docs/TECH360_BUSINESS_OS_AUDIT.md`.
- Timeouts: the gateway request timeout bounds provider calls through
  the fetch adapters; the OpenRouter free-model chain has its own
  per-attempt timeouts in `model-provider.ts`.
- Binding: when split into its own process later, bind
  `AI_GATEWAY_HOST=127.0.0.1` and keep metrics off public listeners;
  inside this monolith the metrics route requires an app token.
- Monthly spend accounting covers providers with known cost only;
  unknown-cost providers are excluded rather than counted as zero when
  budgets demand certainty — they are refused instead.

## Tests

`tests/ai-gateway.test.ts` (25 tests, `node:test`): fail-closed config,
auth (correct/incorrect/missing/tampered credentials, no token echo),
classification ceiling, PHD-style model allowlist, external-policy
gates (default-off, per-app flag, CONFIDENTIAL never external),
local-first with approved fallback, rate limit, concurrency cap,
bounded retry, circuit breaker, input-size rejection, output clamping,
secret-safe audit, unknown-cost refusal, mock marking, readiness.
