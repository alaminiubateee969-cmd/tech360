import type { Metadata, Viewport } from 'next'
import './globals.css'
import WebMCPTools from '@/components/site/WebMCPTools'
import RouteStructuredData from '@/components/site/RouteStructuredData'
import { jsonLdDocument, siteGraph } from '@/lib/structured-data'

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
    // Absolute so the homepage canonical is exactly https://bdtech360.com/
    canonical: `${SITE_URL}/`,
    types: {
      'text/markdown': '/',
      'application/rss+xml': '/rss.xml',
    },
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

// Structured data (schema.org): Organization, WebSite, WebPage, FAQPage,
// Service, SoftwareApplication, Blog. Owned by src/lib/structured-data.ts so the
// @id values match the per-page graphs rendered by RouteStructuredData.
const JSON_LD = jsonLdDocument(siteGraph())

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-[#0B1F33] antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
        <RouteStructuredData siteUrl={SITE_URL} />
        <WebMCPTools />
        {children}
      </body>
    </html>
  )
}
