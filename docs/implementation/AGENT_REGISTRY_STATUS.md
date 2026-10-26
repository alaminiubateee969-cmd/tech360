# Agent registry status

| | |
|---|---|
| **Document** | `docs/implementation/AGENT_REGISTRY_STATUS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 — `tests/ai-eos.test.ts` (94/94), `tests/ai-workforce-rbac.test.ts` (51/51) |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

The specification requires that "registered / implemented / tested /
enabled / operational" are reported **separately** for the agents, and
that a placeholder is never counted as operational. This document does
that.

---

## 1. The two registries, and why there are two

| Registry | What it holds | Count | Source |
|---|---|---:|---|
| **Core agents** (`AiAgent` table) | the 44 agents that call a model today | 44 | `src/lib/agents/registry.ts` → `CORE_AGENTS` |
| **AI employees** (code-defined) | the 2,201-employee organisation | 2,201 | `src/lib/agents/workforce.ts` → `WORKFORCE` |

They are **not** duplicates and they are **not** a second runtime. The
44 core agents are the model's *executable* agents; the 2,201 employees
are the *organisation*. A logical employee is executed by the same
runtime, the same model hub and the same queue.

**The Master AI is the pre-existing `CEO-001` core agent** (employee
`EMP-MASTER-001`). It is not a new parallel system, and it is not a
special case in the code.

---

## 2. The five counts, reported separately

### 2.1 AI employees (2,201)

| Count | Value | Evidence |
|---|---:|---|
| **Registered** | **2,201** | `WORKFORCE.length`; every employee has an id, a name, a role, a level, a department, a division, a manager, a mission, responsibilities, an authority, decision rights, tools, skills, prompt stages, procedures, knowledge access, memory scopes, KPIs, escalation rules, collaboration rules, behavioural constraints, security permissions and a learning profile |
| **Implemented** | **2,201** | every employee resolves to a catalogue entry in `LOGICAL_AGENT_CATALOGUE` with a model profile, a permission set, a skill set, an approval list and execution limits |
| **Tested** | **2,201** | `validateWorkforce()` returns **zero issues** — every attribute present, every manager resolvable, no duplicate id |
| **Enabled** | **2,201** | every catalogue entry is `status: 'ACTIVE'` |
| **Operational** | **0 as model-backed, 2,201 as procedure-backed** | see the honest note below |

> **The honest note.** An employee is "operational" in the sense the
> specification means — it has a real identity, a real authority, real
> skills that execute, real procedures that run, real tools that are
> permissioned, real knowledge access, real memory scopes and a real
> reporting line. But **only 44 of them are backed by a model-backed
> agent that can be dispatched today** through `/api/admin/agents/{code}/run`.
> The console shows the two counts separately, because conflating them
> is exactly the kind of inflated number this document exists to
> prevent.

### 2.2 Core agents (44)

| Count | Value | Evidence |
|---|---:|---|
| Registered | 44 | `CORE_AGENTS.length` |
| Implemented | 44 | each has a handler, a system prompt, a tool list and a permission set |
| Tested | 44 | `tests/ai-registry.test.ts`, `tests/ai-workforce-rbac.test.ts` |
| Enabled | 44 | `status: 'ACTIVE'` in the registry seed |
| Operational | 44 | dispatchable through the agent runtime |

---

## 3. The organisation, counted

### 3.1 By level

| Level | Employees | Decision authority |
|---|---:|---|
| `MASTER_AI_CEO` (1) | 1 | the constitution. Proposes; never self-approves |
| `EXECUTIVE_LEADERSHIP` (2) | 12 | division strategy. Cannot authorise a payment, a publication or a deletion |
| `DEPARTMENT_DIRECTOR` (3) | 208 | the department plan, staffing and the quality bar |
| `MANAGER` (4) | 220 | team delivery, triage and first-line review |
| `SUPERVISOR` (5) | 330 | supervised execution within the agreed scope |
| `SENIOR_SPECIALIST` (6) | 440 | specialist work; complex work is reviewed |
| `SPECIALIST` (7) | 440 | specialist work inside the agreed scope |
| `JUNIOR_SPECIALIST` (8) | 330 | routine specialist output within scope |
| `WORKER_ASSISTANT` (9) | 220 | prepares work for review; no autonomous external action |
| **Total** | **2,201** | |

### 3.2 By division

| Division | Employees |
|---|---:|
| `DIV-EXEC` — Executive | 102 |
| `DIV-REV` — Revenue | 321 |
| `DIV-DEL` — Delivery | 361 |
| `DIV-TECH` — Technology | 281 |
| `DIV-GROW` — Growth | 241 |
| `DIV-OPS` — Operations | 321 |
| `DIV-GOV` — Governance | 181 |
| `DIV-SUP` — Support | 241 |
| **Total** | **2,201** |

### 3.3 By capability

| Measure | Value |
|---|---:|
| Employees with a skill binding | 2,201 |
| Employee → skill bindings | 10,015 |
| Employees with at least one procedure | 2,201 |
| Employee → procedure bindings | 6,055 |
| Employees with an approval requirement | 1,211 |
| Departments | 110 |
| Roles (archetypes) | 20 |
| Capability templates | 91 |

---

## 4. What every employee carries

The 24 attributes, and where each is enforced:

| # | Attribute | Where it is enforced |
|---:|---|---|
| 1 | Employee ID | `EmployeeProfile.employeeId` — the key everywhere |
| 2 | Name | the identity section of the context |
| 3 | Role | the identity section of the context |
| 4 | Level | the authority ladder and the decision rights |
| 5 | Department | the department rules, the knowledge access, the procedures |
| 6 | Division | the division grouping and the KPI set |
| 7 | Manager | `managerEmployeeId` — resolved and checked by `validateWorkforce()` |
| 8 | Reporting structure | `reportingPath[]` — the full chain to the Master AI |
| 9 | Mission | the identity section of the context |
| 10 | Responsibilities | the context and the review criteria |
| 11 | Authority | the context and the governance decision |
| 12 | Decision rights | `mayDecide` / `mayRecommend` / `mustEscalate` |
| 13 | Tools | `availableTools(permissions)` — only the authorised ones enter the context |
| 14 | Skills | the catalogue binding; every skill has a tested handler |
| 15 | Prompts | `promptStages[]` — the stages the retriever serves |
| 16 | SOPs | the procedures the employee may execute |
| 17 | Knowledge access | the `accessLevel` filter on the RAG store and the graph |
| 18 | Memory | `memoryScopes[]` — the scopes the employee may read and write |
| 19 | KPIs | the performance section of the profile |
| 20 | Escalation rules | the procedure's escalation path and the orchestrator |
| 21 | Collaboration rules | the delegation contract |
| 22 | Behavioural constraints | the context, as hard rules for the model |
| 23 | Security permissions | `authorizeAgentTool()` and the governance decision |
| 24 | Learning profile | `learnsFrom`, `teaches`, `reviewCadence` |

---

## 5. The availability model

Six states, **derived from the record** and never declared:

| State | Derived from |
|---|---|
| `BUSY` | at least one `AgentJob` in `RUNNING` |
| `ESCALATED` | at least one `AgentJob` in `AWAITING_APPROVAL` |
| `QUEUED` | at least one `AgentJob` in `QUEUED` or `RETRYING` |
| `ERROR` | a recent failed or timed-out execution, or the last run failed |
| `OFFLINE` | the agent is not registered, or it is not `ACTIVE` |
| `AVAILABLE` | none of the above — genuinely nothing to do |

A workforce where every employee reads "AVAILABLE" would be a lie. The
console shows the derived state and the reason.

---

## 6. The collaboration contract

A delegation is not a message. It carries:

`requestingAgent`, `targetAgent`, `kind`, `task`, `objective`,
`context`, `priority`, `deadline`, `permissions`, `expectedOutput`,
`status`, `result`, `correlationId`.

`createDelegation()` persists it to `AgentDelegation` and audits it.
`completeDelegation()` records the result. The console's Collaboration
panel reads that table — so it is empty until a delegation actually
happens, which is the honest state.

---

## 7. Known gaps

| Gap | Status | What would close it |
|---|---|---|
| Only 44 employees are model-backed and dispatchable | **OPEN** | dispatch the remaining employees through the same runtime once the model host is verified and the benchmark has passed |
| No employee has been *executed* yet in this environment | **OPEN** | a staging database and a real model |
| The console's "AI Employees" panel shows the registry, not a live fleet | **BY DESIGN** | a fleet view would need a real dispatch record; the Task Queue panel shows that |
| A test that the 2,201 employees can all be dispatched | **NOT WRITTEN** | 2,201 dispatch runs need a staging database and a model host; the registry validation covers the static shape |
