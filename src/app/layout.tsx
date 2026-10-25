<<<<<<< HEAD
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
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'TECH360 LLC',
      alternateName: 'Tech360',
      url: SITE_URL,
      logo: `${SITE_URL}/tech360-logo.png`,
      email: 'info@bdtech360.com',
      telephone: '+1-816-380-8660',
      address: { '@type': 'PostalAddress', streetAddress: '117 S Lexington St Ste 100', addressLocality: 'Harrisonville', addressRegion: 'MO', postalCode: '64701', addressCountry: 'US' },
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Tech360', publisher: { '@id': `${SITE_URL}/#organization` }, inLanguage: 'en' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-[#0B1F33] antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
        {children}
      </body>
    </html>
  )
=======
import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NextAuthProvider } from "@/components/providers/next-auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech360 — AI-Powered Business Operating System",
  description:
    "Strategy. Software. Automation. Growth. Tech360 is the operating system your business deserves — CRM, AI Command Center, WhatsApp & Social automation, and AgentOS workflows in one platform.",
  keywords: [
    "Tech360",
    "AI Business OS",
    "CRM",
    "AI Agents",
    "WhatsApp Business",
    "Workflow Automation",
    "Bangladesh software company",
    "bdtech360",
  ],
  authors: [{ name: "Tech360" }],
  openGraph: {
    title: "Tech360 — AI-Powered Business Operating System",
    description:
      "Strategy. Software. Automation. Growth. The operating system your business deserves.",
    siteName: "Tech360",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech360 — AI-Powered Business Operating System",
    description:
      "Strategy. Software. Automation. Growth.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${inter.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextAuthProvider>
            <QueryProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </QueryProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
>>>>>>> upload/tech360-production-final
}
