import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { SERVICES, INDUSTRIES } from '@/data/site'
import { featureEnabled } from '@/lib/features'

// ------------------------------------------------------------
// TECH360 sitemap — real routes only (the public SPA renders these
// hash paths). Published blog posts are included while the blog
// feature is ON; when Super Admin switches the blog off, its URLs
// are omitted honestly rather than shipped as dead links.
// ------------------------------------------------------------

const SITE_URL = (process.env.APP_PUBLIC_URL ?? 'https://bdtech360.com').replace(/\/+$/, '')
const now = new Date()

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogOn = await featureEnabled('blog')

  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/industries`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/work`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/technologies`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/process`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/careers`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const services: MetadataRoute.Sitemap = SERVICES.map((s) => ({
    url: `${SITE_URL}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const industries: MetadataRoute.Sitemap = INDUSTRIES.map((i) => ({
    url: `${SITE_URL}/industries/${i.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const posts: MetadataRoute.Sitemap = blogOn
    ? (
        await db.blogPost
          .findMany({
            where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
            orderBy: { publishedAt: 'desc' },
            select: { slug: true, publishedAt: true },
          })
          .catch(() => [])
      ).map((p) => ({
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: p.publishedAt ?? now,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    : []

  return [...core, ...services, ...industries, ...posts]
}
