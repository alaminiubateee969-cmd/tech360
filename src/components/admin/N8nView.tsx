'use client'

import { Download, RefreshCw, Workflow as WorkflowIcon, Zap } from 'lucide-react'

import { fmtDate, prettify, useApi, type N8nResponse } from '@/lib/admin-client'
import { EmptyState, PageHeader } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function N8nView() {
  const { data, loading, error, refresh } = useApi<N8nResponse>('/api/admin/n8n')
  const workflows = data?.workflows ?? []

  return (
    <div>
      <PageHeader
        title="n8n Workflows"
        description="Importable automation blueprints — download the JSON and import into your n8n instance. Definitions contain no secrets."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh workflows"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load workflows: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full bg-slate-800/50" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={WorkflowIcon}
            title="No workflows registered"
            description="The n8n blueprint registry is empty — workflows appear here once seeded."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <article key={w.code} className={CARD} aria-label={`Workflow ${w.name}`}>
              <header className="border-b border-slate-800 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{w.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-600">{w.code}</p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.trigger ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#009FE3]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#009FE3]">
                      <Zap className="size-3" aria-hidden="true" /> {prettify(w.trigger)}
                    </span>
                  ) : null}
                  {w.category ? (
                    <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {prettify(w.category)}
                    </span>
                  ) : null}
                </div>
              </header>
              <div className="px-4 py-3">
                <p className="min-h-[40px] text-[13px] leading-relaxed text-slate-400">
                  {w.description || 'No description provided.'}
                </p>
                <p className="mt-2 text-[11px] text-slate-600">
                  {w.lastRunAt ? `Last run: ${fmtDate(w.lastRunAt)}${w.lastRunStatus ? ` · ${prettify(w.lastRunStatus)}` : ''}` : 'Never run'}
                </p>
              </div>
              <footer className="border-t border-slate-800 px-4 py-3">
                <a
                  href={`/api/admin/n8n/${encodeURIComponent(w.code)}/download`}
                  download={`${w.code}.json`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-[#009FE3]/50 hover:bg-[#009FE3]/10 hover:text-[#009FE3] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/50"
                  aria-label={`Download ${w.name} workflow JSON`}
                >
                  <Download className="size-3.5" aria-hidden="true" /> Download JSON
                </a>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
