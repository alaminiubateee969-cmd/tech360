import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Tech360 — Enterprise Software, Automation & Digital Transformation',
    template: '%s | Tech360',
  },
  description: 'Tech360 (TECH360 LLC) builds enterprise-grade websites, eCommerce platforms, custom CRMs, WhatsApp automation, n8n workflows and AI systems. HTML Preview Before Payment. US-registered LLC delivering worldwide.',
  keywords: ['software company', 'enterprise software', 'web development', 'eCommerce development', 'CRM development', 'WhatsApp automation', 'n8n automation', 'AI agents', 'Google Cloud', 'digital transformation', 'Tech360', 'bdtech360'],
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
    description: 'Enterprise-grade websites, platforms and automation for ambitious businesses. HTML Preview Before Payment · Source Code After Full Payment.',
    images: [{ url: '/images/tech360-banner.jpg', width: 1200, height: 630, alt: 'Tech360 — Enterprise Software Company' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tech360 — Enterprise Software, Automation & Growth',
    description: 'Enterprise-grade websites, platforms and automation. HTML Preview Before Payment.',
    images: ['/images/tech360-banner.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [{ url: '/images/tech360-logo-sm.png', type: 'image/png' }],
    apple: [{ url: '/images/tech360-logo-sm.png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#063B8F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-[#0B1F33] antialiased">
        {children}
      </body>
    </html>
  )
}
