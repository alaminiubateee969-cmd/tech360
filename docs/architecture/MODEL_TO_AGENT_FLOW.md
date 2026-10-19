# Model to agent flow — how a task becomes an answer

| | |
|---|---|
| **Document** | `docs/architecture/MODEL_TO_AGENT_FLOW.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

---

## 1. The chain, end to end

A request that arrives at the console, at `/api/ai/chat`, at
`/api/command`, or through the mobile app follows exactly one path. The
order is not a convention — it is the order of the code.

```
  request
    │
    ▼
 1. AUTHENTICATION          session cookie + CSRF + role
    │                       src/lib/api-guard.ts → guard()
    ▼
 2. AUTHORISATION           the tool and the data the caller may reach
    │                       src/lib/ai-workforce-policy.ts
    ▼
 3. AGENT RESOLUTION        which employee owns this work
    │                       src/lib/agents/workforce.ts
    ▼
 4. IDENTITY                the 24 attributes of that employee
    │                       src/lib/agents/org.ts
    ▼
 5. DEPARTMENT CONTEXT      the department's own rules
    │                       src/lib/agents/context.ts
    ▼
 6. CONSTITUTION            the global, non-negotiable rules
    │                       src/lib/agents/registry.ts
    ▼
 7. PERMISSIONS             the layered governance decision
    │                       src/lib/governance/rules.ts
    ▼
 8. TASK CLASSIFICATION     what kind of work is this?
    │                       src/lib/agents/orchestrator.ts → classifyTask()
    ▼
 9. COMPLEXITY              SIMPLE | STANDARD | COMPLEX | ENTERPRISE
    │
    ▼
10. SKILL SELECTION         the capability that does the work
    │                       src/lib/skills/registry.ts
    ▼
11. PROMPT SELECTION        the retrieved, specialised prompt
    │                       src/lib/prompts/retrieval.ts
    ▼
12. SOP SELECTION           the procedure the work follows
    │                       src/lib/sops/library.ts
    ▼
13. MEMORY RETRIEVAL        the relevant, permitted memories
    │                       src/lib/memory/system.ts
    ▼
14. KNOWLEDGE RETRIEVAL     the grounded passages
    │                       src/lib/rag/pipeline.ts
    ▼
15. KNOWLEDGE GRAPH         the neighbourhood of the subject
    │                       src/lib/knowledge/graph.ts
    ▼
16. TOOL SELECTION          the authorised tools only
    │                       src/lib/tools/registry.ts
    ▼
17. MODEL SELECTION         which model, and why
    │                       src/lib/model/hub.ts → routeToModel()
    ▼
18. PLAN                    the steps, the order, the parallelism
    │                       src/lib/agents/orchestrator.ts
    ▼
19. EXECUTE                 the run, on the one durable queue
    │                       src/lib/agents/engine.ts / executeSkill() / executeSop()
    ▼
20. OBSERVE                 the transcript, the tool results, the timings
    │
    ▼
21. VALIDATE                worker → reviewer → validator
    │                       src/lib/agents/quality.ts
    ▼
22. REFLECT                 for complex tasks only
    │                       src/lib/agents/reflection.ts
    ▼
23. RESULT                  the structured output
    │
    ▼
24. MEMORY UPDATE           what is worth remembering
    │                       src/lib/memory/system.ts → writeMemory()
    ▼
25. AUDIT                   the record of what happened
                            src/lib/security.ts → audit()
```

---

## 2. Steps 1–2: the request boundary

`guard()` (`src/lib/api-guard.ts`) resolves the session, checks the CSRF
token on a write, and resolves the caller's role. It returns either a
`GuardedContext` or a `Response` — the pattern is `if (isResponse(g))
return g`, so no route can forget the check.

`authorizeAgentTool()` (`src/lib/ai-workforce-policy.ts`) is the
least-privilege check for a tool invocation:

- an unknown tool → `UNKNOWN_TOOL`;
- a non-`ACTIVE` agent → `AGENT_DISABLED`;
- a tool not on the agent's list → `TOOL_NOT_GRANTED`;
- the `capability:all` wildcard **deliberately does not cover** the 11
  privileged tools (`payment.*`, `invoice.generate`, `handover.*`,
  `delivery.confirm`, `sms.send`, `email.send`, `whatsapp.send`,
  `social.publish`, `agent.create`). A wildcard must not be able to
  spend money or speak to a customer.

`agentMayAccessClient()` is the tenant-isolation check: an agent acting
for one client cannot read another client's records unless it carries
`read:all`.

---

## 3. Steps 3–6: identity

An employee is not a prompt. `EmployeeProfile` carries 24 attributes:

| Group | Attributes |
|---|---|
| Identity | `employeeId`, `name`, `role`, `level`, `levelName` |
| Placement | `departmentCode`, `departmentName`, `divisionCode`, `divisionName` |
| Reporting | `managerEmployeeId`, `reportingPath[]` |
| Purpose | `mission`, `responsibilities[]`, `authority` |
| Rights | `decisionRights.{mayDecide, mayRecommend, mustEscalate}``[]` |
| Capability | `tools[]`, `skills[]`, `promptStages[]`, `sops[]` |
| Knowledge | `knowledgeAccess[]` |
| Memory | `memoryScopes[]` |
| Performance | `kpis[]` |
| Boundaries | `escalationRules[]`, `collaborationRules[]`, `behavioralConstraints[]` |
| Security | `securityPermissions[]` |
| Learning | `learningProfile.{learnsFrom, teaches, reviewCadence}` |

`tests/ai-eos.test.ts` → `validateWorkforce()` asserts that **every one
of the 2,201 employees has all of them**, and that no employee's manager
is missing from the workforce. It currently returns zero issues.

---

## 4. Steps 8–9: classification and the four paths

`classifyTask()` produces the task type, the complexity and the path.

| Signal | Effect |
|---|---|
| Question words, a lookup, a short noun phrase | `FAST` |
| A task that needs several capabilities | `STANDARD` |
| A strategy, a plan, a multi-part request | `COMPLEX` |
| Work that spans the organisation | `ENTERPRISE` |
| `requiresApproval` | the path is raised — never `FAST` |

`buildOrchestrationPlan()` then produces the steps. For `ENTERPRISE` the
plan fans out: several research steps **in parallel**, then a synthesis
step, then a review step, then an executive result. For `FAST` the plan
is a single step.

---

## 5. Steps 10–16: assembling the work

### 5.1 Skills

`discoverSkills()` selects the capability. Each of the 10,010 skills
declares its input schema, its output schema, its permissions, its
handler, its owning department and its quality rules. The **exhaustive**
test in `tests/skills-registry.test.ts` executes every one of them and
validates the output against the declared schema — that is the evidence
behind the "tested" count.

### 5.2 Prompts

See `SYSTEM_ARCHITECTURE.md` §4.1 for the scoring rule. The key property:
the retriever materialises **one** (department, role) binding and scores
it. The 70,400-slot library is never in memory at once.

### 5.3 Procedures

`executeSop()` walks the procedure:

1. check the required inputs — a missing input is `MISSING_INPUTS`, not a
   guess;
2. for each step, in order:
   - a **skill** step runs through the one skill executor, with the
     skill's permissions checked against the caller's grants;
   - a **tool** step requires the governed tool gateway. Without one the
     step is refused with `TOOL_GATEWAY_UNAVAILABLE` — the model cannot
     reach a side effect by itself;
   - an **approval** step stops the run with `AWAITING_APPROVAL` and
     `APPROVAL_REQUIRED`. The procedure never self-approves;
   - an **advisory** step is recorded and skipped;
3. a **decision point** is resolved from the accumulated context. An
   `UNDETERMINED` answer takes the `otherwise` branch, which is the safe
   branch;
4. the procedure's declared **validation** is reported honestly — a check
   that did not pass is reported as failed;
5. the run is persisted to `SopRun` and audited.

A decision point whose question is about a human decision
(`source: 'APPROVAL'`) is answered by the recorded approval state, not
by a checklist.

### 5.4 Memory

`retrieveMemory()` returns at most `MEMORY_RETRIEVAL_CAP` (25) records.
The access filter is applied **in the query and again in the
application**, so a change to the query can never widen what a caller
sees. A memory that has not been validated is returned but marked
`(not validated)` in the context, so the model cannot present it as
established fact.

### 5.5 Knowledge

`searchGrounded()` in `src/lib/rag/pipeline.ts` returns the passages and
their provenance. When the evidence does not support an answer the
pipeline says so rather than inventing one. The knowledge graph adds
the neighbourhood: entities and the relations between them, each with an
access level and a confidence.

### 5.6 Tools

`availableTools(permissions)` returns the tools the employee may call,
with the approval-gated ones excluded from the autonomous set. The
context section names the tool, its risk level and whether it needs
approval, so the model knows what it may ask for.

---

## 6. Step 17: model selection

`routeToModel()` in `src/lib/model/hub.ts` scores every catalogue entry
against the request:

| Signal | How it is used |
|---|---|
| Task type | the category profile list — a coding task is not served by the fast profile |
| Complexity | a floor: `COMPLEX` and `ENTERPRISE` cannot go to `cpu_fast` |
| Context length | a model whose context window is smaller is penalised |
| Language | a model that does not support the requested language is penalised |
| Structured output / tool selection / grounding | the catalogue's acceptance criteria decide whether the model may serve that kind of request |
| Latency budget | **measured** first-token latency, or a note that it was never measured |
| Quality floor | **measured** quality, or a note that it was never measured |
| Cost | **measured** cost per 1,000 tokens, or a note that it was never measured |
| Licence and weight verification | an unverified licence is penalised heavily; unverified weights are noted |

A model that is not installed on the host is never selected. When
nothing is installed the decision is still made from the catalogue
criteria, and the reason says plainly that the result is **UNVERIFIED
here**.

---

## 7. Steps 19–21: execution, observation, validation

`runQualityChain()` decides the chain depth from complexity and risk:

| Complexity / risk | Chain |
|---|---|
| `SIMPLE` + `LOW` | worker |
| `STANDARD`, or any `MEDIUM` risk | worker → reviewer |
| `COMPLEX`, `ENTERPRISE`, or `HIGH`/`CRITICAL` risk | worker → reviewer → validator |

The chain **stops at the first failing stage**. A review with no
criteria scores **0**, not 1: an empty review is not a pass. A blocking
criterion that fails stops the chain regardless of the average.

---

## 8. Steps 22–25: reflection, memory, audit

`shouldReflect()` decides whether a task warrants a reflection:

- it failed → reflect (there is something to learn);
- it escalated → reflect (the boundary was reached);
- it is `HIGH`/`CRITICAL` risk → reflect;
- it is `COMPLEX`/`ENTERPRISE` → reflect;
- otherwise → **do not** reflect.

A reflection is stored as a `WORKING` memory: it exists and is
retrievable, and it is explicitly **not validated**. The learning engine
is what turns it into a validated lesson, and only after a human
approves the change.

`writeMemory()` bumps the version, records the source, the correlation id
and the expiry, and audits the write. `audit()` records the actor, the
action, the entity and the safe details — never a credential, never a
raw prompt.

---

## 9. Where a task can be stopped

| Stop | Error code | Where it is decided |
|---|---|---|
| Unauthenticated | `UNAUTHENTICATED` | `guard()` |
| Wrong role | `FORBIDDEN` | `guard()` |
| Tool not granted | `TOOL_NOT_GRANTED` | `authorizeAgentTool()` |
| Action needs a human | `AWAITING_APPROVAL` / `ALWAYS_HUMAN:*` | `evaluateGovernance()` |
| Missing procedure input | `MISSING_INPUTS` | `executeSop()` |
| Tool step with no gateway | `TOOL_GATEWAY_UNAVAILABLE` | `executeSop()` |
| Approval step reached | `APPROVAL_REQUIRED` | `executeSop()` |
| Skill schema rejected | `SKILL_INPUT_INVALID` | `executeSkill()` |
| Skill output invalid | `SKILL_OUTPUT_INVALID` | `executeSkill()` |
| Review failed | `QUALITY_REVIEW_FAILED` | `runQualityChain()` |
| Validation failed | `QUALITY_VALIDATION_FAILED` | `runQualityChain()` |
| Repair exhausted | `SELF_HEAL_EXHAUSTED` | `selfHeal()` |
| No model available | `NO_PROVIDER_AVAILABLE` | `routeChat()` |
| Rate limited | `RATE_LIMITED` | the gateway |
