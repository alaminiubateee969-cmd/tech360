'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the diagnostic in server/browser logs without exposing its details in the UI.
    console.error('Tech360 page error', error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7FAFC] px-6 text-[#0B1F33]">
      <section role="alert" className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-600">Something went wrong</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">We could not load this page.</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
          No information was lost. Try the request again, or return to the homepage if the problem continues.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white transition hover:bg-[#052f72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">
            Try again
          </button>
          <a href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-[#063B8F] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">
            Return home
          </a>
        </div>
      </section>
    </main>
  )
}
