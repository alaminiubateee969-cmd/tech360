'use client'

/** Authenticated workspace directory for provisioned company applications. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Boxes, Building2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'

type Row = {
  id: string; code: string; name: string; status: string; environment: string
  releaseVersion: string; healthStatus: string; deploymentModel: string; createdAt: string
  url: string | null
  company: { name: string; code: string; slug: string; kind: string; industry: string | null } | null
  grant: { role: string; privileged: boolean; expiresAt: string | null } | null
}
type List = { ok: boolean; applications: Row[]; grants: number; companies: number; generatedAt: string; fact?: string }

export default function MyApplicationsPage() {
  const [data, setData] = useState<List | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/factory/runtime', { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({})) as List & { reason?: string; error?: string }
        if (!res.ok) throw new Error(body.reason ?? body.error ?? 'Authentication is required to access this workspace.')
        return body
      })
      .then((body) => { if (active) { setData(body); setLoading(false) } })
      .catch((e: unknown) => { if (active) { setError(e instanceof Error ? e.message : 'Authentication is required to access this workspace.'); setLoading(false) } })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#F4FAFF', color: '#0B1F33' }}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin" />
          Verifying workspace access…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#F4FAFF', color: '#0B1F33' }}>
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <LockKeyhole className="size-4 text-[#063B8F]" />
            Restricted Workspace
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{error || 'Sign in with an authorized account to view assigned applications.'}</p>
          <Link href="/" className="mt-4 inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
            Return to website
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full" style={{ background: '#F4FAFF', color: '#0B1F33' }}>
      <header className="border-b border-[#063B8F]/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#063B8F] text-white">
              <Boxes className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">TECH360 Application Workspace</p>
              <p className="text-[11px] text-slate-500">Authorized organization portal</p>
            </div>
          </div>
          <Link href="/" className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700">
            Public site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">Assigned Environments</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your applications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Select an authorized organization workspace below. Access is scoped strictly to your active membership grants.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[{ label: 'Applications', value: data.applications.length }, { label: 'Organizations', value: data.companies }, { label: 'Active grants', value: data.grants }].map((c) => (
            <div key={c.label} className="rounded-xl border border-[#063B8F]/10 bg-white p-4">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold text-[#063B8F]">{c.value}</p>
            </div>
          ))}
        </div>
        {data.applications.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No applications are currently assigned to your account. Contact your organization administrator if you require access.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {data.applications.map((app) => (
              <Link key={app.id} href={app.url ?? '#'} className="group rounded-2xl border border-[#063B8F]/10 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#063B8F]/8 text-[#063B8F]">
                    <Building2 className="size-5" />
                  </div>
                  <span className="rounded-full bg-[#063B8F]/8 px-2.5 py-1 text-[10px] font-semibold text-[#063B8F]">
                    {app.status} · {app.environment}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold group-hover:text-[#009FE3]">{app.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {app.company?.name ?? 'Organization'} · {app.company?.industry ?? app.company?.kind ?? 'Business'} · v{app.releaseVersion}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-1">{app.deploymentModel}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">{app.healthStatus}</span>
                  <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                    <ShieldCheck className="size-3" />
                    {app.grant?.role ?? 'GRANT'}
                  </span>
                </div>
                <p className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-[#063B8F]">
                  Open application <ArrowRight className="size-3 transition group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
