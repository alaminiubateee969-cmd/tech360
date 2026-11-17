# TECH360 public website, portal and API audit — 2026-11-17

**Repository:** `alaminiubateee969-cmd/tech360`  
**Audited main revision:** `59e3e339287698920ff40b09547c4cc24397c0eb`  
**Review branch:** `codex/tech360-public-privacy-audit-20261117`  
**Production domain:** `https://bdtech360.com`  
**Production changes made:** None. This review branch has not been merged or deployed.

## Executive result

The public website already contains a substantial service and industry catalogue. The live site and source registry contain **21 service detail pages** and **20 industry detail pages**. The 20 industry pages have distinct hero-image mappings; the 21 service pages have distinct 1600×1000 WebP image mappings. The user-supplied content file largely overlaps these existing pages, so this change adds missing sector detail to existing content rather than creating duplicate service pages.

The site is **not certified 100% complete or production-ready**. The most important product gap is a standalone Developer Portal. The most important production evidence gap is that the live health response reported the expected main commit but also `sourceState=dirty`; Hostinger build/deploy logs and a clean release were not verified.

## Pages and surfaces reviewed

### Public website

Content and metadata were inspected for the main public pages:

- Home, Services, Industries, About, Work, Platform, Technologies, Process, FAQ, Careers and Contact.
- All 21 service detail URLs.
- All 20 industry detail URLs.

The industry registry already supplies sector-specific challenges, business models, departments, roles/permissions, workflows, modules, integrations, security controls, KPIs and delivery information. Marketing Agencies was expanded to explicitly cover SEO/SEM, paid search and social, content and video production, landing pages, email campaign handoff, conversion tracking and attribution. Digital Transformation Consulting was expanded to include business digitalisation needs such as HR, employee records, attendance, payroll, finance integrations, inventory, POS, project management, team communication, performance reporting, document management and APIs.

### Visual assets

- Source mappings identify 20 distinct industry hero images and 21 distinct service WebP visuals.
- The sampled homepage, Services page and Education industry page rendered their images during browser inspection; no broken-image placeholder was reproduced in those samples.
- The previous homepage showcase used `admin-dashboard.png` and `crm-dashboard.png`. The review branch replaces those with the customer-facing `platform-client-portal.webp` and `platform-crm-operations.webp` visuals.
- A full browser `naturalWidth > 0` sweep of every image on all 41 detail pages and every responsive viewport is **not yet complete**. The repository asset verifier is not a substitute for deployed browser verification.

### Portals and unauthenticated API checks

| Surface / endpoint | Observed result | Assessment |
|---|---|---|
| `/portal` | Client portal entry surface is present | Authenticated client workflow still needs end-to-end acceptance |
| `/super-admin` | Redirects to the hash-based admin surface | Super Admin login and workflows still need authorized acceptance |
| `/developer` | Returns 404 | No standalone Developer Portal |
| `/api/health/deep` | 401 without a session | Protected diagnostics boundary works |
| Admin dashboard, clients, agents and settings APIs | 401 without a session | Anonymous access is denied |
| Client portal `/api/portal/me` | 401 without a portal session | Anonymous access is denied |
| Factory templates API | 401 without a session | Anonymous access is denied |
| `/api/pipeline/public` | Returns a sanitized public delivery journey | Public contract is appropriately limited |

The `DEVELOPER` role exists inside the authenticated `/#/admin` console. It is not a separate portal, route or independently accepted developer experience.

## Production health observation

At the 2026-11-17 live probe:

- The public health response reported application version `0.2.1` and database UP.
- `release.commit` matched the observed main SHA `59e3e339287698920ff40b09547c4cc24397c0eb`.
- `release.sourceState` was `dirty`.
- The same public response exposed provider configuration, channel flags, agent count and internal operations heartbeat.

The last point violates the internal visibility policy. The review branch changes the contract so public `/api/health` reports only application/version, release identity and database UP/DOWN; detailed provider, channel and subsystem diagnostics are served from Super Admin-protected `/api/health/deep`. The Super Admin Settings view is updated to use the protected endpoint. This fix is **pending CI, review, merge and deployment**.

## Changes in the review branch

1. Minimise public health output and keep detailed health diagnostics behind the Super Admin guard.
2. Update the Super Admin Settings consumer and health response TypeScript contract.
3. Add API regression coverage for public-health privacy and public website copy.
4. Remove internal Company-in-a-Box naming and internal workflow counts from public-facing home, platform, navigation, metadata, structured data and `llms.txt` copy. Customer-facing service capabilities remain visible.
5. Present public chat as Live Support; remove visible AI-assistant status, reply and error wording.
6. Replace internal admin/CRM dashboard screenshots in the public showcase with customer-facing portal and CRM solution visuals.
7. Expand Marketing Agencies and Digital Transformation Consulting sector content using the supplied source file, without creating duplicate service routes or changing the 20-industry/21-service catalogue.
8. Update the Operations Guidebook and add an image/static-asset recovery runbook.

## Open work — do not mark complete

### P1 — Developer Portal product decision

A dedicated Developer Portal does not exist. The recommended implementation is a role-scoped Developer Workspace that reuses the existing authentication/session model, but exposes only assigned projects, tasks, technical documentation, API reference, release status and approved source links. It must not expose Super Admin settings, secrets, unrelated client records, agent memory or internal factory controls.

Before building it, confirm whether the intended experience is:
- a standalone `/developer` portal with the same staff authentication, or
- a Developer Workspace inside `/#/admin` with strict `DEVELOPER` navigation and API permissions.

### P1 — Clean production release evidence

- Rebuild from a clean working tree and verify `sourceState=clean`.
- Confirm the deployed SHA against the approved main revision and retain Hostinger build/start log IDs.
- Do not deploy this branch until exact-revision CI passes and the owner approves the release.

### P1 — Data, backup and provider acceptance

- Verify production migration history, schema drift, controlled CRUD/transaction behavior, tenant isolation and grants.
- Run a real production backup and isolated restore drill; record RPO/RTO.
- Test each enabled email, WhatsApp, SMS, social, payment and AI provider with authorized sandbox/live transactions. A configured key or health flag is not transaction proof.
- Confirm production admin bootstrap, password rotation, TOTP and role boundaries.

### P2 — Full browser and image acceptance

- Run the image naturalWidth sweep across every service and industry page at mobile, tablet and desktop sizes.
- Check all primary links, forms, client login, Super Admin login, keyboard navigation, accessibility, Core Web Vitals and failure states.
- Verify the exact deployed image URLs return 200 with the correct MIME type and non-zero response length.

## Operating reference

See [OPERATIONS_GUIDEBOOK.md](OPERATIONS_GUIDEBOOK.md), including **Appendix A — Image and static-asset recovery**. The guidebook now documents the public and protected health endpoint boundary, the Developer Portal gap and the exact `npm run check:assets` / `npm run build` image-verification workflow.

## Release verdict

**Not production-ready / not 100% complete.** The current branch contains targeted source and documentation improvements, but no CI result, merge, production deployment, authenticated portal acceptance, production database acceptance or restore-drill evidence has yet been obtained.
