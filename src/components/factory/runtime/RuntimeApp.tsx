'use client'

/**
 * BDTECH360 Software Factory — ONE renderer for MANY applications.
 *
 * This component contains no company-specific code and no hardcoded business
 * data. It reads the versioned configuration (theme, pages, navigation,
 * modules, fields) from the private runtime API and renders the resulting
 * application. Records, files, workflow transitions, reports, health and the
 * executable acceptance suite are all real server-side operations.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowRight, BadgeCheck, Boxes, ChevronDown, CircleAlert, Clock3, Database,
  FileText, Gauge, Layers3, LayoutDashboard, List, Loader2, LockKeyhole, PanelLeftClose,
  PlayCircle, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud, Workflow,
} from 'lucide-react'
import { getCsrf } from '@/lib/admin-client'

type Json = Record<string, unknown>
type EntityField = { key: string; label: string; type: string; required?: boolean }
type Entity = { key: string; label: string; fields: EntityField[] }
type ModuleView = { code: string; name: string; capability: string; semver: string; enabled: boolean; entities: Entity[]; permissions: string[]; dependencies: string[] }
type PageView = { key: string; label: string; kind: string; module?: string; entityType?: string; description: string; metrics?: string[] }
type Theme = { primary: string; accent: string; surface?: string; background?: string; text?: string; muted?: string; motif?: string; radius?: string; density?: string }
type RecordRow = { id: string; moduleKey: string; entityType: string; data: Json; createdBy?: string | null; createdAt: string }
type FileRow = { id: string; name: string; mimeType: string; sizeBytes: number; checksum: string; uploadedBy?: string | null; createdAt: string }
type AuditRow = { id: string; action: string; decision?: string; actor?: string; createdAt: string; targetType?: string }
type CheckRow = { key: string; label: string; ok: boolean; detail: string }

type State = {
  ok: boolean
  company: { id: string; code: string; slug: string; name: string; kind: string; industry: string | null; status: string }
  application: { id: string; code: string; name: string; status: string; environment: string; releaseVersion: string; healthStatus: string; configChecksum: string; deploymentModel: string; domain: string | null }
  template: { code: string; name: string; version: number | null }
  theme: Theme
  pages: PageView[]
  config: { navigation: string[]; branding?: Json; workflows?: { pipelines?: string[] }; modules?: Array<{ code: string; version: number; semver: string; enabled: boolean }> } & Json
  modules: ModuleView[]
  access: { role: string; level: string; privileged: boolean }
  records: RecordRow[]
  files: FileRow[]
  audits: AuditRow[]
  releases: Array<{ id: string; code: string; kind: string; status: string; toVersion: string; createdAt: string }>
  checks: Array<{ id: string; status: string; checkedAt: string }>
  jobs: Array<{ id: string; code: string; action: string; status: string; createdAt: string }>
  backups: Array<{ id: string; code: string; kind: string; status: string; verifiedAt: string | null; createdAt: string }>
  counts: { records: number; files: number; modules: number; enabledModules: number; pages: number }
  aggregates: { byModule: Array<{ module: string; count: number }>; byEntity: Array<{ entity: string; count: number }> }
  fact: string
  generatedAt: string
}

type ApiResponse = { ok?: boolean; code?: string; reason?: string; data?: Json; [key: string]: unknown }

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function when(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{3,8}$/.test(clean)) return `rgba(0,120,200,${alpha})`
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6)
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const KIND_ICON: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, list: List, board: Workflow, gallery: Layers3,
  report: Activity, form: FileText, timeline: Clock3,
}

export function RuntimeApp({ slug }: { slug: string }) {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [pageKey, setPageKey] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const [checks, setChecks] = useState<CheckRow[] | null>(null)
  const [report, setReport] = useState<Array<{ module: string; entity: string; count: number }> | null>(null)
  const [form, setForm] = useState<Json>({})
  const [sidebar, setSidebar] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/factory/runtime/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const data = await res.json() as ApiResponse & State
      if (!res.ok || !data.ok) throw new Error(String(data.reason ?? data.code ?? 'Unable to open this application'))
      setState(data as unknown as State)
      setError('')
      setPageKey((prev) => (prev && data.pages?.some((p) => p.key === prev) ? prev : (data.pages?.[0]?.key ?? '')))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open this application')
      setState(null)
    } finally { setLoading(false) }
  }, [slug])

  useEffect(() => { void load() }, [load])

  const act = useCallback(async (action: string, payload: Json = {}): Promise<ApiResponse> => {
    setBusy(action)
    setNotice(null)
    try {
      const res = await fetch(`/api/factory/runtime/${encodeURIComponent(slug)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf() },
        body: JSON.stringify({ action, payload }),
      })
      const data = await res.json() as ApiResponse
      const d = (data.data ?? data) as Json
      if (action === 'tests.run' && Array.isArray(d.checks)) setChecks(d.checks as unknown as CheckRow[])
      if (action === 'report.run' && Array.isArray(d.lines)) setReport(d.lines as unknown as Array<{ module: string; entity: string; count: number }>)
      if (!data.ok) {
        setNotice({ tone: 'warn', text: `${data.code ?? 'ACTION_FAILED'}: ${data.reason ?? 'The action was refused'}` })
        await load()
        return data
      }
      if (action === 'record.create') {
        setForm({})
        setNotice({ tone: 'ok', text: 'Record created in the company-scoped module.' })
      } else if (action === 'tests.run') {
        setNotice({ tone: 'ok', text: `Executable acceptance suite: ${String(d.passed ?? 0)} passed, ${String(d.failed ?? 0)} failed. Results persisted as a test job.` })
      } else if (action === 'health.run') {
        setNotice({ tone: 'ok', text: `Health checks recomputed: ${String(d.status ?? 'UNKNOWN')}.` })
      } else if (action === 'file.upload') {
        setNotice({ tone: 'ok', text: 'File stored with a checksum and company scope.' })
      } else if (action === 'workflow.advance') {
        setNotice({ tone: 'ok', text: `Workflow moved to ${String(d.next ?? 'next stage')}.` })
      } else if (action === 'record.delete') {
        setNotice({ tone: 'ok', text: 'Record removed.' })
      }
      if (action !== 'state' && action !== 'report.run') await load()
      return data
    } catch (e) {
      setNotice({ tone: 'warn', text: e instanceof Error ? e.message : 'Action failed' })
      return { ok: false }
    } finally { setBusy('') }
  }, [slug, load])

  const theme = state?.theme
  const cssVars = useMemo(() => {
    const t = theme
    if (!t) return {} as React.CSSProperties
    return {
      '--app-primary': t.primary, '--app-accent': t.accent, '--app-surface': t.surface ?? '#FFFFFF',
      '--app-bg': t.background ?? '#F4FAFF', '--app-text': t.text ?? '#0B1F33', '--app-muted': t.muted ?? '#526173',
      '--app-line': hexToRgba(t.primary, 0.13), '--app-tint': hexToRgba(t.accent, 0.12), '--app-primary-fade': hexToRgba(t.primary, 0.08),
    } as React.CSSProperties
  }, [theme])

  if (loading && !state) {
    return <div className="flex min-h-screen items-center justify-center" style={{ background: '#F4FAFF' }} role="status">
      <div className="flex flex-col items-center gap-3"><Loader2 className="size-8 animate-spin" style={{ color: '#063B8F' }} /><p className="text-sm text-slate-500">Opening your application…</p></div>
    </div>
  }
  if (error || !state) {
    return <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#F4FAFF' }}>
      <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2 text-amber-700"><CircleAlert className="size-5" /><p className="font-semibold">Application unavailable</p></div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{error || 'This company application could not be resolved.'}</p>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Access requires an explicit, active company grant. Factory administrators do not automatically receive access to private business data.</p>
        <div className="mt-5 flex gap-3"><Link href="/factory/apps" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white">My applications</Link><button onClick={() => void load()} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700">Retry</button></div>
      </div>
    </div>
  }

  const page = state.pages.find((p) => p.key === pageKey) ?? state.pages[0]
  const Icon = KIND_ICON[page?.kind ?? ''] ?? LayoutDashboard
  const activeModule = page?.module ? state.modules.find((m) => m.code === page.module) : undefined
  const entity = activeModule?.entities.find((e) => e.key === page?.entityType) ?? activeModule?.entities[0]
  const pageRecords = state.records.filter((r) => {
    if (page?.kind === 'dashboard' || page?.kind === 'report' || page?.kind === 'timeline') return false
    if (!page?.module) return true
    return r.moduleKey === page.module && (!page.entityType || r.entityType === page.entityType || !activeModule?.entities.length)
  })
  const spacing = theme?.density === 'compact' ? 'compact' : 'comfortable'
  const radius = theme?.radius === 'sharp' ? '6px' : '16px'

  return (
    <div style={{ ...cssVars, background: 'var(--app-bg)', color: 'var(--app-text)', minHeight: '100vh' }} className="w-full">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md sm:px-6" style={{ borderColor: 'var(--app-line)', background: hexToRgba(theme?.surface ?? '#FFFFFF', 0.92) }}>
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setSidebar((v) => !v)} className="rounded-lg border p-2 lg:hidden" style={{ borderColor: 'var(--app-line)' }} aria-label="Toggle navigation"><PanelLeftClose className="size-4" /></button>
          <div className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: 'var(--app-primary)' }}><Sparkles className="size-4" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{state.application.name}</p>
            <p className="truncate text-[11px]" style={{ color: 'var(--app-muted)' }}>{state.company.name} · {state.company.code} · {state.template.name} v{state.template.version ?? 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide sm:inline" style={{ background: 'var(--app-primary-fade)', color: 'var(--app-primary)' }}>{state.application.status} · {state.application.environment}</span>
          <span className="hidden rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline" style={{ background: state.application.healthStatus === 'HEALTHY' ? hexToRgba('#16A34A', 0.12) : hexToRgba('#D97706', 0.12), color: state.application.healthStatus === 'HEALTHY' ? '#15803D' : '#B45309' }}>{state.application.healthStatus}</span>
          <span className="hidden rounded-full border px-2.5 py-1 text-[10px] font-mono md:inline" style={{ borderColor: 'var(--app-line)', color: 'var(--app-muted)' }}>v{state.application.releaseVersion}</span>
          <button onClick={() => void load()} disabled={loading} className="rounded-lg border p-2 transition hover:opacity-70" style={{ borderColor: 'var(--app-line)' }} aria-label="Refresh"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Sidebar */}
        {sidebar && <aside className="hidden w-64 shrink-0 border-r px-3 py-5 lg:block" style={{ borderColor: 'var(--app-line)' }}>
          <div className="mb-5 rounded-xl p-4" style={{ background: 'var(--app-primary)', color: '#fff' }}>
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">Private workspace</p>
            <p className="mt-1 text-sm font-semibold leading-snug">{state.company.name}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] opacity-80"><LockKeyhole className="size-3" /> Grant: {state.access.role} · {state.access.level}</p>
          </div>
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--app-muted)' }}>Application pages</p>
          <nav className="space-y-1">
            {state.pages.map((p) => {
              const PIcon = KIND_ICON[p.kind] ?? LayoutDashboard
              const active = p.key === page?.key
              return <button key={p.key} onClick={() => { setPageKey(p.key); setChecks(null); setReport(null); setForm({}) }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition"
                style={{ background: active ? 'var(--app-primary-fade)' : 'transparent', color: active ? 'var(--app-primary)' : 'var(--app-text)' }}>
                <PIcon className="size-3.5 shrink-0" style={{ color: active ? 'var(--app-accent)' : 'var(--app-muted)' }} />
                <span className="truncate">{p.label}</span>
                {active && <ArrowRight className="ml-auto size-3" />}
              </button>
            })}
          </nav>
          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--app-line)' }}>
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--app-muted)' }}>Reusable modules</p>
            <div className="space-y-1.5">
              {state.modules.map((m) => <div key={m.code} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: m.enabled ? 'var(--app-primary-fade)' : 'transparent', color: m.enabled ? 'var(--app-text)' : 'var(--app-muted)' }}>
                <span className="flex min-w-0 items-center gap-1.5 truncate"><Boxes className="size-3 shrink-0" /><span className="truncate">{m.name}</span></span>
                <span className="shrink-0 font-mono text-[9px] opacity-60">{m.semver}</span>
              </div>)}
            </div>
          </div>
          <Link href="/factory/apps" className="mt-6 block rounded-lg border px-3 py-2 text-center text-[11px] font-medium" style={{ borderColor: 'var(--app-line)', color: 'var(--app-primary)' }}>← All my applications</Link>
        </aside>}

        {/* Main */}
        <main className={`min-w-0 flex-1 px-4 py-6 sm:px-7 ${spacing === 'compact' ? 'space-y-4' : 'space-y-6'}`}>
          {notice && <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs" style={{ borderColor: notice.tone === 'ok' ? hexToRgba('#16A34A', 0.35) : hexToRgba('#DC2626', 0.3), background: notice.tone === 'ok' ? hexToRgba('#16A34A', 0.07) : hexToRgba('#DC2626', 0.06), color: notice.tone === 'ok' ? '#166534' : '#991B1B' }}>
            {notice.tone === 'ok' ? <BadgeCheck className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}<span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-auto text-[10px] uppercase opacity-60">Dismiss</button>
          </div>}

          {/* Page heading */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--app-accent)' }}>{page?.kind ?? 'dashboard'} · config-driven</p>
              <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl"><Icon className="size-6" style={{ color: 'var(--app-primary)' }} />{page?.label ?? 'Overview'}</h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>{page?.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void act('health.run')} disabled={Boolean(busy)} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium disabled:opacity-50" style={{ borderColor: 'var(--app-line)' }}><Gauge className="size-3.5" />{busy === 'health.run' ? 'Checking…' : 'Run health'}</button>
              <button onClick={() => void act('tests.run')} disabled={Boolean(busy)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--app-primary)' }}><PlayCircle className="size-3.5" />{busy === 'tests.run' ? 'Running…' : 'Run acceptance tests'}</button>
            </div>
          </div>

          {/* Dashboard */}
          {page?.kind === 'dashboard' && <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(page.metrics?.length ? page.metrics : ['Records', 'Modules', 'Pages', 'Files']).map((label, i) => {
                const values = [state.counts.records, state.counts.enabledModules, state.counts.pages, state.counts.files]
                return <div key={label} className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--app-muted)' }}>{label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: i === 0 ? 'var(--app-primary)' : 'var(--app-text)' }}>{values[i] ?? 0}</p>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--app-muted)' }}>live scoped query</p>
                </div>
              })}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="rounded-2xl border p-5 shadow-sm lg:col-span-2" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Module data distribution</h2><Database className="size-4" style={{ color: 'var(--app-muted)' }} /></div>
                {state.aggregates.byModule.length === 0 ? <p className="py-8 text-center text-xs" style={{ color: 'var(--app-muted)' }}>No records yet. Use a form page to create the first real record.</p>
                  : <div className="space-y-3">{state.aggregates.byModule.map((row) => {
                    const max = Math.max(...state.aggregates.byModule.map((r) => r.count), 1)
                    return <div key={row.module} className="flex items-center gap-3 text-xs"><span className="w-28 shrink-0 truncate font-medium">{row.module}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--app-primary-fade)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(6, row.count / max * 100)}%`, background: 'var(--app-accent)' }} /></div>
                      <span className="w-8 text-right font-mono tabular-nums">{row.count}</span></div>
                  })}</div>}
              </section>
              <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent audit events</h2><ShieldCheck className="size-4" style={{ color: 'var(--app-muted)' }} /></div>
                <div className="max-h-64 space-y-2 overflow-auto pr-1">{state.audits.slice(0, 8).map((a) => <div key={a.id} className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'var(--app-primary-fade)' }}>
                  <p className="truncate font-medium">{a.action}</p><p style={{ color: 'var(--app-muted)' }} className="truncate">{a.decision ?? 'ALLOW'} · {when(a.createdAt)}</p>
                </div>)}{state.audits.length === 0 && <p className="py-6 text-center text-xs" style={{ color: 'var(--app-muted)' }}>No audit events yet.</p>}</div>
              </section>
            </div>
          </>}

          {/* Real create form */}
          {(page?.kind === 'form' || page?.kind === 'list' || page?.kind === 'gallery' || page?.kind === 'board') && entity && <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">New {entity.label}</h2><p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-muted)' }}>Validated server-side against the pinned {activeModule?.name} module schema.</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-mono" style={{ background: 'var(--app-tint)', color: 'var(--app-primary)' }}>{activeModule?.code}/{entity.key}</span></div>
            <form onSubmit={(e) => { e.preventDefault(); if (activeModule) void act('record.create', { moduleKey: activeModule.code, entityType: entity.key, data: form }) }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entity.fields.map((f) => <label key={f.key} className="block"><span className="mb-1 block text-[11px] font-medium">{f.label}{f.required ? ' *' : ''}</span>
                <input required={Boolean(f.required)} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                  value={String(form[f.key] ?? '')} onChange={(e) => setForm((p) => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  placeholder={`Enter ${f.label.toLowerCase()}`} className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2"
                  style={{ borderColor: 'var(--app-line)', background: 'var(--app-bg)', color: 'var(--app-text)' }} />
              </label>)}
              <div className="flex items-end"><button type="submit" disabled={Boolean(busy) || !activeModule?.enabled} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: 'var(--app-primary)' }}><Plus className="size-3.5" />{busy === 'record.create' ? 'Creating…' : `Create ${entity.label}`}</button></div>
            </form>
          </section>}

          {/* Records */}
          {pageRecords.length > 0 && <section className="rounded-2xl border shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--app-line)' }}><h2 className="text-sm font-semibold">{entity?.label ?? 'Records'} <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--app-muted)' }}>({pageRecords.length})</span></h2><span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>company-scoped · checksummed config</span></div>
            <div className="divide-y" style={{ borderColor: 'var(--app-line)' }}>
              {pageRecords.map((r) => <div key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{String(r.data.name ?? r.data.label ?? r.data.subject ?? r.data.email ?? r.data.key ?? r.entityType)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">{Object.entries(r.data).filter(([k]) => !['name', 'label', 'subject', 'email', 'key'].includes(k)).map(([k, v]) => <span key={k} className="text-[10px]" style={{ color: 'var(--app-muted)' }}><b className="font-medium">{k}:</b> {fmt(v)}</span>)}</div>
                  <p className="mt-1.5 font-mono text-[9px]" style={{ color: 'var(--app-muted)' }}>{r.moduleKey}/{r.entityType} · {r.id.slice(0, 12)} · {when(r.createdAt)}</p></div>
                <div className="flex shrink-0 gap-1.5">
                  {page?.kind === 'board' && <button onClick={() => void act('workflow.advance', { recordId: r.id })} disabled={Boolean(busy)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--app-accent)' }}>Advance →</button>}
                  <button onClick={() => void act('record.delete', { recordId: r.id })} disabled={Boolean(busy)} className="rounded-lg border p-1.5 disabled:opacity-50" style={{ borderColor: 'var(--app-line)', color: '#B91C1C' }} aria-label="Delete record"><Trash2 className="size-3.5" /></button>
                </div>
              </div>)}
            </div>
          </section>}
          {pageRecords.length === 0 && page?.kind !== 'dashboard' && page?.kind !== 'report' && page?.kind !== 'timeline' && <div className="rounded-2xl border border-dashed py-12 text-center text-xs" style={{ borderColor: 'var(--app-line)', color: 'var(--app-muted)' }}>No records on this page yet. Add one with the form above — the write goes straight to the company-scoped database.</div>}

          {/* Report */}
          {page?.kind === 'report' && <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Live scoped report</h2><p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-muted)' }}>Aggregation runs on the server over this company’s records only.</p></div><button onClick={() => void act('report.run')} disabled={Boolean(busy)} className="rounded-lg px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--app-primary)' }}>Run report</button></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(report ?? state.aggregates.byModule.map((r) => ({ module: r.module, entity: 'all', count: r.count }))).map((line, i) => <div key={`${line.module}-${line.entity}-${i}`} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--app-line)', background: 'var(--app-primary-fade)' }}>
              <p className="truncate text-[11px] font-medium">{line.module} <span style={{ color: 'var(--app-muted)' }}>/ {line.entity}</span></p><p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--app-primary)' }}>{line.count}</p></div>)}</div>
            {state.aggregates.byEntity.length === 0 && <p className="mt-4 text-xs" style={{ color: 'var(--app-muted)' }}>No records to aggregate yet.</p>}
          </section>}

          {/* Timeline */}
          {page?.kind === 'timeline' && <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <h2 className="mb-4 text-sm font-semibold">Operational timeline</h2>
            <div className="space-y-3">{[...state.audits.slice(0, 12), ...state.releases.map((r) => ({ id: r.id, action: `RELEASE ${r.code} · ${r.status}`, decision: r.toVersion, createdAt: r.createdAt, targetType: 'RELEASE' }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 16).map((item) => <div key={item.id} className="flex gap-3 text-xs"><div className="mt-1 size-2 shrink-0 rounded-full" style={{ background: 'var(--app-accent)' }} /><div className="min-w-0"><p className="truncate font-medium">{item.action}</p><p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>{item.decision} · {when(item.createdAt)}</p></div></div>)}</div>
          </section>}

          {/* Files */}
          <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Company files</h2><p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-muted)' }}>Content is checksummed, scoped and scanned before storage.</p></div>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: 'var(--app-line)' }}><UploadCloud className="size-3.5" />{busy === 'file.upload' ? 'Uploading…' : 'Upload file'}
                <input type="file" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => void act('file.upload', { name: file.name, mimeType: file.type || 'application/octet-stream', contentBase64: String(reader.result).split(',')[1] ?? '' })
                  reader.readAsDataURL(file); e.target.value = ''
                }} /></label></div>
            {state.files.length === 0 ? <p className="py-4 text-center text-xs" style={{ color: 'var(--app-muted)' }}>No files stored for this application.</p>
              : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{state.files.map((f) => <div key={f.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--app-line)' }}><p className="truncate text-xs font-medium">{f.name}</p><p className="mt-1 font-mono text-[9px]" style={{ color: 'var(--app-muted)' }}>{f.sizeBytes} bytes · {f.checksum.slice(0, 12)}…</p></div>)}</div>}
          </section>

          {/* Executable evidence */}
          {checks && <section className="rounded-2xl border p-5 shadow-sm" style={{ borderRadius: radius, borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Executable acceptance evidence</h2><span className="text-[10px] font-mono" style={{ color: 'var(--app-muted)' }}>{checks.filter((c) => c.ok).length}/{checks.length} passed</span></div>
            <div className="grid gap-2 sm:grid-cols-2">{checks.map((c) => <div key={c.key} className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: c.ok ? hexToRgba('#16A34A', 0.3) : hexToRgba('#DC2626', 0.3), background: c.ok ? hexToRgba('#16A34A', 0.05) : hexToRgba('#DC2626', 0.05) }}>
              {c.ok ? <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-green-700" /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-700" />}
              <div><p className="text-[11px] font-medium">{c.label}</p><p className="mt-0.5 text-[10px]" style={{ color: 'var(--app-muted)' }}>{c.detail}</p></div></div>)}</div>
          </section>}

          {/* Operations strip */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Latest health', value: state.checks[0]?.status ?? 'NOT RUN', detail: state.checks[0] ? when(state.checks[0].checkedAt) : 'Run health to evaluate' },
              { label: 'Release', value: `v${state.application.releaseVersion}`, detail: `${state.releases.length} release rows` },
              { label: 'Recovery points', value: String(state.backups.length), detail: `${state.backups.filter((b) => b.verifiedAt).length} verified` },
              { label: 'Config integrity', value: state.application.configChecksum.slice(0, 10) + '…', detail: 'SHA-256 pinned revision' },
            ].map((card) => <div key={card.label} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--app-line)', background: 'var(--app-surface)' }}><p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>{card.label}</p><p className="mt-1 truncate text-sm font-semibold">{card.value}</p><p className="mt-0.5 text-[10px]" style={{ color: 'var(--app-muted)' }}>{card.detail}</p></div>)}
          </section>

          <p className="pb-8 text-center text-[10px] leading-relaxed" style={{ color: 'var(--app-muted)' }}>
            {state.fact}<br />BDTECH360 Software Factory · one runtime, {state.counts.modules} pinned modules, {state.counts.pages} configured pages · generated {when(state.generatedAt)}
          </p>
        </main>
      </div>
    </div>
  )
}
