import { SERVICES, INDUSTRIES, FAQS, LEGAL_DOCS } from '@/data/site'
import { COMPANY } from '@/lib/constants'

/**
 * Agent-facing Markdown representations (served by src/proxy.ts when the
 * request carries `Accept: text/markdown`, and cross-linked from llms.txt).
 *
 * Kept intentionally compact: the whole point is lower token cost than HTML.
 * Pure data only — safe for the proxy runtime (no DB, no Node-only APIs).
 */

const SITE = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')

/** RFC 8288 Link header advertised on public HTML responses. */
export const AGENT_LINK_HEADER =
  `<${SITE}/llms.txt>; rel="llms.txt", ` +
  `<${SITE}/>; rel="alternate"; type="text/markdown"; title="Markdown version"`

const CONTACT_BLOCK = `TECH360 LLC (${COMPANY.domain}) — ${COMPANY.legalName}
Address: ${COMPANY.address}
Email: ${COMPANY.email}
Phone: ${COMPANY.phone}
Web: ${SITE}/`

/** Full Markdown document for the homepage. */
export function homepageMarkdown(): string {
  const serviceLines = SERVICES.map(
    (s) => `- [${s.title}](${SITE}/services/${s.slug}): ${s.tagline}`,
  ).join('\n')
  const industryLines = INDUSTRIES.map(
    (i) => `- [${i.title}](${SITE}/industries/${i.slug}): ${i.description}`,
  ).join('\n')
  const faqBlocks = FAQS.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')
  const legalLines = LEGAL_DOCS.map(
    (d) => `- [${d.title}](${SITE}/legal/${d.slug}): ${d.summary}`,
  ).join('\n')

  return `# TECH360 — Enterprise Software, Automation & Digital Transformation

> TECH360 LLC builds websites, eCommerce platforms, custom CRMs, AI-assisted applications, and business automation. Project scope, payment, delivery, and support are agreed in writing. All money amounts are in USD.

${CONTACT_BLOCK}

## Key pages

- [About](${SITE}/about): Company profile and delivery approach.
- [Services](${SITE}/services): ${SERVICES.length} software and automation services.
- [Industries](${SITE}/industries): ${INDUSTRIES.length} industry solution patterns.
- [Delivery Process](${SITE}/process): Delivery stages, client approvals, and review gates.
- [AI Agent Pipeline](${SITE}/pipeline): The client journey with approval gates and source-code handover.
- [Engineering Insights](${SITE}/blog): Published engineering and delivery notes.
- [FAQ](${SITE}/faq): Answers about scope, payments, revisions, and handover.
- [Contact](${SITE}/contact): Project and service enquiries.
- [Legal & Policies](${SITE}/legal): Terms of Service, Privacy Policy, and other policies.
- [Client Portal](${SITE}/portal): Sign-in for existing clients (account required).

## Services (${SERVICES.length})

${serviceLines}

## Industries (${INDUSTRIES.length})

${industryLines}

## FAQ

${faqBlocks}

## Legal

${legalLines}

## Machine-readable formats

- llms.txt: ${SITE}/llms.txt
- MCP endpoint (read-only): ${SITE}/api/mcp (card: ${SITE}/.well-known/mcp/server-card.json)
- JSON-LD: Organization, WebSite, WebPage, FAQPage, Service, Blog in the HTML source
- Content signal: search=yes, ai-train=no (see ${SITE}/robots.txt)
`
}

const SECTION_TITLES: Record<string, { title: string; summary: string }> = {
  about: { title: 'About Tech360', summary: 'Company profile, delivery approach, and the systems TECH360 builds.' },
  services: { title: 'Software and Automation Services', summary: `All ${SERVICES.length} services with descriptions and detail pages.` },
  industries: { title: 'Industries', summary: `${INDUSTRIES.length} industry solution patterns and service starting points.` },
  work: { title: 'Illustrative Project Scenarios', summary: 'Illustrative software project scenarios — not audited case studies or measured results.' },
  technologies: { title: 'Technology Stack', summary: 'Technology categories and tools described on the Tech360 website.' },
  process: { title: 'Delivery Process', summary: 'Delivery stages, client approvals, and review gates.' },
  pipeline: { title: 'AI Agent Communication Pipeline', summary: 'The eleven-stage client journey: messages, CRM saves, approval gates, HTML preview before payment, source-code handover after full payment.' },
  blog: { title: 'Engineering Insights', summary: 'Published engineering and delivery notes from Tech360.' },
  careers: { title: 'Careers', summary: 'Career information and opportunities published by Tech360.' },
  contact: { title: 'Contact Tech360', summary: 'Contact TECH360 LLC about a project or service enquiry.' },
  faq: { title: 'Frequently Asked Questions', summary: 'Answers to common questions about Tech360 services and delivery.' },
  legal: { title: 'Legal & Policies', summary: 'Terms of Service, Privacy Policy, and other policies.' },
  'design-kit': { title: 'Design Kit', summary: 'Visual reference for the Tech360 website design system.' },
  portal: { title: 'Client Portal', summary: 'Sign-in for existing Tech360 clients (account required).' },
}

/** Compact Markdown document for any other public path. */
export function sectionMarkdown(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const top = segments[0] ?? ''

  if (top === 'services' && segments[1]) {
    const svc = SERVICES.find((s) => s.slug === segments[1])
    if (svc) {
      return `# ${svc.title}

${svc.tagline}

Canonical URL: ${SITE}${pathname}
Company: ${CONTACT_BLOCK}

Back to all services: ${SITE}/services
Full site index: ${SITE}/llms.txt
`
    }
  }

  if (top === 'industries' && segments[1]) {
    const ind = INDUSTRIES.find((i) => i.slug === segments[1])
    if (ind) {
      return `# ${ind.title}

${ind.description}

Canonical URL: ${SITE}${pathname}
Company: ${CONTACT_BLOCK}

Back to all industries: ${SITE}/industries
Full site index: ${SITE}/llms.txt
`
    }
  }

  const section = SECTION_TITLES[top] ?? {
    title: 'TECH360',
    summary: 'Enterprise software, automation, and digital transformation.',
  }

  return `# ${section.title}

${section.summary}

Canonical URL: ${SITE}${pathname}
Company: ${CONTACT_BLOCK}

Full site index: ${SITE}/llms.txt
`
}
