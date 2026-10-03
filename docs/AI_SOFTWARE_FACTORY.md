# AI Software Factory, Media Studio, Feed Hub and the Call/SMS centre

**Added:** 2026-10-03 · **Branch:** `arena/01a1009d-tech360`

This document describes the four modules added in this round, what they really
do, what they deliberately refuse to do, and how they are operated. It also
documents the live reference verification that backs the claims about the
owner's link inventory.

Everything here obeys the platform's standing rule: **a state is reported, never
decorated.** No module claims a rendered video, a sent message, a placed call or
a successful deploy that did not actually happen.

---

## 1. AI Software Factory (`#/admin` → **App Factory**)

**The owner requirement:** one form in, a complete AI-built CRM/marketing web
application out — generated largely by automation, delivered and handed over
like any software house would.

### What it does

| Step | What happens | Where |
|---|---|---|
| Brief | Name, client, vertical, modules, language, currency, brand colour, contact, raw client notes | `FactoryView` form |
| Blueprint | Deterministic plan: pages, data models with fields, API endpoints, agents, automations, roles, acceptance criteria, **explicitly-not-built list** | `src/lib/factory/blueprint.ts` → `buildPlan()` |
| Source tree | A real Next.js (App Router) + Prisma + Tailwind project: `README.md`, `docs/SCOPE.md`, `docs/HANDOVER.md`, `package.json`, `.env.example`, `prisma/schema.prisma`, `src/lib/db.ts`, health + lead-intake routes, home/contact pages, admin console seed page, `next.config.ts`, `tsconfig.json`, `.gitignore` | `buildFiles()` |
| Review | File-by-file list, page/model/endpoint/automation plan, acceptance criteria, stage history | `GET /api/admin/factory/apps/[id]` |
| Deliver | ZIP export containing the source, the scope, the handover notes and a `DELIVERY-MANIFEST.json` | `GET /api/admin/factory/apps/[id]/export` |
| Lifecycle | `PLAN → SCAFFOLD → PREVIEW → DELIVERY → HANDOVER` with `DRAFT/PLANNED/BUILT/PREVIEW/APPROVED/DELIVERED/FAILED`; approval, delivery and handover are admin-only | `PATCH /api/admin/factory/apps/[id]` |

### Data

`GeneratedApp` (code `AF-0001`, brief JSON, plan JSON, status, stage, file count,
bytes), `GeneratedAppFile` (path, language, bytes, content), `GeneratedAppEvent`
(append-only stage history). Migration: `prisma/migrations/1_ai_software_factory`.

### Honest boundaries

- The factory ships a **reviewed starter**, not a finished product. A human
  delivery owner reviews the tree and the plan before the client sees it.
- Requests it cannot build (native apps, blockchain, 3D/game engines, clinical
  records) are returned in `plan.notBuilt` instead of being silently dropped.
- `.env.example` carries **names only**; `assertNoSecrets()` refuses to persist a
  generated file that matches a credential pattern (Stripe, webhook secret,
  private key, GitHub/npm/Google tokens) — the API returns HTTP 500 and writes
  nothing.
- Every generated project repeats the platform's own rule: an empty credential
  means `NOT_CONFIGURED`, and the code refuses to send or settle.

## 2. Media Studio (`#/admin` → **Media Studio**)

**The owner requirement:** the MoneyPrinterTurbo / Remotion / VideoCaptioner /
VoiceStudio class of capability — video, shorts, voiceover and captions.

### What it really produces, with no provider configured

- a scene-by-scene **shot plan** (HOOK, TALKING_HEAD, B_ROLL, TEXT_CARD, CTA)
  that exactly covers the requested duration with no gaps or overlaps,
- narration per shot in **English or Bangla**,
- a full **script document**,
- valid **SRT** and **WebVTT** captions (downloadable),
- a **Remotion-shaped composition specification** (`fps`, `width`, `height`,
  `durationInFrames`, scenes with `from`/`durationInFrames`) that a licensed
  renderer or the client's own Remotion project can consume.

### Provider states (honest, computed from the environment)

| Capability | Variables | Unconfigured state |
|---|---|---|
| Render | `MEDIA_RENDER_PROVIDER`, `MEDIA_RENDER_API_KEY` | `RENDER_NOT_CONFIGURED` |
| Voice/TTS | `TTS_PROVIDER_URL`, `TTS_API_KEY` | `NOT_CONFIGURED` |
| Music | `MUSIC_PROVIDER_URL` | `NOT_CONFIGURED` |

`queue-render` with no provider leaves the job in `CAPTIONS_READY` and says so;
it can never reach `RENDERED`. `voice` with no TTS endpoint keeps the narration
text and states that no audio was produced.

**Data:** `MediaJob`, `MediaShot`. **API:** `GET/POST /api/admin/media/jobs`,
`GET/PATCH /api/admin/media/jobs/[id]` (`?format=srt|vtt|script|composition`).

## 3. Feed Hub (`#/admin` → **Feed Hub**)

**The owner requirement:** the RSSHub / subscription-ingest class of capability.

- Registers public **RSS 2.0, Atom and JSON Feed** sources.
- Fetches them **server-side** through `safeFetch` (SSRF guard: public hosts
  only, byte and time limits, redirect cap) — no third-party aggregator.
- Dependency-free parser (`src/lib/feeds/parse.ts`): decodes entities, unwraps
  CDATA, **strips `<script>`/`<style>` and all markup**, clamps summaries,
  de-duplicates by guid, and returns an honest `{ ok: false, reason }` for
  anything that is not a feed.
- Each new item optionally creates an **original content idea** (a ContentAsset
  of type `OPPORTUNITY`) that explicitly says: react to this signal, never
  republish the source text.

**Data:** `FeedSource`, `FeedItem`. **API:** `/api/admin/feeds/sources`,
`/api/admin/feeds/sources/[id]` (`{action:"ingest"}` / update / DELETE),
`/api/admin/feeds/items`.

## 4. Call & SMS centre (`#/admin` → **Calls & SMS**)

**The owner requirement:** the httpSMS / linphone / VoIP-sample class of
capability, without pretending a web app owns a telephone line.

- **Device SMS gateway** (httpSMS-shaped: `HTTPSMS_BASE_URL`, `HTTPSMS_API_KEY`,
  `HTTPSMS_FROM`) implemented for real in `sendDeviceSms()` — and it refuses with
  `NOT_CONFIGURED` before making any request when credentials are missing.
- **Click-to-call**: numbers normalised to E.164, an operator dial URI produced
  (`tel:` by default, `sip:` when `SIP_DOMAIN` is configured).
- **Call log** (`CallLog`) with a validated state machine
  (`LOGGED → CONNECTED → COMPLETED | MISSED | FAILED`), outcomes, duration,
  notes and audit entries.
- **Provider state** reported from configuration: `NONE` / `DEVICE_GATEWAY` /
  `SIP` / `TWILIO`. With no voice line, the UI says plainly: *this is a logged
  call, not a server-placed one.*

## 5. Public Design Kit (`#/design-kit`)

The design system the owner asked to see is now a live page: primary, secondary,
outline, ghost, grouped and progressive affordances; the accessible sequence,
funnel and swimlane diagrams; four infographic layouts; the three product
concept mockups; colour, type, spacing and accessibility tokens. Every element
is the **same component that ships on the site** — not a screenshot. The
honest-by-default rule is visible here too: the WhatsApp component renders
nothing while the owner's public-WhatsApp removal stands.

## 6. Reference verification — every supplied link, checked live

`scripts/verify-reference-links.mjs` checks **all 134 references** from the
owner's inventory against the live network (GitHub REST API metadata: existence,
stars, license, last push, archived state) and writes:

- `docs/REFERENCE_VERIFICATION_MATRIX.md` — per-link evidence + disposition,
- `docs/reference-verification.json` — machine-readable.

Latest run: **122 exists · 3 not found · 9 unreachable**. Not-found and
unreachable links are listed explicitly — a link is never reported as working
because it was assumed to work. Re-run any time with:

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/verify-reference-links.mjs
```

## 7. Tests

`tests/factory-blueprint.test.ts`, `tests/media-studio.test.ts`,
`tests/feeds-parse.test.ts`, `tests/telephony.test.ts` (69 assertions) cover
determinism, secret refusal, timeline coverage, SRT/VTT validity, hostile-feed
handling, provider honesty and the call state machine. They run in CI with
`npm test` and need no database or model call.

## 8. Operating notes

- All four modules are behind the standard admin guard (session + RBAC + CSRF +
  rate limit) and write an audit row for every mutation.
- Views and required roles: App Factory `ADMIN`, Media Studio `STAFF`,
  Feed Hub `STAFF`, Calls & SMS `STAFF`.
- New environment variables are documented as names only in `.env.example`.
- Migrations: `prisma/migrations/1_ai_software_factory` (8 tables, no foreign
  keys — client identifiers must outlive any single record and survive the
  handover archive).
