# Security and backup status — tech360

| Field | Value |
| --- | --- |
| Reviewed | 2026-10-18 |
| Base commit | `889941e` (pre-engagement) |
| Verified against | `b9918af` (post-engagement) |
| Access level | Internal — engineering and audit |
| Version | 1.0.0 |
| Retention | Retained for the life of the platform, then archived with the audit record |
| Permission scope | Read-only for the auditor |

---

## 1. Security posture — summary

| Area | State | Evidence |
| --- | --- | --- |
| Session authentication | WORKING | `src/lib/api-guard.ts` — session cookie + `guard()` on every admin route |
| CSRF | WORKING | `x-csrf-token` echo of the `t360_csrf` cookie; required on every non-GET |
| RBAC | WORKING | `src/lib/ai-workforce-policy.ts` — a filesystem-walking test fails the build if a new route is not covered |
| Secret comparison | WORKING | `src/lib/constant-time.ts` — `constantTimeEquals`, 5 tests including a Unicode same-length case |
| Rate limiting | WORKING | `src/lib/security.ts` `rateLimit`, per-IP |
| Audit trail | WORKING | `audit()` on every sensitive action; `GET /api/audit` |
| File scanning | WORKING | `src/lib/files.ts` — deterministic scanner; a flagged file is quarantined and never indexed |
| Secret scanning in CI | WORKING | `.github/workflows/ci.yml` — a secret-scan step runs on every push |
| Production environment fail-closed | WORKING | `tests/production-env.test.ts` |
| Webhook replay protection | WORKING | `tests/webhook-auth.test.ts` |
| Private model gateway authentication | WORKING *(new)* | `src/lib/model/gateway.ts` — constant-time bearer check, ≥32-char key, fail-closed 503 |
| SSRF guard on model upstreams | WORKING *(new)* | `isPrivateUpstream()` in both providers |
| Prompt confidentiality in the gateway | WORKING *(new)* | the gateway stores a SHA-256 prompt **digest**, never the raw prompt |
| Vector-store access isolation | WORKING *(new)* | `src/lib/rag/store.ts` — filtered in the query and re-checked in the application |
| Student-record isolation | WORKING *(new)* | the ingest path refuses `PUBLIC` for a student record |
| Model executes shell / SQL / deploy / payment / WhatsApp / file deletion | **NEVER** | the model emits a *tool request*; only the trusted tool gateway can act, and every risky action is approval-gated |
| Ollama / Redis / Qdrant / MySQL exposed publicly | **NOT EXPOSED** | no public binding; the gateway only accepts private upstreams |
| 2,000 simultaneous model processes | **NOT DONE** | one bounded worker pool over one durable queue |

## 2. The tool-gateway invariant

> **The model never performs a side effect.**

The execution path is:

```
auth → authz → intent → agent select → policy → retrieve → infer
     → structured tool request → permission validation → approval
     → execute → validate → audit → respond
```

The model is called at the `infer` step and returns a **structured tool request**. From that point on
the runtime — not the model — decides what happens:

| Step | Where | What it guarantees |
| --- | --- | --- |
| structured tool request | `src/lib/agents/engine.ts` | The model returns JSON with a named tool and typed arguments. Free text is rejected. |
| permission validation | `src/lib/agents/job-policy.ts`, `src/lib/ai-workforce-policy.ts` | The tool and each argument are checked against the agent's declared permissions. |
| approval | `src/app/api/admin/approvals/[id]/decision/route.ts` | A payment instruction, a refund, a final scope send, a source handover and a public post require an explicit administrator approval. The approval is claimed atomically, so a concurrent second decision cannot execute it twice. |
| execute | the tool gateway | The tool performs the action under the operator's identity, not the model's. |
| validate | `src/lib/agents/engine.ts` | The result is checked before it is returned. |
| audit | `src/lib/security.ts` | `AGENT_JOB_CLAIMED`, `APPROVAL_APPROVED_EXECUTED`, `SKILL_EXECUTED` and the rest are written with a correlation id. |

**The skill engine follows the same rule.** A skill is a pure capability: it validates its input
against the declared schema, runs a bounded deterministic handler, validates its output against the
declared output schema, and records the run. It has no side effect at all. Anything that reaches a
customer — a message, a payment, a publication, a deletion — goes through the approval-gated tool
gateway instead.

## 3. The private model gateway

`src/lib/model/gateway.ts` is the machine-to-machine surface for the private model service. It is
deliberately NOT the browser session path.

| Control | Implementation | Test |
| --- | --- | --- |
| Bearer authentication | `constantTimeEquals` against `MODEL_API_KEY` | `tests/model-service.test.ts` |
| Fail closed | A missing or shorter-than-32-character key returns 503 and the gateway stays off | `tests/model-service.test.ts` |
| Per-IP rate limit | sliding window, per IP | `tests/model-service.test.ts` |
| Private upstreams only | `isPrivateUpstream()` refuses a non-private address before any request | `tests/model-service.test.ts` |
| Prompt confidentiality | the audit record stores a SHA-256 digest, not the prompt | `tests/model-service.test.ts` |
| Audited | every call is written with a correlation id | `tests/model-service.test.ts` |
| No public exposure | the Ollama and OpenAI-compatible providers only accept a loopback or RFC1918 upstream | `src/lib/model/providers/*` |

`tests/api-contracts.test.ts` additionally asserts, statically, that every private model route
authenticates **before** it does any work, and that the gateway does not use the browser session
guard.

## 4. Findings and their disposition

| # | Finding | Severity | State | Evidence |
| --- | --- | --- | --- | --- |
| S1 | The model could have been given a direct shell, SQL or payment capability | Critical | **Prevented by design** | The model emits a tool request; `src/lib/ai-workforce-policy.ts` restricts the tool set and the permissions behind it. |
| S2 | A skill could be registered with no implementation and be counted as working | High | **RESOLVED** | `validateSkillDefinition`, `activateSkill` and `skillOperationalStatus` all refuse it. `tests/skills-registry.test.ts`. |
| S3 | A skill could be executed by a caller who did not hold its permissions | High | **Prevented by design** | `checkPermissions` in `src/lib/skills/executor.ts`; a missing permission is a refusal, not a warning. `tests/skills-registry.test.ts`. |
| S4 | The vector store's access filter relied only on the database `WHERE` clause | High | **RESOLVED** | The filter is re-checked in the application. `tests/rag-pipeline.test.ts`. |
| S5 | A student record could be ingested into a shared public index | High | **RESOLVED** | The ingest path refuses it and indexes nothing. `tests/rag-pipeline.test.ts`. |
| S6 | The model gateway could have been left open by default | Critical | **Prevented by design** | The gateway is off unless `MODEL_API_KEY` is set to at least 32 characters. `tests/model-service.test.ts`. |
| S7 | A prompt could be logged verbatim, leaking student data into the audit trail | Medium | **RESOLVED** | The gateway stores a digest. |
| S8 | A model upstream could have been pointed at a public address, turning the private service into an open proxy | High | **Prevented by design** | `isPrivateUpstream()`. |
| S9 | The approval decision could have been executed twice by a concurrent request | High | **Prevented by design** | The approval is claimed with a conditional `updateMany`; a second decision gets 409. |
| S10 | The private model API could have been reachable from the browser session | Medium | **Prevented by design** | It uses a bearer key, not the session cookie. |
| S11 | `alolabs_AI` code could have been copied into the platform | High | **Prevented by design** | That project has no LICENSE file. Its architecture was read; **no code was copied**. Every file in this engagement was written in this repository. |
| S12 | 2,000 model processes could have been started | Medium | **Avoided** | One bounded worker pool (`concurrency` ≤ 8) over one durable queue. |
| S13 | The existing RBAC policy could have been bypassed by a new route | High | **Prevented by design** | `tests/ai-workforce-rbac.test.ts` walks the filesystem and fails the build on an unprotected route. |
| S14 | Production could have started with a missing or weak secret | High | **Prevented by design** | `tests/production-env.test.ts` and the `prestart` fail-closed check. |

**No open high or critical finding remains.** The open items are in §7.

## 5. Backup status — the honest position

> **A backup that has never been restored is not a backup.**

| Question | Answer | Evidence |
| --- | --- | --- |
| Does the platform take backups? | **UNVERIFIED in this environment.** | The legacy `deployment/backup.sh` helper and the Caddyfile exist; the backup helpers carry retirement notices because the Cloud Run deployment path was retired. |
| Is there a verified backup artefact on this host? | **NO** | The new **Backup and Recovery** console page reads the configured backup directories and reports `NO_ARTIFACTS` when there is nothing there. It does not claim a backup on the strength of a configuration value. |
| Has a restore ever been proven? | **NO** | The page reports `restoreEvidence.proven === false` and states that the restore test must be run before any production release. |
| Is there a recorded restore test? | **Not yet** | The `backup.restore_test` setting is the record; the restore procedure is in `docs/deployment/OPERATIONS_RUNBOOK.md` §7 and the evidence form is in `docs/testing/RESTORE_TEST_RESULTS.md`. |

**This is the single most important open item in this audit.** The specification's release gate —
"no public release until a usable backup is verified, an isolated restore is tested, destructive
migrations are inspected, the current deployed commit is recorded, a rollback plan is created and the
existing websites and ports are preserved" — is **NOT met**, and the console says so on its face.

## 6. The release gate, item by item

| Gate | State | Evidence |
| --- | --- | --- |
| A usable backup is verified | **NOT MET** | See §5. |
| An isolated restore is tested | **NOT MET** | See §5. |
| Destructive migrations are inspected | **MET** | `docs/audit/DATABASE_AND_MIGRATION_REVIEW.md` §5 — every statement in migration 8 is additive except one nullability change. |
| The current deployed commit is recorded | **NOT MET in this environment** | No deployment is reachable from this sandbox. The procedure is in `docs/deployment/DEPLOYMENT_GUIDE.md` §2. |
| A rollback plan is created | **MET** | `docs/deployment/ROLLBACK_GUIDE.md`. |
| Existing websites and ports are preserved | **MET by design** | No hosting was moved. The CRM and the website stay where they are; the private model service is an addition on the existing host, and the gateway refuses to bind anything but a private upstream. |

**Conclusion: the platform is ready for a staged release onto a staging host. It is NOT ready for a
public production release, and the reason is the backup and restore evidence, not the code.**

## 7. Open items

| # | Item | Severity | Owner | Trigger to close |
| --- | --- | --- | --- | --- |
| O1 | Prove a backup and a restore on the production host | **High** | Platform owner | Run the restore test in `docs/deployment/OPERATIONS_RUNBOOK.md` §7 and record the result in `docs/testing/RESTORE_TEST_RESULTS.md`. |
| O2 | Verify the model weights and record the revision + checksum | Medium | Platform owner | `npm run models:verify -- --manifest-dir=<ollama manifests>` on the host, then `ModelDeployment`. |
| O3 | Run the real CPU benchmark | Medium | Platform owner | `npm run bench:models -- --model=<model>` on a 16–32 GB host. |
| O4 | Point the evaluation harness at a live model | Medium | Platform owner | `npm run eval:run -- --base-url=… --api-key=…` on the host. |
| O5 | Install `bun` and verify the two sidecars | Low | Platform owner | `bun install && bun run mini-services/ai-ops` on the host. |
| O6 | Decide the LoRA question | Low | Platform owner | After O2 and O3 produce real numbers. |
| O7 | Configure the outbound channels with real credentials | Low | Platform owner | Credential rotation is a production action and needs explicit authorisation. |

Every one of these needs the **production host** and, where it touches credentials or a deployment,
**explicit human authorisation**. None of them was attempted in this engagement.
