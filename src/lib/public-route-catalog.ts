import { INDUSTRIES, LEGAL_DOCS, SERVICES } from '@/data/site'

export type PublicRouteKind = 'section' | 'service' | 'industry' | 'legal' | 'blog-index' | 'blog-post' | 'portal'

export type PublicRouteInfo = {
  path: string
  title: string
  description: string
  kind: PublicRouteKind
  noIndex?: boolean
}

const SECTIONS: Record<string, Omit<PublicRouteInfo, 'path'>> = {
  about: { title: 'About Tech360', description: 'Learn about TECH360 LLC, its delivery approach, and the systems it builds.', kind: 'section' },
  services: { title: 'Software and Automation Services', description: 'Explore the software, website, CRM, portal, and automation services described by Tech360.', kind: 'section' },
  industries: { title: 'Industries', description: 'Explore Tech360’s industry-specific system patterns and service starting points.', kind: 'section' },
  work: { title: 'Illustrative Project Scenarios', description: 'Illustrative software project scenarios. They are not audited customer case studies or measured results.', kind: 'section' },
  technologies: { title: 'Technology Stack', description: 'Technology categories and tools described on the Tech360 website.', kind: 'section' },
  'design-kit': { title: 'Design Kit', description: 'A visual reference for the Tech360 website design system.', kind: 'section' },
  process: { title: 'Delivery Process', description: 'The delivery stages, client approvals, and review gates described by Tech360.', kind: 'section' },
  blog: { title: 'Engineering Insights', description: 'Published engineering and delivery notes from Tech360.', kind: 'blog-index' },
  careers: { title: 'Careers', description: 'Career information and opportunities published by Tech360.', kind: 'section' },
  contact: { title: 'Contact Tech360', description: 'Contact TECH360 LLC about a project or service enquiry.', kind: 'section' },
  faq: { title: 'Frequently Asked Questions', description: 'Answers to common questions about Tech360 services and delivery.', kind: 'section' },
  portal: { title: 'Client Portal', description: 'Sign in to the Tech360 client portal.', kind: 'portal', noIndex: true },
}

function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export function resolvePublicRoute(pathSegments: readonly string[]): PublicRouteInfo | null {
  const segments = pathSegments.filter(Boolean)
  if (segments.length === 1) {
    const section = segments[0]
    if (section === 'legal') {
      const terms = LEGAL_DOCS.find((doc) => doc.slug === 'terms')
      if (!terms) return null
      return { path: '/legal', title: terms.title, description: terms.summary, kind: 'legal' }
    }
    const route = SECTIONS[section]
    return route ? { path: `/${section}`, ...route } : null
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
      return industry
        ? { path: `/industries/${industry.slug}`, title: industry.title, description: industry.description, kind: 'industry' }
        : null
    }
    if (section === 'legal') {
      const policy = LEGAL_DOCS.find((doc) => doc.slug === slug)
      return policy
        ? { path: `/legal/${policy.slug}`, title: policy.title, description: policy.summary, kind: 'legal' }
        : null
    }
    if (section === 'blog' && isSlug(slug)) {
      return { path: `/blog/${slug}`, title: 'Engineering Insight', description: 'A published engineering insight from Tech360.', kind: 'blog-post' }
    }
  }

  return null
}

export function getStaticPublicRoutePaths(): string[] {
  const sections = [
    '/about', '/services', '/industries', '/work', '/technologies', '/design-kit',
    '/process', '/blog', '/careers', '/contact', '/legal', '/faq', '/portal',
  ]
  return [
    ...sections,
    ...SERVICES.map((service) => `/services/${service.slug}`),
    ...INDUSTRIES.map((industry) => `/industries/${industry.slug}`),
    ...LEGAL_DOCS.map((policy) => `/legal/${policy.slug}`),
  ]
}
