import type { Metadata } from 'next'

/**
 * Operator console metadata.
 *
 * These are authenticated, role-gated surfaces (see `src/lib/api-guard.ts` and
 * the middleware). They must never be indexed: a crawler that reached one would
 * otherwise publish a marketing-style title plus `robots: index, follow`
 * inherited from the root layout, and the canonical would point at the
 * homepage.
 *
 * `robots.txt` and `X-Robots-Tag` (see `next.config.ts`) express the same
 * preference at other layers; this is the document-level signal. None of them
 * is an access control — the API guards are.
 */
export const metadata: Metadata = {
  title: 'Operator Console — TECH360',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
