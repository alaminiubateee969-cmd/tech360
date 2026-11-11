import type { MetadataRoute } from 'next'
import { INDUSTRIES, LEGAL_DOCS, SERVICES } from '@/data/site'
import { PROJECT_DETAILS } from '@/data/work-details'
import { listPublishedBlogSlugs } from '@/lib/public-blog'
import { SITE_URL } from '@/lib/site-contact'

// ------------------------------------------------------------
// TECH360 sitemap — clean public paths served by src/app/[...path]/page.tsx.
//
// Portal, design-kit and pipeline are authenticated operator surfaces and are
// deliberately EXCLUDED (they also carry noindex). Published blog posts are
// included only while the blog feature flag is ON.
// ------------------------------------------------------------

type StaticEntry = {
  path: string
  priority: number
  freq: MetadataRoute.Sitemap[number]['changeFrequency']
}

const STATIC_PATHS: StaticEntry[] = [
  { path: '', priority: 1.0, freq: 'weekly' },
  { path: '/platform', priority: 0.9, freq: 'monthly' },
  { path: '/services', priority: 0.9, freq: 'weekly' },
  { path: '/industries', priority: 0.9, freq: 'weekly' },
  { path: '/work', priority: 0.8, freq: 'monthly' },
  { path: '/work/projects', priority: 0.7, freq: 'monthly' },
  { path: '/work/case-studies', priority: 0.7, freq: 'monthly' },
  { path: '/process', priority: 0.8, freq: 'monthly' },
  { path: '/technologies', priority: 0.7, freq: 'monthly' },
  { path: '/about', priority: 0.7, freq: 'monthly' },
  { path: '/blog', priority: 0.8, freq: 'weekly' },
  { path: '/careers', priority: 0.6, freq: 'monthly' },
  { path: '/contact', priority: 0.8, freq: 'monthly' },
  { path: '/faq', priority: 0.6, freq: 'monthly' },
  { path: '/legal', priority: 0.4, freq: 'yearly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const blogPosts = await listPublishedBlogSlugs()

  return [
    ...STATIC_PATHS.map((r) => ({
      url: `${SITE_URL}${r.path}`,
      lastModified: now,
      changeFrequency: r.freq,
      priority: r.priority,
    })),
    ...SERVICES.map((s) => ({
      url: `${SITE_URL}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...PROJECT_DETAILS.map((p) => ({
      url: `${SITE_URL}/work/projects/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...INDUSTRIES.map((i) => ({
      url: `${SITE_URL}/industries/${i.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    })),
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE_URL}/legal/${doc.slug}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.4,
    })),
    // Blog posts are only ever meaningful while the blog switch is ON.
    ...(blogPosts.length
      ? blogPosts.map((post) => ({
          url: `${SITE_URL}/blog/${post.slug}`,
          lastModified: post.updatedAt,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }))
      : [{ url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.5 }]),
  ]
}
