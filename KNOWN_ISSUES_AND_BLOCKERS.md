# Known Issues and Blockers

**Updated:** 2026-09-30

## Production blockers

| ID | Status | Impact | Exact blocker | Required next action |
|---|---|---|---|---|
| B-001 | BLOCKED | Cannot claim production deployment | No verified Ubuntu host/session, target path, process manager, DNS/SSL evidence, production environment or backup confirmation is available | Authorized operator verifies target and GitHub `production` environment secrets; run CI/deploy from an approved `main` merge and retain health/HTTPS evidence |
| B-002 | BLOCKED | External channels cannot be called live | SMTP, SMS, Meta/WhatsApp/social and payment credentials are intentionally absent/unverified | Configure secrets server-side from provider accounts, enable one integration at a time, execute approved sandbox/real tests, record provider IDs/status |
| B-003 | BLOCKED | AI success-path cannot be re-proven in this environment | Hosted model/provider availability and quota are external | Restore provider quota/access and run one approved execution for each agent family; retain execution IDs and outputs |
| B-004 | PARTIALLY_RESOLVED | Local Prisma generation remains unavailable, but authoritative CI validation is green | This sandbox reaches the Prisma CDN IP but the TLS peer closes during ClientHello (`SSL_ERROR_SYSCALL`); CA validation is never reached. Prisma 6.19.3 also maps to an upstream-reported problematic engine revision. Dependencies are pinned to 6.18.0; trusted GitHub runner run 36629219425 successfully installed, generated, typechecked and built | Preserve the exact lock. For local regeneration, use an authorized network that permits `binaries.prisma.sh`; never disable TLS. CI is the reproducible verification environment |
| B-005 | MISSING | Changes cannot be safely applied through normal production migration history | No Prisma migration directory/baseline is present | Before the next schema change: clone DB, back it up, establish and review a non-destructive baseline, test deploy/rollback; do not use `--accept-data-loss` in production |
| B-006 | MISSING | Core workflow regressions rely on manual scripts/worklog | No maintained unit/integration test command in `package.json` | Add deterministic tests for auth/RBAC, tenant isolation, proposal approval, payment verification and handover gates; execute in CI |

## Honest feature boundaries

- PayPal and SSLCommerz checkout are `INTEGRATION_NOT_BUILT`; disabled/refusal behavior is intentional.
- Content Studio creates plans, scripts, prompts, marketing kits and briefs. It does not claim to render image/video/audio files.
- Public WhatsApp contact was removed by the latest owner directive. The private adapter remains configuration-gated for future explicit authorization.
- Production performance, SEO rank, accessibility conformance and legal compliance have not been certified.

## Non-blocking technical debt

- Add dedicated `not-found.tsx` and `error.tsx` App Router boundaries in addition to SPA fallback behavior.
- Decide whether CRM stages should become admin-configurable.
- Add immutable agent version and cost-ledger models if the business needs formal chargeback.
- Consolidate role names only after an approved permission matrix; do not add labels without server-side enforcement.
- Extend reference inventory with per-URL access date, upstream license and exact adopted pattern.

## Safety rules for continuation

1. Never deploy while lint, typecheck, build, migration safety or backup verification is red.
2. Never turn an integration ACTIVE based only on environment-variable presence; perform the provider acceptance test.
3. Never print or commit production secret values.
4. Never mutate the checked-in or production database merely to make a test pass.
5. Push only `arena/01a0eebb-tech360` from this Arena session.
