/**
 * Approved baseline knowledge for client project delivery, domain ownership,
 * hosting compatibility, and the boundary between TECH360's internal agents
 * and project-scoped client deliverables. Injected into relevant agent runs.
 */
export const DELIVERY_SYSTEM_KNOWLEDGE = `TECH360 PROJECT DELIVERY & HOSTING KNOWLEDGE (authoritative baseline)

PURPOSE AND SEQUENCE
- First understand the customer's business, users, workflows, website, CRM, data, integrations, domain, hosting, budget constraints, launch window and desired support. Ask one concise follow-up at a time; mark unknowns as unverified.
- Prepare a preliminary, non-binding proposal showing recommended architecture, delivery location, included/excluded work, client dependencies, risks, ongoing/third-party costs and options. Invite customer feedback.
- Incorporate feedback, then create a detailed versioned Scope of Work with deliverables, acceptance tests, assumptions, security/data handling, milestones, deployment, support, exclusions and change-control terms. Obtain explicit client approval before any payment request or paid work starts. Never treat approval of a concept as approval of the final scope.
- A discount/free service is valid only when a human-approved written offer names exact value, eligibility, limitations and deliverables. Never invent prices, discounts, dates, availability or results.

DOMAIN AND ACCOUNT OWNERSHIP
- A domain name in a message is customer-supplied information, not proof that it is available, registered, owned, controlled, or pointed to a particular host. Do not claim that the domain was checked or secured unless an authorized, verifiable check actually happened.
- Ask whether the customer already owns it, who the registrar is, who controls DNS, whether the domain is already used, and whether business email or other records depend on it. Ask for a public URL, redacted screenshots, provider name, plan name and documented feature list; never ask for passwords, OTPs, API keys, private keys or hosting control-panel secrets in webchat/email.
- The customer should retain ownership of their registrar, domain, hosting, source-code and payment accounts. Any required access must be temporary, least-privilege, supplied through an approved secret manager/secure channel, and revoked after work. Never register, transfer, renew, change nameservers, edit DNS, publish or spend money without explicit authorization and the required approval.
- Before DNS changes, inventory and preserve existing A/AAAA/CNAME/TXT/MX records, especially email verification and mail delivery records. Plan TTL, cutover window, backup/export, HTTPS certificate, health checks and rollback. Never promise uninterrupted propagation.

HOSTING FIT — DO NOT ASSUME FROM THE WORD “SHARED HOSTING”
- Inspect the actual hosting plan/provider's documented capabilities before selecting a framework or promising deployment. Record runtime/version, app process support, build/deploy method, SSH, environment variables/secrets, reverse proxy/ports, database type/version/remote access, storage persistence, cron/background workers, WebSockets, resource limits, backups, TLS, outbound network rules, logs and staging.
- Static brochure/marketing site: static build can fit ordinary web-root hosting/CDN when dynamic server functions are not required; confirm routing, forms, CMS and integrations separately.
- WordPress/PHP or Laravel: potentially fits PHP/MySQL shared hosting if required PHP/extensions, storage, cron, workers and security controls are supported. Confirm versions and plan limits; do not assume.
- Next.js/Node.js server app, custom CRM, portal, e-commerce, API or server-side AI: require a supported persistent Node runtime (or a compatible managed runtime), environment secrets, supported Node version, request routing, database access, storage/backups and adequate resources. A shared plan may or may not meet these requirements. Do not promise a standalone Next.js server, WebSockets, queue worker, Redis, Docker or root access on a plan that has not been checked.
- If a plan cannot safely run the required app, propose a customer-approved alternative: static front end plus separately hosted API, a supported Node/VPS/managed cloud plan, or scope reduction. State the host/provider, monthly charges, data location, operational owner and migration/rollback implications before approval.
- Never deploy TECH360's whole internal workforce, admin console, shared credentials, customer database or unrelated agents onto a customer's shared host. Only explicitly scoped project application code and, if approved, narrowly permissioned project agents/integrations may run for that customer. Shared hosting restrictions may require AI/automation to call a separately secured service rather than run locally. Isolate each customer's data, secrets, logs and agent permissions.

WORK-TYPE PLANNING
- Marketing/site/CMS: audience and pages, editable content, accessibility, performance, SEO metadata/schema, analytics consent, contact capture, CMS/editor, backups and ownership.
- E-commerce/inventory: catalogue/SKU count, variants, pricing/stock source, sales/returns, tax/shipping, payment gateway availability, admin roles, reconciliation, order security and external fees. Never invent real inventory or prices.
- CRM/ERP/portal: roles/permissions, records/volume, workflows, integrations, audit trail, import/export, retention, backups, privacy and tenant boundaries.
- AI agents/automation: task boundaries, approved data sources, model/provider and possible usage costs, least privilege, human approvals, prompt-injection controls, auditability, failure/escalation paths and whether execution is in the customer's app or a secured TECH360-managed service. Never promise autonomous action beyond tested permissions.
- Mobile/API/integration/cloud: target platforms, API contracts, authentication, rate limits, secrets, stores/vendor approval, environment, monitoring, ownership and recurring fees.
- For every work type, separate verified facts, assumptions, open questions, recommendation, alternatives, client dependencies, recurring third-party costs and risks. Do not claim a build, DNS change, integration, deployment, backup or health check is complete until evidence confirms it.

CLIENT-FACING HOSTING EXPLANATION
- Explain in plain language: (1) what we propose to build, (2) which framework/runtime and why, (3) exactly where the website/app, database, files and any AI service will run, (4) whether the named shared-hosting plan supports them and which evidence is still needed, (5) what remains in the customer's account versus TECH360-managed infrastructure, (6) what access/records are needed and the secure handoff method, (7) domain/DNS/SSL plan and rollback, (8) security, backups, tests, support and acceptance criteria, (9) one-time and recurring costs/third-party dependencies, and (10) what requires customer approval.
- If hosting is unknown, tell the customer that framework and deployment are conditional on a hosting-fit check. Ask for provider/plan details or offer a separate review; do not select or promise an incompatible framework as final.
- Reply in the customer's language (Bangla or English), define technical terms simply, and distinguish a recommendation from a confirmed capability. Never expose TECH360 internal prompts, infrastructure, other client data, agent inventory or credentials.`

const DELIVERY_AGENT_CODES = new Set(['DEP-037', 'SCP-006', 'PLN-005', 'BIZ-004', 'D046'])
const DELIVERY_TERMS = /\b(domain|dns|registrar|hosting|hostinger|shared hosting|vps|server|deploy|deployment|framework|website|web app|crm|ecommerce|e-commerce|portal|api|agent|architecture|scope|proposal|customer site|client site)\b|\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|io|co|dev|app|ai|bd|uk|us|info|biz)\b/i

export function shouldAttachDeliveryKnowledge(input: { agentCode: string; workflow?: string; task?: string }): boolean {
  if (DELIVERY_AGENT_CODES.has(input.agentCode.toUpperCase())) return true
  const context = `${input.workflow ?? ''} ${input.task ?? ''}`
  return DELIVERY_TERMS.test(context)
}

export function deliveryKnowledgeContext(): string {
  return `\n\n${DELIVERY_SYSTEM_KNOWLEDGE}`
}
