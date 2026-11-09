'use client'

import { Suspense, lazy } from 'react'
import { Palette } from 'lucide-react'

const PublicDesignKit = lazy(() => import('@/components/site/DesignKitView'))

/**
 * Design Kit — the production design system, opened from the authenticated
 * operator console instead of a public URL.
 *
 * ACCESS: rendered only inside `AdminApp`, which resolves the operator session
 * and applies `canAccessAdminView(role, 'designKit')` (ADMIN and above) before
 * this component mounts. The public `/design-kit` path therefore resolves as a
 * no-index operator surface rather than an anonymous page.
 *
 * The content itself is the same live component set the website ships, so the
 * tokens, diagrams and controls reviewed here are the ones in production.
 */
export function DesignKitView() {
  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#009FE3]/15 text-[#7FD4FF]">
            <Palette className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">Design Kit &amp; UI Governance</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
              The production design system rendered live from the same components the public
              website ships — colour tokens, type scale, action hierarchy, data diagrams and
              product-surface mockups. Changes reviewed here must be made in the source
              components; this view never renders a copy.
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Restricted surface · visible to ADMIN and SUPER_ADMIN operators only
            </p>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white">
        <Suspense
          fallback={
            <div className="p-8 text-sm text-slate-500" role="status">
              Loading the design system…
            </div>
          }
        >
          <PublicDesignKit />
        </Suspense>
      </div>
    </div>
  )
}

export default DesignKitView
