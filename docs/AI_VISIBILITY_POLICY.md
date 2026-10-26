# Visibility & control policy — internal automation (owner directive)

## Rule 1 — Never disclose AI operation publicly

Nowhere — the public website, blog, social posts, client documents
(SOW previews, invoices, handover certificates, official info sheets),
emails/WhatsApp to clients, the client portal, or any other external
channel — may state or imply that TECH360's own operations or client
projects are run by AI models or AI agents.

Public wording standard:

- Live chat is **"Live Support" / "Chat with our team"** (TECH360 Support),
  never "AI assistant".
- All client-facing messages sign **"Team Tech360"**.
- Diagrams and stats say **automation / workflow runs**, never
  "AI workforce / agent runs".
- Services we *sell* (e.g. automation systems for a client's own
  business) are described as client systems — never as how TECH360
  itself delivers projects, and never with examples copied from our
  internal enquiry/scope process.

Enforced in code (public surfaces scrubbed): `src/components/site/*`
(ChatWidget, SiteHeader, SiteFooter, buttons, About, Contact, Legal,
Portal, diagrams, design-kit), `src/data/site.ts`, `src/app/layout.tsx`
metadata, `src/lib/comms.ts` email templates, the official invoice
footnote, `prisma/seed.ts` (blog + company memory), `README.md`.

Audit before any release:

```bash
grep -rniE "ai assistant|ai workforce|ai agents answer|agent runs" \
  src/components/site src/data src/app/layout.tsx src/lib/comms.ts
# expected: no hits (client-service names like "AI Agent Systems" as a
# purchasable client service are the only permitted AI wording, and
# they must never describe TECH360's own delivery)
```

Existing published blog posts in a live database are edited from
**Blog Studio** in the console (seed changes only affect fresh installs).

## Rule 2 — Control only from Super Admin & Admin dashboards

The internal automation system is controlled **only** via `/#/admin`:

| Capability | SUPER_ADMIN | ADMIN | MANAGER / STAFF / public |
|---|:---:|:---:|:---:|
| View/run/control automation (agents, command, ops, memory, knowledge, n8n, automation logs) | ✅ | ✅ | ❌ |
| AI generation endpoints (content, newsletter drafts, client enrich) | ✅ | ✅ | ❌ |
| Delivery factory & media jobs | ✅ | ✅ | ❌ |
| Create agents, export registry/evidence | ✅ | ❌ | ❌ |
| Settings, feature/payment switches, team & roles | ✅ | ❌ | ❌ |

Implementation: `AI_WORKFORCE_MIN_ROLE = 'ADMIN'` and
`AI_WORKFORCE_GOVERNANCE_ROLE = 'SUPER_ADMIN'` in
`src/lib/ai-workforce-policy.ts` (single source of truth, asserted by
`tests/ai-workforce-rbac.test.ts` for every protected route). Admin
navigation (`VIEW_MIN_ROLE` in `AdminApp.tsx`) mirrors the API guards.
The scheduled ops cycle runs server-to-server with `OPS_SECRET` only —
it is not a user-facing control surface, and it still honours the
Super Admin feature switches and approval gates.
