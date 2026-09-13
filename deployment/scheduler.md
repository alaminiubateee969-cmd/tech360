# TECH360 — Production Autonomy (Cloud Scheduler)

The autonomous AI operations loop runs **inside the platform** at
`POST /api/ops/cycle` (source: `src/lib/ops-loop.ts`). No sidecar service is
required in production — a scheduler just triggers the endpoint.

## What one cycle does (detect → decide → execute → verify → log → learn)

| Duty | Executor | Real work |
| --- | --- | --- |
| Score unscored leads | Sentry agent (REV-002) | `client.score` updated in DB |
| Follow up overdue leads (>48h quiet) | Echo agent (COM-010) | message drafted, channel attempted honestly (NOT_CONFIGURED without credentials) + human task created |
| Retry failed outbound comms | platform | real re-send attempt, status recorded |
| Triage unresolved errors | Sentinel agent (ERR-034) | severity + remediation → admin notification |
| Escalate approvals pending >12h | platform | WARNING notification |
| Alert failed automations | platform | WARNING notification |
| Expire stale preview links | platform | security TTL enforced, events + alert |
| Publish due scheduled blog posts | platform | SCHEDULED → PUBLISHED at authored time |
| Daily CEO report (08:00+ Asia/Dhaka) | Pulse agent (RPT-039) | generated from live CRM data, **persisted to the CeoReport archive**, idempotent per day |
| Learn | platform | LESSON memory persisted |
| Log cycle | platform | AutomationLog row + audit entry |

## Setup

`deployment/deploy.sh` creates the scheduler job automatically. Manual equivalent:

```bash
# 1) store the ops secret
openssl rand -hex 24 | gcloud secrets create tech360-ops-secret --data-file=-

# 2) wire it into the service (also done by cloudbuild.yaml)
gcloud run services update tech360-platform \
  --region us-central1 \
  --set-secrets=OPS_SECRET=tech360-ops-secret:latest

# 3) the trigger — every minute
gcloud scheduler jobs create http tech360-ai-ops-cycle \
  --location us-central1 \
  --schedule "* * * * *" \
  --uri "https://bdtech360.com/api/ops/cycle" \
  --http-method POST \
  --headers "x-ops-secret=$(gcloud secrets versions access latest --secret=tech360-ops-secret)" \
  --time-zone "Asia/Dhaka" \
  --attempt-deadline 300s
```

## Guardrails

- **Throttle**: the endpoint skips runs when the last cycle is < 45s old
  (`MIN_CYCLE_INTERVAL_MS` in `src/lib/ops-loop.ts`), so a 1-minute scheduler
  never stacks cycles. Send `{ "force": true }` to override deliberately.
- **Auth**: `OPS_SECRET` header required; without the env var set the endpoint
  answers 401 to everyone.
- **Idempotent CEO report**: at most one SCHEDULED report per Asia/Dhaka day.
- **Observability**: `GET /api/ops/cycle` (with the secret) returns last-run
  state; the admin console Dashboard shows loop status from the heartbeat;
  every cycle lands in Automation Logs (`AI_OPS_LOOP`) and the audit trail.
- **Cloud Run note**: `maxDuration = 300` is set on the route; ensure the
  scheduler `--attempt-deadline` (300s) matches. With `min-instances=0` the
  first request after scale-to-zero includes cold-start time — harmless, the
  cycle is stateless.

## Dev

`mini-services/ai-ops` (port 3031) triggers the **same endpoint** every 90s,
so dev and production run the identical loop code. Its `GET /` health surface
reports cycle history for the admin console.

## Alternatives (any works)

- n8n Schedule Trigger → HTTP Request node → `/api/ops/cycle` with the secret
  header (workflow `AI_Ops_Cycle_Trigger.json` pattern).
- Any external cron (GitHub Actions, cron-job.org) with the header.
