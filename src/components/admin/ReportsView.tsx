'use client'

import { useState } from 'react'
import { FileBarChart, Loader2, RefreshCw } from 'lucide-react'

import { fmtDate, useApi } from '@/lib/admin-client'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { Markdownish } from './shared/Markdownish'
import { Button } from '@/components/ui/button'

export function ReportsView() {
  // fetch only on demand — the CEO report is AI-generated on each request
  const [requested, setRequested] = useState(false)
  const { data, loading, error, refresh } = useApi<{ report?: string }>(requested ? '/api/admin/reports/ceo' : null)

  function generate() {
    setRequested(true)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="AI-compiled executive reports generated from live platform data on demand."
        actions={
          <Button onClick={generate} disabled={loading} className="font-semibold" style={{ background: '#009FE3' }}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileBarChart className="size-4" aria-hidden="true" />}
            {requested ? 'Regenerate CEO Daily Report' : 'Generate CEO Daily Report'}
          </Button>
        }
      />

      {!requested ? (
        <SectionCard title="CEO Daily Report" description="Oracle + Pulse agents compile leads, pipeline, payments, approvals, and system health into one briefing.">
          <EmptyState
            icon={FileBarChart}
            title="No report generated yet"
            description="Click Generate CEO Daily Report — the agents will compile live data (leads, payments, approvals, automations) into a briefing rendered below."
            action={
              <Button onClick={generate} variant="outline" size="sm" className="border-slate-700 bg-slate-900/60 text-slate-300 hover:border-[#009FE3]/50 hover:text-[#009FE3]">
                Generate now
              </Button>
            }
          />
        </SectionCard>
      ) : loading ? (
        <SectionCard title="CEO Daily Report" description="Oracle + Pulse agents compiling live data…">
          <div className="flex flex-col items-center justify-center gap-3 py-16" aria-live="polite">
            <Loader2 className="size-8 animate-spin text-[#009FE3]" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-300">Oracle + Pulse agents compiling live data…</p>
            <p className="max-w-sm text-center text-xs text-slate-500">
              Reading leads, payments, approvals, automation health, and channel statuses. This usually takes a few
              seconds.
            </p>
          </div>
        </SectionCard>
      ) : error ? (
        <SectionCard title="CEO Daily Report">
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Report generation failed: {error}
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="CEO Daily Report"
          description={data?.report ? `Compiled ${fmtDate(new Date().toISOString())}` : undefined}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Regenerate report"
            >
              <RefreshCw className="size-4" aria-hidden="true" /> Regenerate
            </Button>
          }
        >
          {data?.report ? (
            <Markdownish text={data.report} />
          ) : (
            <EmptyState title="No report content returned" description="The API responded without a report body." />
          )}
        </SectionCard>
      )}
    </div>
  )
}
