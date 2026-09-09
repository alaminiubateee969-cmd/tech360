'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderKanban,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import {
  api,
  clientDisplayName,
  fmtDate,
  fmtDateShort,
  fmtMoney,
  num,
  parseMaybeJson,
  prettify,
  useApi,
  type PaymentRecord,
  type ProjectSummary,
  type ScopeRecord,
  type TaskRecord,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

interface ProjectDetailResponse {
  project: ProjectSummary
  tasks?: TaskRecord[]
  scopes?: ScopeRecord[]
  payments?: PaymentRecord[]
  previews?: Array<{ id: string; token?: string | null; version?: number | null; status?: string | null; viewCount?: number | null }>
  delivery?: {
    id?: string
    status?: string | null
    checklist?: string | null
    deliveredAt?: string | null
    clientConfirmedAt?: string | null
  } | null
  handovers?: Array<{
    id: string
    type?: string | null
    packageToken?: string | null
    status?: string | null
    releasedBy?: string | null
    releasedAt?: string | null
    downloadedAt?: string | null
    confirmedAt?: string | null
  }>
}

const PROJECT_STATUSES = [
  'PLANNING', 'ACTIVE', 'DEVELOPMENT', 'TESTING', 'CLIENT_REVIEW', 'DELIVERY', 'HANDOVER', 'COMPLETED',
] as const

function paymentStatus(p: ProjectSummary): string {
  const total = num(p.totalAmount)
  const paid = num(p.paidAmount)
  if (total > 0 && paid >= total) return 'PAID'
  if (paid > 0) return 'PARTIAL'
  return 'PENDING'
}

export function ProjectsView({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [status, setStatus] = useState('ALL')
  const url = status === 'ALL' ? '/api/admin/projects' : `/api/admin/projects?status=${status}`
  const { data, loading, error, refresh } = useApi<{ projects?: ProjectSummary[] }>(url)
  const projects = data?.projects ?? []

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Delivery projects from activation to closure — codes, plans, and payment progress."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh projects"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      <div className="mb-3 flex justify-start">
        <label htmlFor="proj-status" className="sr-only">Filter by status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="proj-status" className="h-9 w-[190px] border-slate-800 bg-slate-950/60 text-slate-200">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
            <SelectItem value="ALL">All statuses</SelectItem>
            {[...PROJECT_STATUSES, 'ON_HOLD', 'CANCELLED'].map((s) => (
              <SelectItem key={s} value={s}>{prettify(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load projects: {error}
        </div>
      ) : null}

      <DataTable
        columns={[
          { key: 'code', header: 'Code', cell: (p) => <span className="font-mono text-xs text-[#009FE3]">{p.code || '—'}</span> },
          { key: 'client', header: 'Client', cell: (p) => <span className="font-medium text-slate-200">{p.client ? clientDisplayName(p.client) : '—'}</span> },
          { key: 'name', header: 'Project', cell: (p) => <span className="text-slate-300">{p.name}</span> },
          { key: 'plan', header: 'Plan', cell: (p) => <span className="text-slate-400">{p.plan || '—'}</span> },
          { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
          { key: 'total', header: 'Total', cell: (p) => <span className="tabular-nums text-slate-300">{fmtMoney(num(p.totalAmount), p.currency ?? 'USD')}</span> },
          { key: 'paid', header: 'Paid', cell: (p) => <span className="tabular-nums text-emerald-400">{fmtMoney(num(p.paidAmount), p.currency ?? 'USD')}</span> },
          { key: 'paystatus', header: 'Payment', cell: (p) => <StatusBadge status={paymentStatus(p)} /> },
          { key: 'started', header: 'Started', cell: (p) => <span className="text-xs text-slate-500">{fmtDateShort(p.startedAt)}</span> },
        ]}
        rows={projects}
        loading={loading}
        rowKey={(p) => p.id}
        onRowClick={(p) => onOpenProject(p.id)}
        empty={
          <EmptyState
            icon={FolderKanban}
            title={status !== 'ALL' ? 'No projects with this status' : 'No projects yet'}
            description={status !== 'ALL' ? 'Try a different status filter.' : 'A project is created when a verified payment activates an approved scope.'}
          />
        }
        aria-label="Projects table"
      />
    </div>
  )
}

export function ProjectDetailView({
  projectId,
  onBack,
}: {
  projectId: string
  onBack: () => void
}) {
  const { data, loading, error, refresh } = useApi<ProjectDetailResponse>(`/api/admin/projects/${encodeURIComponent(projectId)}`)
  const project = data?.project
  const [closing, setClosing] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)

  async function closeProject() {
    setClosing(true)
    try {
      const res = await api.closeProject(projectId)
      toast.success(res.message ?? 'Project closed.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Close failed.')
    } finally {
      setClosing(false)
      setCloseConfirm(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-slate-800/60" />
        <Skeleton className="h-24 w-full bg-slate-800/50" />
        <Skeleton className="h-80 w-full bg-slate-800/40" />
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-slate-400 hover:text-slate-100">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Button>
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load this project: {error}
        </div>
      </div>
    )
  }
  if (!project) return <EmptyState title="Project not found" />

  const statusIdx = project.status ? PROJECT_STATUSES.indexOf(project.status as (typeof PROJECT_STATUSES)[number]) : -1
  const isTerminal = ['COMPLETED', 'CANCELLED'].includes((project.status ?? '').toUpperCase())
  const checklist = parseMaybeJson(data?.delivery?.checklist)

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.code ?? project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-300">{project.name}</span>
            {project.client ? <span className="text-xs text-slate-500">{clientDisplayName(project.client)}</span> : null}
            <StatusBadge status={project.status} />
            <StatusBadge status={paymentStatus(project)} />
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 hover:text-slate-100">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh project"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
            {!isTerminal ? (
              <Button
                size="sm"
                variant="outline"
                disabled={closing}
                onClick={() => setCloseConfirm(true)}
                className="border-red-500/40 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                {closing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
                Close Project
              </Button>
            ) : null}
          </>
        }
      />

      {/* status stepper */}
      <section className={CARD} aria-label="Project status pipeline">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-200">Project Status</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {(project.status ?? '').toUpperCase() === 'ON_HOLD' || (project.status ?? '').toUpperCase() === 'CANCELLED'
              ? `Current state: ${prettify(project.status)} (off the standard flow)`
              : statusIdx >= 0
                ? `Phase ${statusIdx + 1} of ${PROJECT_STATUSES.length}`
                : 'Current state unknown'}
          </p>
        </div>
        <div className={`overflow-x-auto px-4 py-4 ${SCROLL_THIN}`}>
          <ol className="flex min-w-max items-start gap-0">
            {PROJECT_STATUSES.map((s, i) => {
              const done = i < statusIdx
              const current = i === statusIdx
              return (
                <li key={s} className="flex w-28 shrink-0 flex-col items-center text-center">
                  <div className="flex w-full items-center">
                    <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done || current ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        current
                          ? 'border-[#009FE3] bg-[#009FE3]/20 text-[#009FE3]'
                          : done
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                            : 'border-slate-700 bg-slate-900 text-slate-700'
                      }`}
                    >
                      {done ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <Circle className="size-2.5" aria-hidden="true" />}
                    </span>
                    <span className={`h-0.5 flex-1 ${i === PROJECT_STATUSES.length - 1 ? 'invisible' : done ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />
                  </div>
                  <span className={`mt-1.5 text-[9px] font-medium leading-tight ${current ? 'text-[#009FE3]' : done ? 'text-slate-400' : 'text-slate-600'}`}>
                    {prettify(s)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Financials" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total</dt>
              <dd className="font-semibold tabular-nums text-slate-100">{fmtMoney(num(project.totalAmount), project.currency ?? 'USD')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-semibold tabular-nums text-emerald-400">{fmtMoney(num(project.paidAmount), project.currency ?? 'USD')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Outstanding</dt>
              <dd className="font-semibold tabular-nums text-amber-400">{fmtMoney(Math.max(0, num(project.totalAmount) - num(project.paidAmount)), project.currency ?? 'USD')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Plan</dt>
              <dd className="text-slate-300">{project.plan || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Started</dt>
              <dd className="text-slate-300">{fmtDateShort(project.startedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Delivered</dt>
              <dd className="text-slate-300">{fmtDateShort(project.deliveredAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Closed</dt>
              <dd className="text-slate-300">{fmtDateShort(project.closedAt)}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Delivery"
          description={data?.delivery ? `Status: ${prettify(data.delivery.status)}` : 'No delivery record yet'}
          className="lg:col-span-2"
        >
          {data?.delivery ? (
            <div className="space-y-3">
              {checklist && typeof checklist === 'object' ? (
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Delivery checklist">
                  {Object.entries(checklist as Record<string, unknown>).map(([k, v]) => {
                    const ok = v === true
                    return (
                      <li key={k} className="flex items-center gap-2 text-[13px]">
                        {ok ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-slate-600" aria-hidden="true" />
                        )}
                        <span className={ok ? 'text-slate-300' : 'text-slate-500'}>{prettify(k)}</span>
                        {!ok && typeof v === 'string' ? <span className="text-xs text-slate-600">· {v}</span> : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <JsonView value={data.delivery.checklist} maxHeightClass="max-h-32" />
              )}
              <p className="text-xs text-slate-500">
                Delivered: {fmtDate(data.delivery.deliveredAt)} · Client confirmed: {fmtDate(data.delivery.clientConfirmedAt)}
              </p>
            </div>
          ) : (
            <EmptyState title="No delivery record" description="Delivery is prepared during the delivery phase of the journey." />
          )}
        </SectionCard>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-900/80 p-1">
          {[
            ['tasks', `Tasks (${(data?.tasks ?? []).length})`],
            ['payments', `Payments (${(data?.payments ?? []).length})`],
            ['scopes', `Scopes (${(data?.scopes ?? []).length})`],
            ['previews', `Previews (${(data?.previews ?? []).length})`],
            ['handovers', `Handovers (${(data?.handovers ?? []).length})`],
          ].map(([v, label]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="h-8 px-3 text-xs text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tasks" className="mt-3">
          <SectionCard
            title="Tasks"
            description="Project task board (read-only — task updates are performed by the journey engine / automation)"
            contentClassName="p-0"
          >
            {(data?.tasks ?? []).length === 0 ? (
              <EmptyState title="No tasks yet" description="Tasks are generated when the project activates." />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {(data?.tasks ?? [])
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((t: TaskRecord) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-200">{t.title}</p>
                        {t.description ? <p className="mt-0.5 max-w-xl truncate text-xs text-slate-500">{t.description}</p> : null}
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          {t.assigneeType === 'AGENT' ? `Agent ${t.assigneeRef ?? ''}` : t.assigneeRef ? `Human: ${t.assigneeRef}` : 'Unassigned'}
                          {t.dueAt ? ` · due ${fmtDateShort(t.dueAt)}` : ''}
                          {t.completedAt ? ` · completed ${fmtDateShort(t.completedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.priority ? (
                          <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {t.priority}
                          </span>
                        ) : null}
                        <StatusBadge status={t.status} />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          <SectionCard title="Payments" contentClassName="p-0">
            <DataTable
              columns={[
                { key: 'milestone', header: 'Milestone', cell: (p) => <span className="text-slate-300">{p.milestone || '—'}</span> },
                { key: 'amount', header: 'Amount', cell: (p) => <span className="font-semibold tabular-nums text-slate-100">{fmtMoney(num(p.amount), p.currency ?? 'USD')}</span> },
                { key: 'method', header: 'Method', cell: (p) => <span className="text-slate-400">{prettify(p.method)}</span> },
                { key: 'txn', header: 'Transaction', cell: (p) => <span className="font-mono text-xs text-slate-500">{p.transactionId || '—'}</span> },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
                { key: 'verified', header: 'Verified', cell: (p) => <span className="text-xs text-slate-500">{p.verifiedAt ? fmtDate(p.verifiedAt) : 'Not verified'}</span> },
              ]}
              rows={data?.payments}
              rowKey={(p) => p.id}
              empty={<EmptyState title="No payments yet" />}
              aria-label="Project payments"
              maxHeightClass="max-h-96"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="scopes" className="mt-3">
          <div className="space-y-3">
            {(data?.scopes ?? []).length === 0 ? (
              <SectionCard>
                <EmptyState title="No scopes attached" />
              </SectionCard>
            ) : (
              (data?.scopes ?? []).map((s: ScopeRecord) => {
                const parsed = parseMaybeJson(s.content)
                return (
                  <SectionCard
                    key={s.id}
                    title={`Scope v${s.version ?? '—'}`}
                    description={`Created ${fmtDate(s.createdAt)}`}
                    actions={<StatusBadge status={s.status} />}
                  >
                    {s.summary ? <p className="mb-2 text-[13px] text-slate-400">{s.summary}</p> : null}
                    {parsed ? <JsonView value={parsed} /> : <span className="text-xs text-slate-500">{s.content}</span>}
                  </SectionCard>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="previews" className="mt-3">
          <SectionCard title="Previews" contentClassName="p-0">
            {(data?.previews ?? []).length === 0 ? (
              <EmptyState title="No previews yet" description="Preview pages are generated from the final scope." />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {(data?.previews ?? []).map((pv) => (
                  <li key={pv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[13px] text-slate-200">Preview v{pv.version ?? '—'}</p>
                      <p className="font-mono text-[11px] text-slate-600">{pv.token || ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{num(pv.viewCount)} views</span>
                      <StatusBadge status={pv.status} />
                      {pv.token ? (
                        <a
                          href={`/api/preview/${encodeURIComponent(pv.token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#009FE3] hover:underline"
                        >
                          <ExternalLink className="size-3" aria-hidden="true" /> Open
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="handovers" className="mt-3">
          <SectionCard title="Handover Records" description="Source packages — release is payment-gated, download is token-gated" contentClassName="p-0">
            {(data?.handovers ?? []).length === 0 ? (
              <EmptyState title="No handover records" description="Handovers are prepared after final payment verification." />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {(data?.handovers ?? []).map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[13px] text-slate-200">{prettify(h.type)}</p>
                      <p className="font-mono text-[11px] text-slate-600">{h.packageToken || ''}</p>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {h.releasedAt ? `Released ${fmtDate(h.releasedAt)}${h.releasedBy ? ` by ${h.releasedBy}` : ''}` : 'Not released'}
                        {h.downloadedAt ? ` · Downloaded ${fmtDate(h.downloadedAt)}` : ''}
                        {h.confirmedAt ? ` · Confirmed ${fmtDate(h.confirmedAt)}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={h.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {closeConfirm ? (
        <div role="dialog" aria-modal="true" aria-label="Confirm project closure" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-sm font-bold text-slate-100">Close this project?</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Closure records the close date, settles the client journey to the CLOSED stage, and is audit-logged. The
              backend will refuse if closure preconditions are not met — its response will be shown.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCloseConfirm(false)} disabled={closing} className="text-slate-400">
                Cancel
              </Button>
              <Button size="sm" onClick={closeProject} disabled={closing} variant="destructive">
                {closing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Close Project
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
