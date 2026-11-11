import { INDUSTRIES, LEGAL_DOCS, SERVICES } from '@/data/site'
import { getIndustryBySlug } from '@/data/industries'
import { PROJECT_DETAILS, getProjectDetail } from '@/data/work-details'
import { WORK_EXAMPLES } from '@/data/work-examples'

export type PublicRouteKind =
  | 'section'
  | 'service'
  | 'industry'
  | 'legal'
  | 'blog-index'
  | 'blog-post'
  | 'project'
  | 'portal'

export type PublicRouteInfo = {
  path: string
  title: string
  description: string
  kind: PublicRouteKind
  noIndex?: boolean
}

export const LEGAL_SLUG_ALIASES: Record<string, string> = {
  'terms-of-service': 'terms',
  'terms-and-conditions': 'terms',
  'privacy-policy': 'privacy',
  'refund-policy': 'refund',
  'refund-cancellation-policy': 'refund',
  'delivery-policy': 'delivery',
  'project-delivery-policy': 'delivery',
  'payment-policy': 'payment',
  'client-approval-policy': 'client-approval',
  'source-code-handover-policy': 'source-code-handover',
}

export function normalizeLegalSlug(slug?: string): string | undefined {
  if (!slug) return undefined
  const clean = slug.trim().toLowerCase()
  return LEGAL_SLUG_ALIASES[clean] ?? clean
}

export const HOME_ROUTE_INFO: PublicRouteInfo = {
  path: '/',
  title: 'TECH360 — Enterprise Software, CRM, AI & Business Automation',
  description:
    'TECH360 LLC builds custom websites, CRM systems, client portals, eCommerce platforms, and business workflow automation worldwide. Scoped in writing with HTML Preview where agreed and source-code handover after verified full payment.',
  kind: 'section',
}

const SECTIONS: Record<string, Omit<PublicRouteInfo, 'path'>> = {
  about: {
    title: 'About TECH360',
    description: 'Learn about TECH360 LLC, its engineering discipline, and the custom software systems it builds worldwide.',
    kind: 'section',
  },
  platform: {
    title: 'Company-in-a-Box Software Platform',
    description: 'Explore Company-in-a-Box: connected workflows, customer relationships, reporting, portals, and business systems tailored to your needs.',
    kind: 'section',
  },
  services: {
    title: 'Solutions & Engineering Services',
    description: 'Explore all 21 TECH360 software, AI, CRM, portal, eCommerce, cloud, and automation capabilities.',
    kind: 'section',
  },
  industries: {
    title: 'Industry Software Solutions',
    description: 'Explore TECH360’s 20 sector-specific operating architectures, domain workflows, modules, and compliance guardrails.',
    kind: 'section',
  },
  work: {
    title: 'Selected Work & Illustrative Project Scenarios',
    description: 'Illustrative software project scenarios and architecture blueprints demonstrating how TECH360 structures and delivers systems.',
    kind: 'section',
  },
  'work/projects': {
    title: 'Illustrative System Scenarios & Projects',
    description: 'Twelve representative web, CRM, eCommerce, portal, and automation project scenarios engineered by TECH360.',
    kind: 'section',
  },
  'work/case-studies': {
    title: 'Delivery Case Blueprints & Architecture Frameworks',
    description: 'Structured problem, architecture, governance, and handover frameworks across enterprise software engagements.',
    kind: 'section',
  },
  technologies: {
    title: 'Technologies, Cloud & Security Stack',
    description: 'Production technologies, databases, cloud infrastructure, and automation stack used by TECH360.',
    kind: 'section',
  },
  process: {
    title: '7-Step Customer Delivery Process',
    description: 'The seven customer delivery milestones, written SOW approvals, HTML preview gates, payment verification, and source-code handover standards of TECH360.',
    kind: 'section',
  },
  blog: {
    title: 'Engineering Insights',
    description: 'Published engineering, architecture, and delivery notes from TECH360.',
    kind: 'blog-index',
  },
  careers: {
    title: 'Careers at TECH360',
    description: 'Career information and open engineering and operations opportunities at TECH360 LLC.',
    kind: 'section',
  },
  contact: {
    title: 'Start a Project · Contact TECH360',
    description: 'Contact TECH360 LLC to scope a custom software, CRM, website, portal, or automation project.',
    kind: 'section',
  },
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about TECH360 project scoping, HTML previews, milestone payments, and source-code handover.',
    kind: 'section',
  },
  portal: {
    title: 'Client Portal',
    description: 'Sign in to the TECH360 client portal to review milestones, approvals, invoices, and handover files.',
    kind: 'portal',
    noIndex: true,
  },
  'design-kit': {
    title: 'Design Kit & UI Governance',
    description: 'Internal TECH360 design system tokens, typography, and component governance workspace.',
    kind: 'section',
    noIndex: true,
  },
  pipeline: {
    title: 'Our Delivery Process',
    description: 'Learn about the customer journey from enquiry and agreed scope to delivery and handover.',
    kind: 'section',
    noIndex: true,
  },
}

function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export function resolvePublicRoute(pathSegments: readonly string[]): PublicRouteInfo | null {
  const segments = pathSegments.filter(Boolean)
  if (segments.length === 0) {
    return HOME_ROUTE_INFO
  }

  const joined = segments.join('/')
  if (SECTIONS[joined]) {
    return { path: `/${joined}`, ...SECTIONS[joined] }
  }

  if (segments.length === 1) {
    const section = segments[0]
    if (section === 'legal') {
      // The hub has its own identity: reusing the Terms title made /legal and
      // /legal/terms indistinguishable to a crawler.
      return {
        path: '/legal',
        title: 'Legal & Project Policies',
        description: `${LEGAL_DOCS.length} published TECH360 policies: terms, privacy, refunds, delivery, payment, client approval and source-code handover.`,
        kind: 'legal',
      }
    }
    const route = SECTIONS[section]
    return route ? { path: `/${section}`, ...route } : null
  }

  if (segments.length === 3 && segments[0] === 'work' && segments[1] === 'projects') {
    // Dedicated project detail pages (Phase 4). Only slugs that exist in BOTH
    // the showcase gallery and the detail registry resolve, so a dangling link
    // is a 404 rather than an empty page.
    const slug = segments[2]
    const detail = getProjectDetail(slug)
    const example = WORK_EXAMPLES.find((item) => item.slug === slug)
    if (!isSlug(slug) || !detail || !example) return null
    return {
      path: `/work/projects/${slug}`,
      title: `${example.name} — Project Specification`,
      description: example.tagline,
      kind: 'project',
    }
  }

  if (segments.length === 2) {
    const [section, slug] = segments
    if (section === 'services') {
      const service = SERVICES.find((item) => item.slug === slug)
      return service
        ? { path: `/services/${service.slug}`, title: service.title, description: service.tagline, kind: 'service' }
        : null
    }
    if (section === 'industries') {
      const industry = INDUSTRIES.find((item) => item.slug === slug)
      if (!industry) return null
      const rich = getIndustryBySlug(industry.slug)
      return {
        path: `/industries/${industry.slug}`,
        title: industry.title,
        description: rich?.data.hero.subhead || industry.description,
        kind: 'industry',
      }
    }
    if (section === 'legal') {
      const mapped = normalizeLegalSlug(slug)
      const policy = LEGAL_DOCS.find((doc) => doc.slug === mapped)
      return policy
        ? { path: `/legal/${policy.slug}`, title: policy.title, description: policy.summary, kind: 'legal' }
        : null
    }
    if (section === 'blog' && isSlug(slug)) {
      return {
        path: `/blog/${slug}`,
        title: 'Engineering Insight',
        description: 'A published engineering insight from TECH360.',
        kind: 'blog-post',
      }
    }
  }

  return null
}

export function getStaticPublicRoutePaths(): string[] {
  const sections = [
    '/about',
    '/platform',
    '/services',
    '/industries',
    '/work',
    '/work/projects',
    '/work/case-studies',
    '/technologies',
    '/design-kit',
    '/process',
    '/pipeline',
    '/blog',
    '/careers',
    '/contact',
    '/legal',
    '/faq',
    '/portal',
  ]
  return [
    ...sections,
    ...SERVICES.map((service) => `/services/${service.slug}`),
    ...INDUSTRIES.map((industry) => `/industries/${industry.slug}`),
    ...LEGAL_DOCS.map((policy) => `/legal/${policy.slug}`),
    ...PROJECT_DETAILS.map((project) => `/work/projects/${project.slug}`),
  ]
}
