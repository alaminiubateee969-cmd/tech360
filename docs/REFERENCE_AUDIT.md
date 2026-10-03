# External Reference Audit

**Status: LIVE-VERIFIED (existence) + IMPLEMENTED (applicable capability)**
**Last run:** 2026-10-03 · 134 references

## What changed in this round

Earlier audits disposed of a large part of the owner's inventory as
"different product category". That was correct about *what the upstream project
is*, but it was the wrong answer to the owner's actual instruction: **if the
capability is applicable to an AI-built CRM/marketing web-app company, build it
here.** This round therefore does two things:

1. **Every link is checked live.** `scripts/verify-reference-links.mjs` queries
   the GitHub REST API for every repository (existence, stars, license, last
   push, archived flag) and the network for every non-GitHub URL. Results are
   written to [`REFERENCE_VERIFICATION_MATRIX.md`](REFERENCE_VERIFICATION_MATRIX.md)
   and [`reference-verification.json`](reference-verification.json).
   Latest run: **122 exists · 3 not found · 9 unreachable** — the failures are
   listed by name in the matrix rather than glossed over.
2. **The applicable capabilities were built, not deferred.** See
   [`AI_SOFTWARE_FACTORY.md`](AI_SOFTWARE_FACTORY.md):

| Reference cluster | Capability now implemented | Where |
|---|---|---|
| MoneyPrinterTurbo · Remotion · VideoCaptioner · Pixelle · InfiniteTalk · RedditVideoMakerBot · hyperframes | Video/shorts/voiceover planning, narration, **real SRT + WebVTT captions**, Remotion-shaped render spec, honest render/voice provider states | `src/lib/media/studio.ts`, `/api/admin/media/*`, Media Studio view |
| RSSHub · youtube-subscriptions-ingest · firecrawl/web-agent | Server-side RSS/Atom/JSON ingestion with a dependency-free hardened parser, de-duplication, and original content-idea generation | `src/lib/feeds/parse.ts`, `/api/admin/feeds/*`, Feed Hub view |
| httpsms · httpsms-node · sms.domovina.ai · linphone · VoIP samples · OpenLogi | Device SMS gateway adapter, E.164 normalisation, click-to-call (`tel:`/`sip:`), persisted call log with a validated state machine | `src/lib/telephony.ts`, `/api/admin/telephony/*`, Calls & SMS view |
| Twenty · frappe/crm · Django-CRM · idurar · Odoo-mobile · ChurchCRM · crmeb · trycompai · molx · bricks | **App Factory**: brief → blueprint → real Next.js/Prisma source tree → ZIP delivery package, with stage lifecycle and handover | `src/lib/factory/blueprint.ts`, `/api/admin/factory/*`, App Factory view |
| diagram-design · archify · marketingskills · coreyhaines31 | Production design kit published publicly (buttons, diagrams, infographics, mockups, tokens) | `src/components/site/DesignKitView.tsx` → `#/design-kit` |
| open-seo · umami · Ghost · LanguageTool · humanizer · chatwoot · vaultwarden · Cap | Already shipped in earlier rounds and retained: SEO audit (42 checks), first-party analytics, blog/newsletter studios, AI review, live chat + inbox, security posture | existing modules |

Clusters that remain **not applicable** (operating-system tooling, 3D texture
painting, GPU model weights, eBPF tracing, C++/Rust libraries, IDEs, desktop
video editors, electronic-IPC helpers) are marked `NOT_APPLICABLE` **with the
reason stated per link** in the matrix — a reader can disagree with a specific
line because the line says what it is.

## Standing rules for adoption

A reference is adopted only when it has (a) a compatible license, (b) a
maintained upstream, (c) a security review, and (d) a verified TECH360
requirement. Where the upstream is a **provider** (model weights, GPU renderers,
SIP stacks, music generation), Tech360 implements the honest adapter boundary and
reports `NOT_CONFIGURED` rather than simulating output.

Re-run the verification any time:

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/verify-reference-links.mjs
```
