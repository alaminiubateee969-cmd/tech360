import {
  COMPANY,
  PLATFORM_PILLARS,
  PRODUCED_SYSTEMS,
  SERVICES,
  INDUSTRIES,
  CASE_STUDIES,
  TECHNOLOGY_GROUPS,
  PROCESS,
  FAQS,
  ROLES,
  LEGAL_DOCS,
} from '@/data/site'
import { getIndustryBySlug } from '@/data/industries'
import { PUBLIC_CONTACT, SITE_URL } from '@/lib/site-contact'

/**
 * Agent-facing Markdown representations, served by `src/proxy.ts` when a client
 * sends `Accept: text/markdown` (content negotiation for LLM crawlers), and
 * cross-linked from `public/llms.txt`.
 *
 * Pure data only — no DB, no Node-only APIs, safe for the proxy runtime.
 */

const CONTACT_FOOTER = `\n\n---\nContact: ${PUBLIC_CONTACT.email} · ${SITE_URL}\nClient enquiries: ${SITE_URL}/contact\nFull site index: ${SITE_URL}/llms.txt\n`

/** RFC 8288 Link header advertised on every public HTML response. */
export const AGENT_LINK_HEADER =
  `<${SITE_URL}/llms.txt>; rel="llms.txt", ` +
  `<${SITE_URL}/>; rel="alternate"; type="text/markdown"; title="Markdown version"`

const list = (items: readonly string[]) => items.map((i) => `- ${i}`).join('\n')

function home(): string {
  return [
    `# ${COMPANY.legalName} — ${COMPANY.tagline}`,
    `> ${COMPANY.subline}`,
    'Commercial governance: written Scope of Work first. HTML preview before payment where agreed in the Scope of Work. Source-code handover after verified full payment.',
    `Service coverage: ${COMPANY.serviceCoverage}. All amounts are in USD.`,
    `## Solutions (${SERVICES.length})\n` +
      SERVICES.map((s) => `- [${s.title}](${SITE_URL}/services/${s.slug}) — ${s.tagline}`).join('\n'),
    `## Industries (${INDUSTRIES.length})\n` +
      INDUSTRIES.map((i) => `- [${i.title}](${SITE_URL}/industries/${i.slug}) — ${i.description}`).join('\n'),
    `## Customer delivery process (7 steps)\n` +
      PROCESS.map((p) => `${p.step}. **${p.name}** — ${p.title} (${p.duration})`).join('\n'),
    `## Frequently asked questions\n` + FAQS.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n'),
  ].join('\n\n')
}

/** Full Markdown document for the homepage. */
export function homepageMarkdown(): string {
  return home() + CONTACT_FOOTER
}

const SECTION_TITLES: Record<string, { title: string; summary: string }> = {
  about: {
    title: 'About TECH360',
    summary: 'TECH360 LLC builds custom websites, CRM systems, client portals, eCommerce platforms, and business workflow automation for organizations worldwide.',
  },
  platform: {
    title: 'Company-in-a-Box Software Platform',
    summary: 'A modular platform with an industry template library, versioned modules, isolated tenant provisioning, staging promotion, and unified client messaging.',
  },
  services: {
    title: 'Solutions & Engineering Services',
    summary: `${SERVICES.length} software, AI, CRM, portal, eCommerce, cloud, and automation capabilities.`,
  },
  industries: {
    title: 'Industry Software Solutions',
    summary: `${INDUSTRIES.length} sector-specific operating architectures with domain workflows, modules, and governance guardrails.`,
  },
  work: {
    title: 'Selected Work & Illustrative Scenarios',
    summary: 'Illustrative project scenarios and architecture blueprints. These are not audited customer case studies or measured results.',
  },
  technologies: {
    title: 'Technologies, Cloud & Security Stack',
    summary: 'Production technologies, databases, cloud infrastructure, and automation stack.',
  },
  process: {
    title: '7-Step Customer Delivery Process',
    summary: 'Delivery milestones, written Scope of Work approvals, review gates, payment verification, and handover standards.',
  },
  blog: { title: 'Engineering Insights', summary: 'Published engineering and delivery notes from TECH360.' },
  careers: { title: 'Careers', summary: 'Career information and open roles published by TECH360.' },
  contact: { title: 'Contact TECH360', summary: 'Contact TECH360 LLC about a project or service enquiry.' },
  faq: { title: 'Frequently Asked Questions', summary: 'Answers to common questions about TECH360 scoping and delivery.' },
  legal: { title: 'Legal & Policies', summary: 'Terms, Privacy, Refund, Delivery, Payment, Client Approval, and Source Code Handover policies.' },
  portal: { title: 'Client Portal', summary: 'Sign-in for existing TECH360 clients (account required).' },
}

/**
 * Compact Markdown document for any other public path. Returns `null` for
 * paths that have no public representation (private operator surfaces).
 */
export function renderMarkdownForPath(pathname: string): string | null {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  const [a, b] = segments

  if (!a) return homepageMarkdown()

  if (a === 'about' && !b) {
    return `# About ${COMPANY.brand}\n\n${COMPANY.legalName} (${COMPANY.address}) builds custom websites, CRM systems, client portals, eCommerce platforms, and business workflow automation for organizations worldwide. Service coverage: ${COMPANY.serviceCoverage}.${CONTACT_FOOTER}`
  }

  if (a === 'platform' && !b) {
    return (
      `# Company-in-a-Box Software Platform\n\n` +
      PLATFORM_PILLARS.map((p) => `## ${p.title}\n_${p.tagline}_\n\n${p.description}\n\n${list(p.provides)}`).join('\n\n') +
      `\n\n## Representative system templates\n` +
      PRODUCED_SYSTEMS.map((s) => `- **${s.title}** (${s.category}) — ${s.whatYouGet}`).join('\n') +
      CONTACT_FOOTER
    )
  }

  if (a === 'services' && !b) {
    return (
      `# Solutions & Engineering Services\n\n` +
      SERVICES.map((s) => `## ${s.title}\n_${s.tagline}_\n\n${s.solution}\n\n[Details](${SITE_URL}/services/${s.slug})`).join('\n\n') +
      CONTACT_FOOTER
    )
  }
  if (a === 'services' && b) {
    const s = SERVICES.find((x) => x.slug === b)
    if (!s) return null
    return `# ${s.title}\n\n_${s.tagline}_\n\n## Problem\n${s.problem}\n\n## Solution\n${s.solution}\n\n## Capabilities\n${list(s.features)}\n\n## Technology\n${s.tech.join(', ')}\n\n## Workflow\n${list(s.workflow)}${CONTACT_FOOTER}`
  }

  if (a === 'industries' && !b) {
    return (
      `# Industry Software Solutions\n\n` +
      INDUSTRIES.map((i) => `- [${i.title}](${SITE_URL}/industries/${i.slug}) — ${i.description}`).join('\n') +
      CONTACT_FOOTER
    )
  }
  if (a === 'industries' && b) {
    const i = INDUSTRIES.find((x) => x.slug === b)
    if (!i) return null
    const rich = getIndustryBySlug(i.slug)
    const challenges = rich ? rich.data.challenges.map((c) => `${c.title}: ${c.description}`) : i.problems
    const modules = rich ? rich.data.modules.map((m) => `${m.name}: ${m.summary}`) : i.recommended
    return (
      `# ${i.title} Software Solutions\n\n${rich?.data.hero.subhead || i.description}\n\n` +
      `## Core challenges\n${list(challenges)}\n\n` +
      `## Modules & capabilities\n${list(modules)}${CONTACT_FOOTER}`
    )
  }

  if (a === 'work' && (!b || b === 'projects' || b === 'case-studies')) {
    return (
      `# Selected Work & Representative System Scenarios\n\n_All examples are illustrative scenarios demonstrating architecture and delivery approach — not named client endorsements or measured results._\n\n` +
      CASE_STUDIES.map(
        (c) => `## ${c.title} (${c.industry})\n**Challenge:** ${c.challenge}\n\n**Approach:** ${c.approach}\n\n**Intended outcome (illustrative):** ${c.outcome}\n\n**Illustrative stack:** ${c.stack.join(', ')}`,
      ).join('\n\n') +
      CONTACT_FOOTER
    )
  }

  if (a === 'technologies' && !b) {
    return (
      `# Technologies, Cloud & Security Stack\n\n` +
      TECHNOLOGY_GROUPS.map((g) => `## ${g.name}\n${g.blurb}\n\n${list(g.items)}`).join('\n\n') +
      CONTACT_FOOTER
    )
  }

  if (a === 'process' && !b) {
    return (
      `# 7-Step Customer Delivery Process\n\n` +
      PROCESS.map(
        (p) => `## ${p.step}. ${p.name} — ${p.title} (${p.duration})\n${p.description}\n\n${list(p.details)}`,
      ).join('\n\n') +
      CONTACT_FOOTER
    )
  }

  if (a === 'faq' && !b) {
    return `# Frequently Asked Questions\n\n` + FAQS.map((f) => `## ${f.q}\n${f.a}`).join('\n\n') + CONTACT_FOOTER
  }

  if (a === 'careers' && !b) {
    return (
      `# Careers at TECH360\n\n` +
      ROLES.map((r) => `## ${r.title} (${r.type} · ${r.location})\n${r.summary}`).join('\n\n') +
      CONTACT_FOOTER
    )
  }

  if (a === 'contact' && !b) {
    return `# Contact ${COMPANY.brand}\n\nEmail: ${PUBLIC_CONTACT.email}\nSubmit an enquiry via POST ${SITE_URL}/api/contact or visit ${SITE_URL}/contact.${CONTACT_FOOTER}`
  }

  if (a === 'legal' && !b) {
    return `# Legal & Policies\n\n` + LEGAL_DOCS.map((d) => `- [${d.title}](${SITE_URL}/legal/${d.slug}) — ${d.summary}`).join('\n') + CONTACT_FOOTER
  }
  if (a === 'legal' && b) {
    const d = LEGAL_DOCS.find((x) => x.slug === b)
    if (!d) return null
    return (
      `# ${d.title}\n\n_Effective ${d.updated}_\n\n${d.summary}\n\n` +
      d.sections.map((s) => `## ${s.heading}\n\n${s.body.join("\n\n")}`).join('\n\n') +
      CONTACT_FOOTER
    )
  }

  return null
}

/** Compact Markdown for any public path (falls back to the section summary). */
export function sectionMarkdown(pathname: string): string {
  const direct = renderMarkdownForPath(pathname)
  if (direct) return direct

  const top = pathname.split('/').filter(Boolean)[0] ?? ''
  const section = SECTION_TITLES[top] ?? {
    title: 'TECH360',
    summary: 'Enterprise software, automation, and digital transformation.',
  }

  return `# ${section.title}\n\n${section.summary}\n\nCanonical URL: ${SITE_URL}${pathname}\nContact: ${PUBLIC_CONTACT.email}\n\nFull site index: ${SITE_URL}/llms.txt\n`
}

/** Rough token estimate for a Markdown document (4 bytes ≈ 1 token). */
export function estimateMarkdownTokens(markdown: string): number {
  return Math.max(1, Math.ceil(new TextEncoder().encode(markdown).length / 4))
}
