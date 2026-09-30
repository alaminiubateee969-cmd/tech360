# TECH360 — AI workforce coverage report

Generated from `src/lib/agents/registry.ts` by AST-style parsing (never grep).

```
TOTAL_DEPARTMENTS=110
TOTAL_AGENTS=44
DISTINCT_DEPARTMENTS_WITH_AGENT=36
DEPARTMENTS_WITHOUT_AN_AGENT=74
REGISTERED_CAPABILITIES=48
```

## Why it is 74, not 66

`110 - 44 = 66` is wrong because agents are **not** one-per-department.
Seven departments hold 2–3 agents, so 44 agents occupy only 36 departments:

| Department | Agents |
|---|---|
| `D014` | SCP-006, SCP-007, SCP-008 |
| `D035` | EML-012, SMS-013 |
| `D044` | SOC-014, PUB-035 |
| `D020` | PRJ-018, TSK-019 |
| `D03B` | KNW-023, MEM-024 |
| `D02D` | DLV-029, HND-030 |
| `D062` | APP-031, ADM-033 |

`110 - 36 = 74`.

## Why the count used to read 84

26 department codes use hexadecimal letters (`D01A` … `D0FF`). A
`D[0-9]+` grep skips them: `84 + 26 = 110`. Locked by
`tests/ai-workforce-rbac.test.ts`.

## Coverage by category

| Category | Departments | Covered | Uncovered |
|---|---|---|---|
| CONTENT | 13 | 5 | 8 |
| DELIVERY | 19 | 5 | 14 |
| EXECUTIVE | 6 | 3 | 3 |
| GOVERNANCE | 10 | 4 | 6 |
| OPERATIONS | 17 | 6 | 11 |
| REVENUE | 17 | 6 | 11 |
| SUPPORT | 13 | 1 | 12 |
| TECHNOLOGY | 15 | 6 | 9 |
| **TOTAL** | **110** | **36** | **74** |

## This is a business decision, not a defect

No agent was created, duplicated, or reassigned to improve these numbers.
A department without an agent is a workforce-design choice: the department
exists in the org model, and work in it is currently handled by the covered
agents or by people. Creating 74 agents to make the table look full would be
manufacturing coverage.

SUPPORT (1 of 13 covered) and DELIVERY (5 of 19) are the thinnest areas and
are the natural place to start **if** the business decides to expand.

## The 74 uncovered departments

| Code | Category | Name |
|---|---|---|
| `D002` | EXECUTIVE | Strategy & Transformation |
| `D005` | EXECUTIVE | Board & Governance Liaison |
| `D006` | EXECUTIVE | Corporate Development |
| `D011` | REVENUE | Inbound Desk |
| `D016` | REVENUE | Pricing Desk |
| `D017` | REVENUE | Client Onboarding |
| `D018` | REVENUE | Account Management |
| `D019` | REVENUE | Retention & Growth |
| `D01A` | REVENUE | Channel Partnerships |
| `D01B` | REVENUE | Market Research |
| `D01C` | REVENUE | Sales Operations |
| `D021` | DELIVERY | Requirements Engineering |
| `D022` | DELIVERY | Web Engineering |
| `D023` | DELIVERY | eCommerce Engineering |
| `D024` | DELIVERY | CRM & Portal Engineering |
| `D025` | DELIVERY | Automation Engineering |
| `D026` | DELIVERY | AI Systems Engineering |
| `D028` | DELIVERY | Design & UX |
| `D029` | DELIVERY | Content Production |
| `D02C` | DELIVERY | Client Training |
| `D02E` | DELIVERY | Maintenance & Support Desk |
| `D02F` | DELIVERY | Delivery Assurance |
| `D030` | TECHNOLOGY | Platform Architecture |
| `D031` | TECHNOLOGY | Cloud Infrastructure |
| `D032` | TECHNOLOGY | Data Engineering |
| `D033` | TECHNOLOGY | Integration & APIs |
| `D038` | TECHNOLOGY | Observability & Reliability |
| `D03A` | TECHNOLOGY | AI Platform Engineering |
| `D040` | CONTENT | Growth Strategy |
| `D041` | CONTENT | Research & Insights |
| `D045` | CONTENT | Performance Marketing |
| `D046` | CONTENT | SEO & Discovery |
| `D048` | CONTENT | Video Growth Lab |
| `D052` | OPERATIONS | Vendor Management |
| `D053` | OPERATIONS | HR & Talent |
| `D054` | OPERATIONS | Recruiting |
| `D055` | OPERATIONS | Legal & Contracts |
| `D056` | OPERATIONS | Procurement |
| `D057` | OPERATIONS | Office Administration |
| `D05C` | OPERATIONS | Business Continuity |
| `D05D` | OPERATIONS | Quality Management |
| `D060` | GOVERNANCE | Constitutional AI Council |
| `D061` | GOVERNANCE | Agent Governance |
| `D063` | GOVERNANCE | Risk Management |
| `D064` | GOVERNANCE | Privacy Office |
| `D070` | SUPPORT | First Response Desk |
| `D071` | SUPPORT | Technical Support |
| `D072` | SUPPORT | WhatsApp Support |
| `D073` | SUPPORT | Email Support |
| `D074` | SUPPORT | Social Support |
| `D075` | SUPPORT | Onboarding Support |
| `D076` | SUPPORT | Billing Support |
| `D077` | SUPPORT | Knowledge Base Services |
| `D079` | SUPPORT | Community & Referrals |
| `D090` | OPERATIONS | Scale Division Alpha |
| `D091` | OPERATIONS | Scale Division Beta |
| `D092` | DELIVERY | Scale Division Gamma |
| `D093` | DELIVERY | Scale Division Delta |
| `D094` | CONTENT | Scale Division Epsilon |
| `D095` | CONTENT | Scale Division Zeta |
| `D096` | REVENUE | Scale Division Eta |
| `D097` | REVENUE | Scale Division Theta |
| `D098` | TECHNOLOGY | Scale Division Iota |
| `D099` | TECHNOLOGY | Scale Division Kappa |
| `D0A0` | SUPPORT | Scale Division Lambda |
| `D0A1` | SUPPORT | Scale Division Mu |
| `D0A2` | GOVERNANCE | Scale Division Nu |
| `D0A3` | GOVERNANCE | Scale Division Xi |
| `D0A4` | OPERATIONS | Scale Division Omicron |
| `D0A5` | DELIVERY | Scale Division Pi |
| `D0A6` | CONTENT | Scale Division Rho |
| `D0A7` | REVENUE | Scale Division Sigma |
| `D0A8` | TECHNOLOGY | Scale Division Tau |
| `D0A9` | SUPPORT | Scale Division Upsilon |
