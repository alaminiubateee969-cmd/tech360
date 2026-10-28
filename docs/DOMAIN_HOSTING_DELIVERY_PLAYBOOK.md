# Domain and Hosting Delivery Playbook

The runtime source of truth for agent guidance is `src/lib/delivery-system-knowledge.ts`. `runAgent` injects it into deployment agents and relevant domain/hosting, website, CRM, architecture, proposal and scope tasks. Webchat discovery also asks for domain/registrar/hosting evidence and preserves customer claims as unverified until confirmed.

## What the customer receives

The preliminary proposal should explain in plain language:

1. Recommended product/work type and framework/runtime, with reasons.
2. What runs on the customer's host versus TECH360-managed or third-party services (web app, database, files, API, automation/AI).
3. Whether the exact shared-hosting plan supports the stack. If unknown, state that framework/deployment is conditional on a compatibility check.
4. Provider/plan prerequisites: supported runtime/version, SSH/deploy path, environment secrets, routing/ports, database and backups, persistent storage, cron/background workers/WebSockets where needed, resource limits and staging.
5. Customer-owned items, client dependencies, secure access handoff and account roles. Never request passwords, OTPs, API keys or private keys in chat/email.
6. Domain/DNS/SSL plan, existing mail/MX record preservation, expected propagation, health checks and rollback. DNS/account changes require authorization and approval.
7. Data isolation, privacy/security, backups/restore, QA and acceptance criteria.
8. One-time and recurring costs, third-party services, support/maintenance, exclusions and assumptions.
9. Alternatives when shared hosting is incompatible: static site, separate managed API, supported Node host/VPS/cloud, or reduced scope. Explain trade-offs and ask the customer before changing providers.

## Domain and hosting rules

- A domain typed by a customer is not proof it is available, registered, owned, controlled or connected to the claimed provider. Do not claim an availability/ownership check unless there is verifiable evidence and authorization.
- The customer retains ownership of registrar, DNS, hosting, source-code and payment accounts. Temporary least-privilege access must use approved secure delivery and be revoked after work.
- Do not assume “shared hosting” can run Next.js, persistent Node apps, Docker, queues, Redis, WebSockets, root processes or AI agents. Check the actual provider plan and runtime/database specifications first.
- Do not deploy TECH360's entire internal workforce, admin console, shared credentials or unrelated customers' data onto client hosting. Only agreed, isolated project components/agents may run for that customer.
- Preserve existing DNS records—especially MX and email-verification TXT—before changes. Plan backup/export, TTL, cutover, TLS, test, and rollback before any authorized release.
- Keep the journey: discovery → preliminary proposal → client feedback → detailed versioned Scope of Work → explicit client approval → payment workflow. A concept approval is not final SOW approval.

## Fit matrix (verify against the actual plan)

| Project | Common fit | Verify before promising |
|---|---|---|
| Static marketing site | Static web root or CDN | Forms/CMS, routing, analytics consent, SSL, content workflow |
| WordPress/PHP/Laravel | PHP/MySQL shared host may work | PHP/extensions, cron/workers, storage, security updates and resource limits |
| Next.js/Node.js app, CRM, portal, API | Supported persistent Node/managed runtime | Node version, process routing, env vars, DB connectivity, file storage, queues, logs, backups |
| E-commerce/inventory | App + database + authorized payment integration | Catalogue/stock source, payment fees, orders, tax/shipping, branch access and reconciliation |
| AI/automation | Scoped application integration or separately secured service | Provider usage cost, secret handling, permissions, audit, human approval and hosting runtime |

Framework selection is a project decision made from client needs and verified hosting evidence—not a one-size-fits-all promise.
