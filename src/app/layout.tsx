import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SERVICES, FAQS } from '@/data/site'
import WebMCPTools from '@/components/site/WebMCPTools'

const SITE_URL = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TECH360 — Enterprise Software, Automation & Digital Transformation',
    template: '%s | TECH360',
  },
  description: 'TECH360 LLC builds websites, eCommerce platforms, custom CRMs, AI-assisted applications, and business automation. Project scope, payment, delivery, and support are agreed in writing.',
  keywords: ['software company', 'enterprise software', 'web development', 'eCommerce development', 'CRM development', 'WhatsApp AI CRM', 'WhatsApp sales CRM', 'WhatsApp automation', 'n8n automation', 'business automation', 'Google Cloud', 'digital transformation', 'Tech360', 'bdtech360'],
  applicationName: 'Tech360',
  authors: [{ name: 'TECH360 LLC' }],
  creator: 'TECH360 LLC',
  publisher: 'TECH360 LLC',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Tech360',
    title: 'Tech360 — Strategy. Software. Automation. Growth.',
    description: 'Enterprise-grade websites, platforms and automation for ambitious businesses. Project-specific scope, approvals, payment, delivery and handover.',
    images: [{ url: '/images/tech360-banner.jpg', width: 1200, height: 630, alt: 'Tech360 — Enterprise Software Company' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tech360 — Enterprise Software, Automation & Growth',
    description: 'Enterprise-grade websites, platforms and automation. Project-specific scope, approvals, payment, delivery and handover.',
    images: ['/images/tech360-banner.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Canonical on every page that does not override it (the homepage), plus a
  // declared Markdown alternate for content-negotiating agents (see src/proxy.ts).
  alternates: {
    canonical: '/',
    types: { 'text/markdown': '/' },
  },
  icons: {
    icon: [{ url: '/brand/tech360-logo-original.jpg', type: 'image/jpeg' }],
    apple: [{ url: '/brand/tech360-logo-original.jpg' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#063B8F',
}

// Structured data (schema.org) — free, self-hosted SEO; no external API.
// Types: Organization (+sameAs), WebSite, WebPage, FAQPage, Service, Blog.
const ORG_ID = `${SITE_URL}/#organization`
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: 'TECH360 LLC',
      alternateName: 'Tech360',
      url: SITE_URL,
      logo: `${SITE_URL}/tech360-logo.png`,
      email: 'info@bdtech360.com',
      telephone: '+1-816-380-8660',
      address: { '@type': 'PostalAddress', streetAddress: '117 S Lexington St Ste 100', addressLocality: 'Harrisonville', addressRegion: 'MO', postalCode: '64701', addressCountry: 'US' },
      // Profiles that describe this same entity. Add verified social/directory
      // profiles here as soon as they are published.
      sameAs: [
        SITE_URL,
        'https://github.com/alaminiubateee969-cmd/tech360',
        `${SITE_URL}/rss.xml`,
      ],
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Tech360', publisher: { '@id': ORG_ID }, inLanguage: 'en' },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: 'TECH360 — Enterprise Software, Automation & Digital Transformation',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': ORG_ID },
      inLanguage: 'en',
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/faq#faqpage`,
      url: `${SITE_URL}/faq`,
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    ...SERVICES.map((s) => ({
      '@type': 'Service',
      '@id': `${SITE_URL}/services/${s.slug}#service`,
      name: s.title,
      description: s.tagline,
      url: `${SITE_URL}/services/${s.slug}`,
      serviceType: s.title,
      provider: { '@id': ORG_ID },
    })),
    {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      url: `${SITE_URL}/blog`,
      name: 'Engineering Insights',
      description: 'Published engineering and delivery notes from Tech360.',
      publisher: { '@id': ORG_ID },
      inLanguage: 'en',
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-[#0B1F33] antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
        <WebMCPTools />
        {children}
      </body>
    </html>
  )
}
