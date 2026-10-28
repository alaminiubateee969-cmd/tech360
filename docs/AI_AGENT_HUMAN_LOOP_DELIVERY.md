# AI-agent-assisted delivery with human review

## Capability boundary

TECH360 can run the service journey with its own agents from inbound contact through final-delivery follow-up, but **it is not an autonomous software factory today**. The agents handle supported conversations, discovery, recommendations, proposal/SOW drafts, project planning, task drafts and delivery communications. They do not have a customer-specific repository/workspace, cannot run the customer's build or test suite, and cannot safely deploy arbitrary client code or change customer DNS. Do not describe a generated plan or AI draft as a finished implementation.

## Journey and checkpoints

| Stage | Agent/system work | Human or customer checkpoint |
|---|---|---|
| First SMS | Verify provider event, normalize phone, deduplicate, create/link CRM lead, save inbound and run business detection. The first acknowledgement uses the configured pipeline message; subsequent SMS turns use the AI conversation/discovery agent. | Customer's inbound SMS permits a reply in that conversation; honour STOP/opt-out. Provider must accept outbound sends before reporting success. |
| Discovery | AI replies, collects requirements a question at a time, captures domain/hosting claims as unverified, prepares a preliminary proposal | Customer gives feedback; no domain ownership or plan compatibility is presumed. |
| Final scope | Agents review and draft a versioned Scope of Work | Admin reviews/approves the draft for sending; customer explicitly approves the final scope. |
| Payment | Agent prepares instructions from the approved scope; provider evidence may be ingested | Human approval before instructions are sent; payment is recorded pending and human/provider evidence verifies it. No AI self-verification. |
| Project plan | After verified payment, PM agent creates a task breakdown. Agent-assigned tasks can be sent to Flow (TSK-019) to prepare a draft work product/checklist in the durable queue. | Every AI task draft lands in **REVIEW**. A manager must inspect the draft and explicitly accept it. An AI job never marks its own task DONE. Human-assigned tasks remain human-owned. |
| Build, QA and deployment | Agents may prepare draft code/content/specs and validation plans; agents explain hosting fit and conditional deployment choices | A real client workspace, execution of tests, security review and any external deploy/DNS change require separately scoped tooling, human oversight and explicit authorization. No passwords or keys in chat. |
| Handover | System checks task completion, full verified payment, clean project artifacts and creates a pinned manifest | A Super Admin approves release of that exact artifact manifest; the customer confirms receipt/function/password change. Issues create a human follow-up task. |
| Closeout | Agent/system prepares optional review/referral follow-up | Reviews are never fabricated or published without client content/consent and moderation. |

## AI project task draft controls

- A manager initiates an AI draft only for a `TODO` or retryable `BLOCKED` agent-assigned task, while its project has an admin-approved final scope.
- The durable job is scoped to that project's Client ID, project ID, task ID and approved scope. Output is retained on the job and shown in the project task view.
- Success changes the task to `REVIEW`, not `DONE`; a failed terminal job changes it to `BLOCKED`. Retries do not create duplicate active work.
- Human completion is separate from draft acceptance. The API requires a completed linked agent job, REVIEW state and a human review note before marking a TSK-019 task done. The reviewer attests that applicable work was integrated into the project and checked against the approved scope. Handover still requires every task to be done.
- This is a draft/review loop, not a claim that code was written to a repository, tests passed, deployment occurred, or the customer has received a deliverable.

## To enable genuinely agent-executed client builds

A future project needs its own isolated repository/workspace, scoped agent identity, explicit client-approved permissions, a secret-manager integration, sandboxed build/test tools, artifact provenance and security scanning, staging environment, human release approval and rollback path. Those capabilities must be added and acceptance-tested per project type before claiming agents can implement and deploy every kind of project end to end.
