# Operations-loop endpoint reference (deployment setup not verified)

**Production status: NOT VERIFIED.** The application contains an authenticated
`POST /api/ops/cycle` endpoint and the operations-loop implementation in
`src/lib/ops-loop.ts`. This repository does not establish that a production
scheduler, webhook, or sidecar is configured to call it. Do not assume the loop
is running because the endpoint exists or because the admin UI is present.

## Runtime contract

- The app requires a non-empty `OPS_SECRET`; the endpoint compares its request
  header in constant time and fails closed when the secret is absent.
- `GET /api/health` reports the last persisted operations heartbeat when the
  database is healthy. Missing/stale heartbeat is reported honestly.
- The local `mini-services/ai-ops` helper is development tooling, not proof of a
  production scheduler or Hostinger sidecar.
- Actual scheduler identity, URL, cadence, retries, Hostinger environment, and
  successful cycles are **NOT VERIFIED**. Confirm these with the authorized
  operator before enabling autonomous operations.

## Production guardrails

1. The supported application deployment target is Hostinger's Node.js Web App;
   the legacy Google Cloud deploy and Cloud Build files are retired.
2. Do not put `OPS_SECRET` in a command-line argument, log, Git file, or chat.
   Configure it only in the authorized secret/environment panel.
3. Enable a scheduler only after reviewing the endpoint's risk controls, the
   configured secret, request cadence, and operational rollback/disable path.
4. Preserve audit/automation records; do not report a cycle as successful
   without a persisted heartbeat/result.

No Cloud Scheduler commands or production secret values are included here.
