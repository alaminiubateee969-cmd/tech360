'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Archive, Bot, CalendarClock, FileBarChart, Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { api, useApi, fmtDate, fmtDateShort, type ReportArchiveResponse, type ReportRow } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { Markdownish } from './shared/Markdownish'
import { StatusBadge } from './shared/StatusBadge'
import { SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ActiveReport = { id: string; content: string; title: string; trigger: string; agentRuns: number; durationMs?: number | null; createdAt: string }

export function ReportsView() {
  const archive = useApi<ReportArchiveResponse>('/api/admin/reports')
  const [active, setActive] = useState<ActiveReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [generating, setGenerating] = useState(false)

  const reports = archive.data?.reports ?? []
  const stats = archive.data?.stats ?? { scheduled: 0, manual: 0 }

  async function generate() {
    setGenerating(true)
    try {
      const res = await api.generateCeoReport()
      if (res.report) {
        setActive({
          id: res.id ?? '',
          content: res.report,
          title: `CEO Daily Report — ${new Date().toDateString()}`,
          trigger: 'MANUAL',
          agentRuns: res.agentRuns ?? 0,
          durationMs: res.durationMs,
          createdAt: res.generatedAt ?? new Date().toISOString(),
        })
        toast.success('CEO report generated from live data — archived.')
        archive.refresh()
      } else {
        toast.error(res.error ?? 'Report generation returned no content.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function openReport(row: ReportRow) {
    setLoadingReport(true)
    try {
      const res = await api.reportGet(row.id)
      setActive({
        id: res.report.id,
        content: res.report.content,
        title: res.report.title,
        trigger: res.report.trigger,
        agentRuns: res.report.agentRuns,
        durationMs: res.report.durationMs,
        createdAt: res.report.createdAt,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load report')
    } finally {
      setLoadingReport(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="AI-compiled executive reports generated from live platform data. Every report is archived — the executive trail of what the AI workforce reported, and when."
        actions={
          <Button onClick={generate} disabled={generating} className="font-semibold" style={{ background: '#009FE3' }}>
            {generating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileBarChart className="size-4" aria-hidden="true" />}
            {generating ? 'Compiling live data…' : 'Generate CEO Daily Report'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Archived Reports" value={archive.data?.total ?? 0} icon={Archive} tone="accent" loading={archive.loading} sub="Every briefing, kept forever" />
        <KpiCard label="Scheduled (08:00 Dhaka)" value={stats.scheduled} icon={CalendarClock} tone="green" loading={archive.loading} sub="Autonomous daily briefings" />
        <KpiCard label="Manual" value={stats.manual} icon={Sparkles} tone="amber" loading={archive.loading} sub="Admin-requested deep dives" />
        <KpiCard label="Agent Behind It" value="Pulse" icon={Bot} tone="slate" sub="RPT-039 + live CRM data" />
      </div>

      <SectionCard
        title="Current Report"
        description={active
          ? `${active.title} · generated ${fmtDate(active.createdAt)}${active.agentRuns ? ` · ${active.agentRuns} agent execution${active.agentRuns === 1 ? '' : 's'}` : ''}`
          : 'Oracle + Pulse agents compile leads, pipeline, payments, approvals, and system health into one briefing.'}
        actions={active ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActive(null)}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          >
            Clear view
          </Button>
        ) : undefined}
      >
        {generating ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16" aria-live="polite">
            <Loader2 className="size-8 animate-spin text-[#009FE3]" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-300">Oracle + Pulse agents compiling live data…</p>
            <p className="max-w-sm text-center text-xs text-slate-500">
              Reading leads, payments, approvals, automation health, and channel statuses. This usually takes a few
              seconds. The result is archived automatically.
            </p>
          </div>
        ) : active ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={active.trigger} title={active.trigger === 'SCHEDULED' ? 'Generated autonomously by the AI operations loop (daily 08:00 Asia/Dhaka)' : 'Generated on admin request'} />
              {typeof active.durationMs === 'number' && active.durationMs > 0 ? (
                <span className="text-[11px] text-slate-500">compiled in {(active.durationMs / 1000).toFixed(1)}s</span>
              ) : null}
            </div>
            <Markdownish text={active.content} />
          </div>
        ) : (
          <EmptyState
            icon={FileBarChart}
            title="No report open"
            description="Click Generate CEO Daily Report for a fresh briefing, or open any archived report below — the autonomous loop also files a scheduled report every morning at 08:00 (Asia/Dhaka)."
            action={
              <Button onClick={generate} variant="outline" size="sm" className="border-slate-700 bg-slate-900/60 text-slate-300 hover:border-[#009FE3]/50 hover:text-[#009FE3]">
                Generate now
              </Button>
            }
          />
        )}
      </SectionCard>

      <SectionCard
        title="Report Archive"
        description="The executive trail — every generated report with its trigger and provenance. Click a row to read it."
        actions={
          <Button variant="outline" size="sm" onClick={archive.refresh} disabled={archive.loading} className="border-slate-700">
            <RefreshCw className={`size-3.5 ${archive.loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </Button>
        }
      >
        {archive.error ? (
          <EmptyState icon={FileBarChart} title="Could not load the archive" description={archive.error} />
        ) : archive.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Archive is empty"
            description="No reports generated yet. Generate one above — future reports (including the autonomous 08:00 daily briefing) will be archived here."
          />
        ) : (
          <div className={`space-y-1.5 ${SCROLL_THIN} max-h-[46vh] overflow-y-auto pr-1`} role="list" aria-label="Archived reports">
            {reports.map((r) => {
              const isActive = active?.id === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  role="listitem"
                  onClick={() => openReport(r)}
                  disabled={loadingReport}
                  className={cn(
                    'flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors',
                    isActive
                      ? 'border-[#009FE3]/50 bg-[#009FE3]/[0.06]'
                      : 'border-slate-800 bg-slate-900/40 hover:border-[#009FE3]/30 hover:bg-slate-900/70',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{r.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {fmtDateShort(r.createdAt)}
                      {r.agentRuns ? ` · ${r.agentRuns} agent execution${r.agentRuns === 1 ? '' : 's'}` : ' · deterministic fallback'}
                      {typeof r.durationMs === 'number' && r.durationMs > 0 ? ` · ${(r.durationMs / 1000).toFixed(1)}s` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.trigger} title={r.trigger === 'SCHEDULED' ? 'Autonomous daily briefing (AI operations loop)' : 'Admin-requested'} />
                    {loadingReport && isActive ? <Loader2 className="size-3.5 animate-spin text-[#009FE3]" aria-hidden="true" /> : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
