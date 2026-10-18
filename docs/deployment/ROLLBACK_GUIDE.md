# Rollback guide

| | |
|---|---|
| **Document** | `docs/deployment/ROLLBACK_GUIDE.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. The rollback is cheap, and that is by design

The AI-EOS work was built so that it could be undone without touching
the CRM.

| Fact | Why the rollback is safe |
|---|---|
| every migration statement is **additive** | there is nothing to undo in the database. The new tables and columns can simply be left in place — the old code ignores them |
| the old code does not know about the new tables | a rollback is a **code** rollback, not a schema rollback |
| the new routes are **new paths** | `git checkout` of the previous commit removes them; no existing route changes |
| no existing route, port or domain was changed | the CRM and the website are untouched |
| the new tables hold only their own data | dropping them, if ever needed, is optional and isolated |

**The normal rollback is: check out the previous commit and redeploy.**
No database restore is required, because no existing data was modified.

---

## 2. Before you need it

These three things must be true **before** a release, not during an
incident.

```bash
# 1. The commit that is deployed, recorded.
git rev-parse HEAD | tee release-commit.txt

# 2. The commit to roll back to, chosen and written down.
git log --oneline -10
# → write the target SHA into release-rollback-target.txt

# 3. The migration state, recorded.
npx prisma migrate status | tee release-migrate-status.txt
```

**The rollback target is the commit before the release.** It is chosen
while things are calm, not while they are on fire.

---

## 3. The rollback decision

| Signal | Action |
|---|---|
| the health check fails | roll back immediately |
| the error rate on a new route is above the baseline | roll back the new route; the rest of the platform is unaffected |
| the database is unreachable | **do not roll back first.** Check the database and the connection pool. A code rollback will not fix a database outage |
| a migration failed | see §6 — a migration failure is different from a code failure |
| a security incident in the new code | roll back **and** follow the incident process; the audit trail is preserved either way |

---

## 4. The code rollback

```bash
# 1. Stop the application.
#    (On the host, the process manager: systemctl stop tech360
#     or pm2 stop tech360 — whichever the host uses.)

# 2. Move to the rollback target.
cd /path/to/tech360
git fetch --all
git checkout "$(cat release-rollback-target.txt)"

# 3. Rebuild and restart.
npm ci --no-audit --no-fund
npm run build
npm start &

# 4. Verify.
curl -fsS https://<host>/api/health
curl -fsS https://<host>/api/health/deep
```

### 4.1 The time it takes

| Step | Typical |
|---|---|
| `git checkout` | seconds |
| `npm ci` | ~30 s (850 packages) |
| `npm run build` | the dominant cost — minutes on a 2-vCPU host |
| `npm start` | seconds |
| the health check | seconds |

**Keep the previous build's `.next` directory** so the rollback is a
directory swap rather than a rebuild. On a host that builds in CI, ship
the artefact and swap it — that is the fastest path.

---

## 5. The database rollback

### 5.1 The normal case: nothing to do

Because every statement is additive, the previous code works against the
new schema. The new tables and columns are simply unused.

**Leave them in place.** Dropping them would be a destructive act with
no benefit, and it would destroy the execution, event, delegation and
procedure records that the release produced.

### 5.2 The optional cleanup

Only if the new tables must go, and only with an explicit approval —
this is a destructive migration.

```sql
-- Take a backup FIRST. See docs/testing/RESTORE_TEST_RESULTS.md §7.
-- Then, in this order (the FKs require it):
DROP TABLE IF EXISTS `KnowledgeRelation`;
DROP TABLE IF EXISTS `KnowledgeEntity`;
DROP TABLE IF EXISTS `AgentEvent`;
DROP TABLE IF EXISTS `AgentDelegation`;
DROP TABLE IF EXISTS `SopRun`;
DROP TABLE IF EXISTS `Sop`;
DROP TABLE IF EXISTS `WorkflowDefinition`;
DROP TABLE IF EXISTS `ModelDeployment`;
DROP TABLE IF EXISTS `KnowledgeIngestRecord`;
DROP TABLE IF EXISTS `KnowledgeChunk`;
DROP TABLE IF EXISTS `SkillRun`;
DROP TABLE IF EXISTS `SkillVersion`;
DROP TABLE IF EXISTS `Skill`;

-- The altered tables: the columns are left in place, because dropping a
-- column that the old code does not know about buys nothing.
-- ALTER TABLE `AgentJob` MODIFY COLUMN `agentCode` VARCHAR(191) NOT NULL;
--   ^ NOT SAFE while any job has a NULL agentCode. Check first:
SELECT COUNT(*) FROM `AgentJob` WHERE `agentCode` IS NULL;
-- Only if that count is 0.
```

**Do not run the `ALTER TABLE` above without checking the count.** It is
listed commented out for exactly that reason.

---

## 6. When the migration itself failed

| Situation | Action |
|---|---|
| the migration failed **before** it applied anything | the schema is unchanged. Fix the script, re-run `npx prisma migrate deploy` |
| the migration applied **partially** | MySQL DDL is not transactional. Inspect the actual state: `npx prisma migrate status` and `SHOW TABLES`. Then apply the remaining statements by hand, or restore from the backup |
| the migration applied fully but the application misbehaves | this is a **code** rollback (§4), not a schema rollback. The new schema is backward compatible |

Because the migration history is recorded in `_prisma_migrations`, a
partially applied migration must be marked as failed before it can be
re-applied. `npx prisma migrate resolve --applied <migration>` or
`--rolled-back` records the decision explicitly — never edit the table
by hand.

---

## 7. What is **not** rolled back

| Item | Why |
|---|---|
| the audit trail | the audit is the evidence of what happened, including during the incident. It is never deleted |
| the `AgentEvent` records | they are the event bus history |
| the `SopRun` records | they are the procedure execution history |
| the `AgentDelegation` records | they are the collaboration history |
| the `AiMemory` rows | a memory written during the new release may be referenced by a surviving run |
| the knowledge graph | the structural entities are derived from the registries and can be rebuilt with one POST |

If a specific memory, event or run must be withdrawn, it is withdrawn
**individually, with an audit record**, not by dropping a table.

---

## 8. The verification after a rollback

| Check | Expectation |
|---|---|
| `git rev-parse HEAD` | the rollback target SHA |
| `curl /api/health` | 200 |
| `curl /api/health/deep` | 200, the database reachable |
| the CRM: a lead list, a client detail | the data is intact and the pages render |
| the website | the public site is unaffected — it was never touched |
| `npx prisma migrate status` | up to date (the new tables are still there; that is expected) |
| the console: the sign-in and the dashboard | they render |
| the approvals queue | the pending approvals are still pending — **they are not lost by a rollback** |

**The last row matters.** A rollback of the code does not cancel the
approvals that were raised. If the approval queue is the problem, the
correct action is to decide each pending approval, not to roll back.

---

## 9. The rollback rehearsal

A rollback plan that has never been rehearsed is a guess. Before the
first public release, and after every significant release, rehearse it:

1. deploy the new commit to staging;
2. note the health and the error rate;
3. execute §4 against staging;
4. confirm the health check passes and the CRM still works;
5. **record the elapsed time** — that is the real rollback window;
6. deploy forward again.

The measured window is what goes in the incident runbook.
