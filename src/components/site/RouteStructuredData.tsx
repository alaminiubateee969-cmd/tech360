'use client'

import { useEffect } from 'react'
import { pageGraph } from '@/lib/structured-data'

/**
 * Per-route structured data.
 *
 * The static site graph in the root layout describes the site (Organization,
 * WebSite, Service catalogue, Blog). This component appends ONE `@graph`
 * document describing the page the visitor is actually on — WebPage,
 * BreadcrumbList, and (where the mark-up is backed by visible content) FAQPage,
 * Service, SoftwareApplication or Article nodes.
 *
 * Why client-side: the public site is a single-document application whose real
 * content is chosen from the URL fragment. Only the browser knows which page is
 * being displayed, so the page-level graph is written after hydration. The
 * crawlable canonical document for each route is the server-rendered
 * `/[...path]` page, which emits the same node set through
 * `src/app/[...path]/page.tsx` — both paths read the same
 * `src/lib/structured-data.ts` module, so the two representations cannot drift.
 *
 * Rules:
 *  - The node is replaced (never appended twice) on every transition, so the
 *    document never carries duplicate or contradictory graphs.
 *  - Private surfaces (portal, admin, pipeline, design-kit) return `null` from
 *    `pageGraph` and the script is removed entirely.
 *  - Nothing is emitted for a route that has no public representation.
 */
export default function RouteStructuredData({ siteUrl }: { siteUrl: string }) {
  useEffect(() => {
    const SCRIPT_ID = 't360-route-jsonld'

    const sync = () => {
      const hash = window.location.hash.replace(/^#/, '') || '/'
      const pathname = '/' + hash.split('?')[0].split('/').filter(Boolean).join('/')
      const existing = document.getElementById(SCRIPT_ID)

      // Pull the visible page title/description so the JSON-LD never describes
      // content that is not on the page.
      const title = document.title.replace(/\s*\|\s*TECH360$/, '').trim()
      const description =
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? ''

      const nodes = pathname === '/' ? null : pageGraph(pathname, { title, description })

      if (!nodes || nodes.length === 0) {
        existing?.remove()
        return
      }

      const script = (existing as HTMLScriptElement | null) ?? document.createElement('script')
      script.id = SCRIPT_ID
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': nodes,
      }).replace(/</g, '\\u003c')
      if (!existing) document.head.appendChild(script)
    }

    sync()
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      document.getElementById(SCRIPT_ID)?.remove()
    }
  }, [siteUrl])

  return null
}
