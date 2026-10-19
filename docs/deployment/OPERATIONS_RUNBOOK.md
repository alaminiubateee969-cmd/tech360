# Operations runbook

| | |
|---|---|
| **Document** | `docs/deployment/OPERATIONS_RUNBOOK.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. The services

| Service | Where | How it is watched | How it is restarted |
|---|---|---|---|
| The Next.js application | the application host | `/api/health`, `/api/health/deep` | the host's process manager |
| MySQL | the database host | `npm run db:verify`, `/api/health/deep` | the database service |
| The private model server | the model host | `/api/health/deep` → the provider state | `systemctl restart ollama` (or the equivalent) |
| The in-process AI operations loop | inside the application | `/api/admin/ops-status` | `AI_OPS_DRIVER=off` disables it without a restart |
| The notify relay | an external service | the Integrations panel reports its state | outside this platform |

**Nothing in this list is publicly exposed.** The model server binds to
loopback or a private address, the database is internal, and the
`/api/model/v1/*` gateway is the only path to the model.

---

## 2. The daily checks

| When | What | How | Expected |
|---|---|---|---|
| Every morning | the platform is up | `curl -fsS https://<host>/api/health` | `200` |
| Every morning | the database is reachable | `curl -fsS https://<host>/api/health/deep` | `200`, the database reachable |
| Every morning | the model service | the same response | `AVAILABLE`, or `DEGRADED` with a reason |
| Every morning | the approval queue is not stuck | the console → Approvals | no approval older than its SLA without a reason |
| Every morning | the task queue is not stuck | the console → Task Queue | no job in `RUNNING` with an expired lease |
| Every morning | the event bus is alive | the console → Event Bus | events are being published, and the newest one is recent |
| Every morning | the integrations are honest | the console → CRM Integrations | the state matches reality |

---

## 3. The weekly checks

| What | How | Expected |
|---|---|---|
| the error rate and the latency | `/api/metrics` | within the baseline |
| the failed jobs | the console → Task Queue, filter `FAILED` | each failure is understood |
| the escalations | the console → AI Employees → Event Bus, the `ESCALATED` agents | each one has been looked at |
| the audit trail | `/api/audit` | no unexpected actor, no unexpected action |
| the backup | the release schedule | a fresh artefact, with a checksum |
| the dependency state | `npm audit --production` | no new high-severity advisory |

---

## 4. The monthly checks

| What | How | Expected |
|---|---|---|
| **the restore test** | `docs/testing/RESTORE_TEST_RESULTS.md` §7, into an isolated database | the schema diff is empty, the row counts match, the health check passes, and the evidence is recorded with `proven: true` |
| the model benchmark | `npm run bench:models` | the measured latency, throughput and quality still meet the acceptance criteria |
| the model weight verification | `npm run models:verify` | the revision and the checksum still match |
| the evaluation benchmark | `npm run eval:run` | the score is not below the recorded baseline, on either language slice |
| the workforce consistency | the console → AI Employees → the registry check | `consistent` — 0 issues |
| the procedure coverage | the console → AI Employees → Procedures | every procedure still resolves its inputs |

---

## 5. The common incidents

### 5.1 The health check fails

```bash
curl -sS -i https://<host>/api/health | head -20
```

| Response | Cause | Action |
|---|---|---|
| a connection refused | the process is down | restart it; check the process manager's log |
| a 500 with a database error | the database | go to §5.2 |
| a 500 otherwise | the application | check the application log; roll back if it is the new release |
| a slow response | a saturated connection pool or a slow query | check the slow-query log; do **not** roll back first |

### 5.2 The database is unreachable

```bash
npm run db:verify
mysql -e "SELECT 1" "$DATABASE_URL"
```

| Symptom | Action |
|---|---|
| the database is down | the database service must be restored; the application will recover when it returns |
| the credentials are wrong | check the secret; the `prestart` gate would have caught it at deploy time |
| the connection limit is reached | check the pool size and the long-running transactions; a stuck job holding a transaction is the usual cause |
| the disk is full | free space; check the binary log and the slow-query log |

**Do not roll back the application for a database outage.** The code is
not the cause.

### 5.3 The model service is `DEGRADED`

| Cause | Action |
|---|---|
| the local model server is down | `systemctl status ollama`; restart it |
| the model is not pulled | `ollama pull <model>` |
| `AI_PROVIDER_ORDER` points at a server that is not running | fix the order, or fix the server |
| the remote provider is the only one configured | the platform works, but the data leaves the host. **That is a decision for a human, not a configuration change** |
| the gateway key is missing or short | `MODEL_API_KEY` must be at least 32 characters; without it `/api/model/v1/*` answers 503 |

### 5.4 The task queue is stuck

```sql
-- The jobs that are running.
SELECT id, taskType, agentCode, leaseUntil, updatedAt
FROM `AgentJob`
WHERE status = 'RUNNING' AND leaseUntil < NOW()
ORDER BY updatedAt;
```

| Symptom | Cause | Action |
|---|---|---|
| a `RUNNING` job with an expired lease | the worker died | the lease expires and the job is reclaimed automatically. Confirm the reclaim is happening; if not, restart the worker |
| many jobs in `RETRYING` | a systemic failure | look at `lastError`; fix the cause before the attempts are exhausted |
| many jobs in `AWAITING_APPROVAL` | the approval queue is not being worked | that is a **human** problem, not a technical one — see §5.5 |
| jobs in `QUEUED` with no worker | the worker pool is not running | start it; check the concurrency limit |

### 5.5 The approval queue is backed up

This is the one incident the platform will not solve on its own. The
approval is a **human** decision by design, and the learning engine
cannot grant one.

1. Open the console → **Approvals**.
2. Sort by age.
3. For each pending approval, read the evidence bundle the procedure
   attached: the assessment, the checks that passed and the checks that
   did not.
4. Decide: **approve** or **reject**, with a note.
5. If a class of approval keeps arriving, it is usually a procedure
   whose `requiresApproval` step fires on a routine case. That is a
   **procedure change**, and it goes through the learning chain with a
   human approval — never an edit to the approval logic.

### 5.6 An event is not being delivered

| Symptom | Cause | Action |
|---|---|---|
| the event is not in `AgentEvent` | the publisher never ran | check the publisher's correlation id in `/api/audit` |
| the event is in `AgentEvent` but no subscriber reacted | no subscriber is registered for that type | `listSubscriptions()` in `src/lib/events/bus.ts` shows the live registry |
| a subscriber threw | the bus isolates a subscriber failure | the failure is in the subscriber's own log; the publisher was not affected by design |

### 5.7 The backup failed

```bash
ls -la /var/backups/tech360/
sha256sum -c /var/backups/tech360/*.sha256
```

| Symptom | Action |
|---|---|
| no artefact | the backup job did not run; run it manually and fix the schedule |
| a checksum mismatch | the artefact is corrupt — **delete it and take a new one**. Never restore from a mismatched artefact |
| the dump succeeded but is empty | the database was already empty, or the credentials were wrong. Check the log |

**A backup that cannot be restored is not a backup.** If the restore
test fails, the release gate stays closed.

---

## 6. The daily operations loop

`src/lib/ops-loop.ts` runs the in-process operations cycle. It:

1. scans for work;
2. executes the actions in `src/lib/ops-actions.ts` — lead scoring, a
   follow-up draft, an alert, a task, a memory entry;
3. records the cycle.

| Control | Detail |
|---|---|
| the throttle | `MIN_CYCLE_INTERVAL_MS` is 45,000 ms — the loop cannot run more often than every 45 seconds |
| the driver | `AI_OPS_DRIVER=off` disables it without a restart |
| the honesty rule | every action reports its true outcome. A WhatsApp send with no credentials returns `NOT_CONFIGURED`, not a false success |
| the escalation | an action that fails escalates; it does not loop |

---

## 7. The escalation path

| Level | Who | What |
|---|---|---|
| 1 | the on-call engineer | a service is down, a queue is stuck, a model is degraded |
| 2 | the platform engineer | a migration problem, a data problem, a rollback |
| 3 | the Super Admin | an approval backlog, a governance question, a customer-facing incident |
| 4 | the owner | a policy change, a hosting change, a public release |

**The platform never escalates past a human on its own.** The
self-healing ladder ends at `ESCALATE_HUMAN` and stops.

---

## 8. The things an operator must never do

| Never | Why |
|---|---|
| run a `DROP`, a `TRUNCATE` or an unbounded `UPDATE` on a production table | the data is the record |
| delete a row from the audit trail | the audit is the evidence |
| set `AI_OPS_DRIVER` to something other than `off` to silence a failure | that hides the failure rather than fixing it |
| point the model service at a public endpoint | it would send company data off the host |
| grant a tool permission to make an error go away | the error is the control working |
| edit the `AgentJob` status by hand to "unstick" the queue | it breaks the lease and the idempotency guarantees; use the approval or the retry |
| change `AI_PROVIDER_ORDER` to route around a failing local model without a decision | it changes where the data goes |
| deploy without the pre-flight checklist | the environment gate and the migration drift check are what make a deploy safe |
| move the primary CRM or the website | it needs explicit authorisation from the owner |
