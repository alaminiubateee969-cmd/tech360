# Skill registry status

| | |
|---|---|
| **Document** | `docs/implementation/SKILL_REGISTRY_STATUS.md` |
| **Owner** | Platform engineering, Tech360 |
| **Collection date** | 2026-10-19 |
| **Last verification** | 2026-10-19 — `tests/skills-registry.test.ts` (38/38, exhaustive) |
| **Access level** | Internal — engineering and Super Admin |
| **Version** | 1.0 |
| **Retention** | Retained for the life of the platform |

> A skill registry entry without an executable implementation and a
> passing test is **not** a working skill. This document reports the
> five counts separately and never counts a placeholder as operational.

---

## 1. The five counts

| Count | Value | What it means here |
|---|---:|---|
| **Registered** | **10,010** | a definition exists in `SKILL_CATALOG` with an id, a version, a status, a handler, an input schema, an output schema, its permissions, its owning department, its quality rules and its test reference |
| **Implemented** | **10,010** | a **real executable handler** is registered for it — `SKILL_HANDLERS[skill.handler]` exists |
| **Tested** | **10,010** | it was **executed** against its real handler and the output was **validated against its declared output schema** |
| **Enabled** | **10,010** | its lifecycle state is `ACTIVE` |
| **Operational** | **10,010** | implemented **and** tested **and** enabled |

**The "tested" count is evidence, not a claim.** The test suite does not
sample. It iterates over all 10,010 definitions, builds a schema-valid
input for each, runs the real handler, and validates the output
against the declared schema. A single mismatch fails the suite.

```
it('executes all 10,010 skills and validates every output against its schema', () => {
  const failures: string[] = []
  for (const definition of SKILL_CATALOG) { … }
  assert.equal(failures.length, 0, `skill execution failures:\n${…}`)
})
```

---

## 2. The shape

| | |
|---|---|
| Capability templates | **91** |
| Departments | **110** |
| Skills | 91 × 110 = **10,010** |
| Executable primitives | **20** |
| Roles (archetypes) | **20** |
| Capabilities per role | 4 or 5 |

### 2.1 The 20 executable primitives

| Primitive | What it does |
|---|---|
| `text.classify` | label text against a department's own labels |
| `text.summarize` | an extractive summary with a coverage ratio |
| `entity.extract` | emails, phones, dates, amounts, references |
| `keyword.map` | map a glossary onto the text |
| `json.validate` | validate a payload against the department's contract |
| `template.render` | render a template, and report the missing variables |
| `lead.qualify` | score a lead against the department's criteria |
| `document.classify` | classify a file by extension, MIME type and content |
| `keyword.rank` | rank candidates against a query |
| `checklist.evaluate` | evaluate a checklist, and report the completion ratio |
| `answer.extract` | find the evidence span that answers a question |
| `url.normalize` | normalise a URL |
| `phone.normalize` | normalise a phone number to E.164 |
| `slug.make` | make a URL slug |
| `text.readability` | word count, sentence count, complexity, a readability score and a level |
| `record.dedupe_key` | build a stable deduplication key |
| `schedule.parse` | parse a date, a deadline or a recurrence |
| `number.format` | format a number as a currency |
| `hash.fingerprint` | fingerprint a record so a change is detectable |
| `text.metrics` | characters, words, unique words, lines, Bangla detection |

### 2.2 The 91 capability templates

The 91 templates are **not** 91 distinct algorithms. They are 91
**parameterised professional capabilities** bound to the 20 primitives.
Each declares its own inputs, its own outputs, its own risk level, its
own required approval and its own configuration, and each is bound to a
tested primitive.

The base 20 cover the platform's core: `classify_text`, `summarize_text`,
`extract_entities`, `map_keywords`, `validate_payload`, `render_template`,
`qualify_lead`, `classify_document`, `rank_candidates`,
`evaluate_checklist`, `extract_answer`, `normalize_url`, `normalize_phone`,
`make_slug`, `measure_readability`, `dedupe_key`, `parse_schedule`,
`format_number`, `fingerprint_content`, `measure_text`.

The remaining 71 are department-shaped specialisations — `summarize_meeting`,
`extract_risks`, `classify_ticket`, `qualify_vendor`,
`classify_legal_document`, `check_plain_language`, `flag_jargon`,
`profile_script_mix`, and so on.

### 2.3 The round-robin binding

The catalogue has 91 capabilities and 20 role archetypes. The
capabilities are dealt out round-robin (`capabilitiesForRole()`), so
**every capability is owned by at least one role** — a capability that
no role owned would be a registered skill that no employee could ever
run. `tests/skills-registry.test.ts` asserts the coverage.

---

## 3. The skill definition

Each `SkillDefinition` carries:

| Field | Purpose |
|---|---|
| `id` | `<department slug>_<capability slug>` — the stable key |
| `version` | the semantic version |
| `status` | `DRAFT` / `ACTIVE` / `SUSPENDED` / `RETIRED` |
| `handler` | the executable primitive |
| `inputSchema` / `outputSchema` | the JSON Schema the call is validated against |
| `permissions` | the department's base permission plus the capability's own |
| `departmentCode` | the owning department |
| `riskLevel` | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `requiresApproval` | whether the skill may only run with an approval |
| `qualityRules` | what "good" means for this skill |
| `testRef` | the reference to the test that covers it |
| `configuration` | the department profile the primitive is bound to |

---

## 4. The lifecycle

`src/lib/skills/registry.ts` enforces legal transitions only:

| From | To | Allowed |
|---|---|---|
| `DRAFT` | `ACTIVE` | yes |
| `ACTIVE` | `SUSPENDED` | yes |
| `SUSPENDED` | `ACTIVE` | yes (rollback) |
| `ACTIVE` | `DRAFT` | **no** |
| `RETIRED` | `ACTIVE` | **no** |

`suspendSkill()` requires a reason. A skill without a handler is
reported as **not implemented** and **not operational**, and the
registry refuses to activate it.

---

## 5. The execution contract

`executeSkill()` (in `src/lib/skills/executor.ts`):

1. checks the caller's **permissions** against the skill's — a missing
   permission is refused with the missing permission named;
2. validates the **input** against the declared input schema;
3. runs the handler with a **timeout**;
4. validates the **output** against the declared output schema;
5. **audits** the run.

A skill run is enqueued onto the **same** `AgentJob` queue as agent
inference, with `taskType: 'SKILL'`. There is one queue.

---

## 6. The defects this suite found, and the fixes

| Defect | Effect | Fix |
|---|---|---|
| 34 templates declared an output schema their handler did not produce | the schema validation rejected a correct result — e.g. `$.sentences is required` for a `text.summarize` skill, `$.band is required` for a `lead.qualify` skill | the declared schemas were corrected to the handlers' real output |
| two of those corrections had the wrong **type** | `complexity` is a number, not a string; `numeric` is a boolean, not a number | the types were corrected |
| 9 templates named a primitive that did not exist (`text.extract`, `text.map`, `text.rank`) | the skill had no handler and was not implementable | corrected to `entity.extract`, `keyword.map`, `keyword.rank` |
| `validateLogicalAgentCatalogue()` matched a skill's capability by its last two underscore-separated segments | a three-word capability slug was reported as an unknown skill | the suffix is now matched against the known capability list |
| the role archetypes did not cover every capability | 71 capabilities were owned by nobody | the capabilities are dealt out round-robin across the 20 archetypes |

---

## 7. What the skill registry does **not** claim

| Claim not made | Why |
|---|---|
| the skills are "AI capabilities" in the sense of a model | they are **deterministic, tested primitives**. Where a model is needed, the agent runtime calls it; the skill does not. This is deliberate: a deterministic function is auditable, and a model is not |
| a skill can run a shell command | there is no shell primitive and no shell tool |
| a skill can write outside the governed tables | the primitives operate on their inputs; the side effects go through the tool registry |
| every skill has been run in production | every skill has been **executed and schema-validated** in the test suite. Running them in production needs a seeded staging database |
| the skills are "10,000 different things" | they are 91 parameterised capabilities across 110 departments. The honest description is in §2.1 and §2.2 |
