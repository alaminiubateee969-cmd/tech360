import Link from 'next/link'

/**
 * Site-wide 404. Rendered by the App Router for any unmatched path, and by
 * `src/app/[...path]/page.tsx` when `resolvePublicRoute()` rejects a route.
 *
 * Kept as a Server Component so the 404 still ships a real <h1>, a real
 * <main id="main-content"> landmark and usable links even when JavaScript
 * fails to boot.
 */
export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-[#F7FAFC] px-5 py-20 outline-none"
    >
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#009FE3]">404 · Page not found</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
          This page is not available.
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
          The address may be outdated or mistyped. Browse the solutions and industries we publish, or start a
          project enquiry.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white transition hover:bg-[#052f72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
          >
            Return home
          </Link>
          <Link
            href="/services"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-[#063B8F] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
          >
            All 21 solutions
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-[#063B8F] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
          >
            Start a project
          </Link>
        </div>
      </section>
    </main>
  )
}
