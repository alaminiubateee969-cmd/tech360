import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicSitePage from '../page'
import type { BlogPost } from '@/components/site/BlogPostView'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '@/lib/public-route-catalog'

export const dynamicParams = true

export function generateStaticParams(): Array<{ path: string[] }> {
  return getStaticPublicRoutePaths().map((path) => ({ path: path.split('/').filter(Boolean) }))
}

async function publishedBlogPost(slug: string) {
  const { featureEnabled } = await import('@/lib/features')
  if (!(await featureEnabled('blog'))) return null
  const { db } = await import('@/lib/db')
  return db.blogPost.findFirst({
    where: { slug, status: 'PUBLISHED', publishedAt: { lte: new Date() } },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      category: true,
      author: true,
      publishedAt: true,
    },
  })
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params
  const route = resolvePublicRoute(path)
  if (!route) return { title: 'Page not found', robots: { index: false, follow: false } }

  if (route.kind === 'blog-post') {
    try {
      const post = await publishedBlogPost(path[1])
      if (!post) return { title: 'Article not found', robots: { index: false, follow: false } }
      return {
        title: post.title,
        description: post.excerpt ?? 'A published engineering insight from TECH360.',
        alternates: { canonical: route.path },
        openGraph: { type: 'article', url: route.path, title: post.title, description: post.excerpt ?? undefined },
      }
    } catch {
      return { title: 'Engineering Insight', robots: { index: false, follow: false } }
    }
  }

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: route.path },
    robots: route.noIndex ? { index: false, follow: false } : undefined,
    openGraph: { type: 'website', url: route.path, title: route.title, description: route.description },
  }
}

export default async function PublicPathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const route = resolvePublicRoute(path)
  if (!route) notFound()

  let initialBlogPost: BlogPost | null = null
  if (route.kind === 'blog-post') {
    try {
      const found = await publishedBlogPost(path[1])
      if (!found) notFound()
      initialBlogPost = {
        slug: found.slug,
        title: found.title,
        excerpt: found.excerpt ?? '',
        content: found.content,
        category: found.category ?? 'Engineering',
        author: found.author ?? 'TECH360 Engineering',
        publishedAt: (found.publishedAt ?? new Date()).toISOString(),
      }
    } catch {
      notFound()
    }
  }

  return <PublicSitePage initialHash={route.path} initialBlogPost={initialBlogPost} />
}
