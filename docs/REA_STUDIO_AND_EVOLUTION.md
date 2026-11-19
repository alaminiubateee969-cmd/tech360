# REA Studio teardown and approval-gated evolution

## Where to find it

In the existing Admin console:

- **Reverse Engineer** opens REA Studio (`ReaView`), available to ADMIN and above.
- **Evolution Loop** opens the governed evolution console (`EvolutionView`), available to SUPER_ADMIN.

These are existing modules, not a second application. Use the normal authenticated Admin session;
mutation requests still require the platform's session/CSRF protections. No deployment or provider
credentials are required for the local HTML-snippet analysis path.

## Operator workflow

1. **Capture a target.** In REA Studio, use an admitted public target or paste an HTML snippet.
   The capture API is `POST /api/admin/rea/targets`. For a no-network analysis, send:

   ```json
   {
     "kind": "HTML_SNIPPET",
     "html": "<!doctype html><html><head><title>Example</title></head><body><h1>Example</h1><a href='/services'>Services</a></body></html>",
     "question": "What can be established from this markup?"
   }
   ```

2. **Review the teardown.** Read observed versus inferred findings, citations and unknowns.
   `GET /api/admin/rea/targets/{id}/teardown?format=markdown` downloads the report;
   `format=json`, `format=evidence` and `format=spoken` provide its other representations.
   Reports are stored at capture time; re-analysis creates a new target rather than overwriting history.
3. **Optionally reconstruct.** Use the existing reconstruction action to derive an original brief
   through the App Factory. It is not a source-code recovery or permission to copy a target.
4. **Record a correction.** `POST /api/admin/rea/targets/{id}` accepts an observation, for example:

   ```json
   {
     "kind": "FINGERPRINT_FALSE_POSITIVE",
     "subject": "example-library",
     "detail": "The fingerprint matched a documentation example, not an installed runtime dependency."
   }
   ```

   This stores evidence, not a mutation. Not every observation yields a supported proposal.
5. **Preview a cycle.** A SUPER_ADMIN can `POST /api/admin/evolution` with `{"dryRun":true}`.
   Review proposals, declined observations and refusals. A dry run does not persist proposals.
6. **Create proposals.** POST to the same endpoint with `{}` to run the persisted cycle.
   It creates proposals and linked approval requests; it does not apply behavioural changes.
7. **Have a different SUPER_ADMIN review.** Inspect the proposal's evidence, computed risk,
   field-level patch and live before/after preview. Decide using
   `POST /api/admin/evolution/proposals/{id}` with
   `{"decision":"APPROVED","note":"Reviewed evidence and bounded effect."}` or `REJECTED`.
   The proposing actor cannot approve their own proposal. Self-rejection is allowed.
8. **Apply separately.** An approved proposal is not yet applied. A SUPER_ADMIN explicitly calls
   `POST /api/admin/evolution/proposals/{id}/apply`. It revalidates approval identity, bounds,
   immutable controls, staleness and write verification. Inspect the result; never infer success
   from the earlier decision response.
9. **Review lineage or roll back.** The console shows generations and outcomes. Use
   `POST /api/admin/evolution/proposals/{id}/rollback` with a review note for an applicable
   applied proposal. Inspect the rollback result and any refusal before claiming restoration.

## Boundaries that remain in force

- Static HTTP capture is **not** a browser: it does not execute target JavaScript, crawl freely,
  inspect authenticated pages, recover source or prove the backend stack. SSRF admission limits
  still apply. Unknowns are intentional, not missing claims to fill in.
- Browser voice support depends on browser capabilities; it does not make the capture a browser crawl.
- Evolution changes only allowlisted **configured behaviour** stored as data. It does not edit
  application source, run shell commands, grant itself permissions or weaken registered controls.
- Approval and apply remain separate. A refused decision must leave proposal state/counters alone
  and must not return instructions claiming successful approval or rejection.
- Rejection counters advance only when the pending proposal actually transitions, not on a
  duplicate/no-op mirror attempt.
- Existing migrations/schema and production acceptance requirements still apply. This guide is not
  evidence of a live production deployment or an executed provider transaction.

## Verification

Targeted tests (Node 22, after `npm ci`):

```sh
npx tsx --test --experimental-test-module-mocks \
  tests/rea-analysis.test.ts tests/rea-target-policy.test.ts \
  tests/evolution-policy.test.ts tests/evolution-preflight.test.ts \
  tests/evolution-decision-route.test.ts
```

The decision-route tests execute the evolution HTTP handler with mocked database, session and
shared decision responses. They cover failed decisions, success-only mirroring, duplicate counter
protection, self-approval refusal and the correction-to-cycle API link. They do not replace live
MySQL, browser or production role-boundary acceptance.
