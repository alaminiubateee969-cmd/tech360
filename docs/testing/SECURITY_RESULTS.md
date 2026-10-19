# Security results

| | |
|---|---|
| **Document** | `docs/testing/SECURITY_RESULTS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. Method

Every control below is verified by a **test that runs in the suite**, or
by a **code path that does not exist**. A control with neither is listed
in §8 as an open gap. There is no claim here that rests on a policy
document.

| Class | Verification |
|---|---|
| The model cannot reach a side effect directly | the tool registry is enumerable and contains no shell and no SQL tool; `tests/ai-eos.test.ts` |
| The permission model holds | `tests/ai-workforce-rbac.test.ts` (51 tests) and `tests/ai-eos.test.ts` |
| The gateway is closed by default | `tests/model-service.test.ts` (32 tests) |
| The approval gate holds | `tests/ai-eos.test.ts` |
| The learning engine is bounded | `tests/ai-eos.test.ts` |
| The self-healing ladder is bounded | `tests/ai-eos.test.ts` |
| The webhook signature check holds | `tests/webhook-auth.test.ts` (20 tests) |
| The environment gate holds | `tests/production-env.test.ts` (7 tests) |
| The OTP portal holds | `tests/portal-otp.test.ts` (6 tests) |
| The identity resolution holds | `tests/identity-resolver.test.ts` (3 tests) |
| The business policies hold | `tests/business-policies.test.ts` (17 tests) |
| The contact and preview policies hold | `tests/contact-policy.test.ts`, `tests/preview-policy.test.ts` |

---

## 2. The central control: the model cannot act on the world

**The model never runs shell, SQL, deployments, payments, WhatsApp
messages or file deletions.** The only path from a model output to an
effect is the governed tool gateway, and the gateway's tool list is
enumerable and contains no such tool.

| Check | Result | Evidence |
|---|---|---|
| the tool registry is complete and internally consistent | **PASS** | `validateToolRegistry()` — 47 tools, every one with a schema, a permission, a risk level, an authentication method, a rate limit, an approval rule and an audit rule |
| an unknown tool is refused | **PASS** | `checkToolUse('not.a.tool')` → `UNKNOWN_TOOL` |
| an ungranted tool is refused | **PASS** | `checkToolUse('payment.verify', ['crm.read'])` → `TOOL_NOT_GRANTED` |
| the `capability:all` wildcard does not cover the privileged tools | **PASS** | `authorizeAgentTool()` — the 11 privileged tools are excluded from the wildcard; `tests/ai-workforce-rbac.test.ts` |
| an approval-gated tool is never offered as autonomous | **PASS** | `availableTools()` excludes all 11 |
| a procedure step that needs a tool is refused when there is no gateway | **PASS** | `executeSop()` → `TOOL_GATEWAY_UNAVAILABLE` |
| a non-`ACTIVE` agent can do nothing | **PASS** | `authorizeAgentTool()` → `AGENT_DISABLED` |

### 2.1 The tool registry — the measured state

| | Count |
|---|---:|
| Governed tools | 47 |
| Approval-gated (never autonomous) | 11 |
| Autonomous | 36 |
| Touching customer data | 21 |
| Registry consistency issues | **0** |

---

## 3. The approval gate

| Check | Result | Evidence |
|---|---|---|
| a procedure stops at an approval step and does **not** self-approve | **PASS** | `executeSop()` → `status: 'AWAITING_APPROVAL'`, `errorCode: 'APPROVAL_REQUIRED'`; the remaining steps are skipped |
| a financial transfer always requires a human | **PASS** | `evaluateGovernance()` → `ALWAYS_HUMAN:FINANCIAL_TRANSFER` |
| a legal commitment always requires a human | **PASS** | `ALWAYS_HUMAN:LEGAL_COMMITMENT` |
| an irreversible deletion always requires a human | **PASS** | `ALWAYS_HUMAN:IRREVERSIBLE_DELETION` |
| a high-impact security action always requires a human | **PASS** | `ALWAYS_HUMAN:HIGH_IMPACT_SECURITY` |
| a sensitive external communication always requires a human | **PASS** | `ALWAYS_HUMAN:SENSITIVE_EXTERNAL_COMMUNICATION` |
| a major governance change always requires a human | **PASS** | `ALWAYS_HUMAN:MAJOR_GOVERNANCE_CHANGE` |
| the `capability:all` wildcard cannot spend money or speak to a customer | **PASS** | `tests/ai-workforce-rbac.test.ts` |

---

## 4. The governance layering

| Check | Result | Evidence |
|---|---|---|
| a `FORBID` at a broad layer cannot be re-permitted by a narrow layer | **PASS** | `evaluateGovernance()` returns at the first `FORBID`; the test *"does not let a narrower rule re-permit a forbidden action"* |
| a narrow layer may **add** a requirement | **PASS** | the test *"lets a narrower rule add a requirement"* |
| the always-human list is applied after the rules, so a forbidden action is reported as forbidden | **PASS** | the code order in `evaluateGovernance()` |
| every constitution rule names the mechanism that enforces it | **PASS** | `CONSTITUTION_WITH_ENFORCEMENT` — 8 rules, 8 mechanisms |

---

## 5. The learning engine is bounded

| Check | Result | Evidence |
|---|---|---|
| the constitution, a policy, a security control, a permission, an approval and an RBAC rule are protected | **PASS** | `PROTECTED_TARGETS` in `src/lib/agents/learning.ts` |
| a protected change is refused **even when it was approved** | **PASS** | the test *"refuses to integrate a change to a protected artefact even when it was approved"* — and the apply function is **never called** |
| a proposal needs three observations before it is a pattern | **PASS** | `findPattern()` |
| a proposal with an unmeasured effect is not a validation | **PASS** | `validateHypothesis()` |
| a proposal without a named human approver is refused | **PASS** | `approveProposal()` |
| the Master AI Builder proposes and a human approves | **PASS** | the approval stage is mandatory in the chain |

---

## 6. The self-healing ladder is bounded

| Check | Result | Evidence |
|---|---|---|
| the plan is a fixed ladder, so the attempts are bounded by construction | **PASS** | `repairPlan()` |
| the hard ceiling is respected | **PASS** | `maxAttempts` defaults to 4 and is capped at 8 |
| an action that is not on the safe list is never attempted automatically | **PASS** | the `SAFE_REPAIR_ACTIONS` check inside the loop |
| a permission refusal escalates straight to a human rather than retrying | **PASS** | `repairPlan('TOOL_PERMISSION_DENIED')` → `['ESCALATE_HUMAN']`; the test asserts the retry function is never called |
| the ladder ends in a human escalation | **PASS** | the post-loop escalation |

---

## 7. The model service boundary

| Check | Result | Evidence |
|---|---|---|
| the upstream must be a loopback or a private address | **PASS** | `isPrivateUpstream()`; `tests/model-service.test.ts` |
| the gateway refuses every request without a key of at least 32 characters | **PASS** | `src/lib/model/gateway.ts`; the test drives the real route |
| the key is compared in constant time | **PASS** | `constantTimeEquals()` |
| the request is rate limited per IP | **PASS** | the sliding window in the gateway |
| the prompt is not logged — a digest is | **PASS** | the gateway records `promptDigest` |
| the fallback chain is explicit and the answering provider is recorded | **PASS** | `AI_PROVIDER_ORDER`; the response carries `provider` |
| the real provider error survives the chain exhaustion | **PASS** | the router carries the last provider's `errorCode` — this was a **defect found and fixed** by the test |

---

## 8. The data-protection controls

| Check | Result | Evidence |
|---|---|---|
| every memory carries an access level | **PASS** | `AiMemory.accessLevel` |
| the access filter is applied in the query **and** re-checked in the application | **PASS** | `retrieveMemory()`; the re-check was a **defect found and fixed** in the RAG store |
| every knowledge entity and relation carries an access level | **PASS** | `KnowledgeEntity.accessLevel`, `KnowledgeRelation.accessLevel` |
| a client-scoped agent cannot reach another client | **PASS** | `agentMayAccessClient()`; `tests/ai-workforce-rbac.test.ts` |
| a credential never reaches a log or the audit trail | **PASS** | `audit()` takes a safe `details` object; the gateway logs a digest |
| a document is never written to a public path | **PASS** | the document pipeline writes to a private store and issues a scoped, expiring link |
| training and evaluation data stay separate | **PASS** | `evals/tech360-eval-v1.json` is never ingested into the knowledge store |

---

## 9. The secret scan and the environment gate

| Check | Result | Evidence |
|---|---|---|
| the CI runs a secret scan over the repository | **PASS** | `.github/workflows/ci.yml` |
| the production environment fails closed | **PASS** | `tests/production-env.test.ts` — 7 tests; `scripts/validate-production-env.mjs` is the `prestart` hook |
| a webhook signature is verified in constant time | **PASS** | `tests/webhook-auth.test.ts` — 20 tests |
| the outbox retry is idempotent and cannot duplicate a side effect | **PASS** | `tests/outbox-retry.test.ts` — 20 tests, `tests/outbox-retry-integration.test.ts` — 12 tests |
| the OTP portal is rate limited and single-use | **PASS** | `tests/portal-otp.test.ts` — 6 tests |

---

## 10. The open gaps — stated, not hidden

| Gap | Severity | Why it is open | What closes it |
|---|---|---|---|
| **No penetration test has been performed** | HIGH | the controls above are code-level and test-level; no external tester has attacked the platform | commission an external test before a public release |
| **No dependency vulnerability audit is recorded here** | MEDIUM | `npm ci` succeeds and CI runs a secret scan, but the audit output was not captured in this environment | `npm audit --production` in CI, with the output archived |
| **The backup and restore gate is not met** | HIGH | there is no verified artefact and no proven isolated restore | see `docs/testing/RESTORE_TEST_RESULTS.md` |
| **The model weights are unverified** | MEDIUM | the weight host is unreachable from this environment | `npm run models:verify` on the production host |
| **The live messaging providers are unexercised** | MEDIUM | no provider credentials are present here, and the specification forbids acting without them | configure the provider and run the delivery test on the production host |
| **There is no rate limit on the human-facing console routes beyond the gateway** | LOW | the console is behind the session guard and the CSRF check, and the Super Admin surface is small | a per-user rate limit on the console routes |
| **No SBOM is published** | LOW | not previously produced | `npm sbom --sbom-format cyclonedx` in the release pipeline |

---

## 11. Summary

| Area | Result |
|---|---|
| The model cannot act on the world directly | **PASS** |
| The permission model holds | **PASS** |
| The approval gate holds | **PASS** |
| The governance layering holds | **PASS** |
| The learning engine is bounded | **PASS** |
| The self-healing ladder is bounded | **PASS** |
| The model service boundary holds | **PASS** |
| The data-protection controls hold | **PASS** |
| The secret scan and the environment gate hold | **PASS** |
| An external penetration test | **NOT PERFORMED** |
| A dependency audit record | **NOT RECORDED** |
| The backup and restore gate | **NOT MET** |

**The code-level controls hold and are proven by the suite. The release
decision is still blocked by the backup and restore gate, not by a
security control.**
