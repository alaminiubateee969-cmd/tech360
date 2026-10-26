'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import { api, useApi, type DepartmentDccResponse } from '@/lib/admin-client'
import { DCC_THRESHOLDS, type DccMetricKey } from '@/lib/dcc-policy'
import { Button } from '@/components/ui/button'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { toast } from 'sonner'

const DCC_METRIC_KEYS = Object.keys(DCC_THRESHOLDS) as DccMetricKey[]

function assessmentTone(status?: string | null): 'green' | 'amber' | 'red' | 'slate' {
  if (status === 'CERTIFIED') return 'green'
  if (status === 'BLOCKED') return 'red'
  if (status === 'UNDER_REVIEW') return 'amber'
  return 'slate'
}

export function DepartmentCertificationView() {
  const { data, loading, error, refresh } = useApi<DepartmentDccResponse>('/api/admin/dcc?limit=500')
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const departments = data?.departments ?? []
  const certified = useMemo(
    () => departments.filter((department) => department.latestAssessment?.certificationCurrent).length,
    [departments],
  )

  async function assess(code: string) {
    if (busyCode) return
    setBusyCode(code)
    try {
      const result = await api.assessDepartmentDcc(code)
      toast.success('DCC assessment recorded', { description: result.message })
      refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'DCC assessment could not be recorded.')
    } finally {
      setBusyCode(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Department Capability Certification"
        description="Fail-closed creation gate based on persisted department evidence. Code catalogues and generated org-chart profiles are not treated as deployed departments or agents."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh DCC assessments">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Persisted departments" value={data?.persistedDepartmentCount ?? '—'} icon={ShieldCheck} loading={loading} sub="database rows" />
        <KpiCard label="Source definitions" value={data?.sourceDefinedDepartmentCount ?? '—'} icon={ShieldCheck} tone="slate" loading={loading} sub="code catalogue only" />
        <KpiCard label="Currently certified" value={certified} icon={CheckCircle2} tone="green" loading={loading} sub="fresh, revalidated assessments" />
        <KpiCard label="Not certified" value={data ? Math.max(0, data.persistedDepartmentCount - certified) : '—'} icon={AlertTriangle} tone="amber" loading={loading} sub="missing, failed, or expired" />
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
        A missing metric never passes. The current schema does not persist department-level knowledge inventories, test-run results, KPI outcomes, or a dedicated self-healing outcome, so those measures remain <strong>NOT MEASURED</strong> until real evidence exists. An assessment is a snapshot; only a fully passing, unexpired snapshot can unblock draft creation.
      </div>

      {error ? <p role="alert" className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">Could not load persisted DCC data: {error}</p> : null}

      {!loading && departments.length === 0 ? (
        <SectionCard title="Persisted departments" description="This list is read from the existing Department table, not the source catalogue.">
          <EmptyState icon={ShieldCheck} title="No persisted departments found" description="No database department rows are available to assess. The source-defined catalogue is not substituted for database records." />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {departments.map((department) => {
            const assessment = department.latestAssessment
            const evaluation = assessment?.evaluation ?? null
            return (
              <SectionCard
                key={department.id}
                title={`${department.name} · ${department.code}`}
                description={`${department.category} · ${department.persistedAgentCount} persisted agent row(s)`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={assessment?.certificationCurrent ? 'CERTIFIED' : assessment?.status ?? 'NOT_ASSESSED'} />
                    {assessment?.assessedAt ? <span className="text-[10px] text-slate-500">assessed {new Date(assessment.assessedAt).toLocaleString()}</span> : null}
                    <Button size="sm" onClick={() => assess(department.code)} disabled={Boolean(busyCode)} aria-label={`Run DCC assessment for ${department.code}`}>
                      {busyCode === department.code ? <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-3.5" aria-hidden="true" />}
                      Assess
                    </Button>
                  </div>
                }
              >
                {!assessment ? (
                  <p className="text-xs text-slate-500">No persisted assessment exists. Run an assessment to record the current evidence snapshot.</p>
                ) : !evaluation ? (
                  <p role="alert" className="text-xs text-red-300">The saved evidence could not be parsed. This assessment cannot authorize creation.</p>
                ) : (
                  <div className={CARD + ' overflow-x-auto'}>
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Mandatory metric</th>
                          <th className="px-3 py-2 font-semibold">Result</th>
                          <th className="px-3 py-2 font-semibold">Threshold</th>
                          <th className="px-3 py-2 font-semibold">Evidence / limitation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DCC_METRIC_KEYS.map((key) => {
                          const metric = evaluation.metrics.find((candidate) => candidate.key === key)
                          return (
                            <tr key={key} className="border-b border-slate-800/60 last:border-0 align-top">
                              <td className="px-3 py-2 text-slate-200">{DCC_THRESHOLDS[key].label}</td>
                              <td className="px-3 py-2">
                                <span className={metric?.status === 'PASS' ? 'text-emerald-400' : metric?.status === 'FAIL' || metric?.status === 'INVALID_EVIDENCE' ? 'text-red-400' : 'text-amber-300'}>
                                  {metric?.value === null || metric?.value === undefined ? 'NOT MEASURED' : `${metric.value}%`}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-400">{metric?.comparator === 'MAX' ? '≤' : '≥'} {metric?.threshold ?? DCC_THRESHOLDS[key].value}%</td>
                              <td className="max-w-[560px] px-3 py-2 text-slate-500">
                                <span className="block text-slate-400">{metric?.note ?? 'No saved evidence.'}</span>
                                {metric?.source ? <span className="mt-1 block font-mono text-[10px] text-slate-600">{metric.source}</span> : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {assessment ? (
                  <p className={`mt-2 text-[11px] ${assessmentTone(assessment.status) === 'green' ? 'text-emerald-400' : assessmentTone(assessment.status) === 'red' ? 'text-red-300' : 'text-amber-300'}`}>
                    {assessment.certificationCurrent
                      ? `Certified through ${assessment.expiresAt ? new Date(assessment.expiresAt).toLocaleString() : '—'}.`
                      : `Creation blocked: ${evaluation?.missing.length ? `${evaluation.missing.length} metric(s) unmeasured` : evaluation?.failed.length ? `${evaluation.failed.length} metric(s) failed` : 'the latest certification is not current'}.`}
                  </p>
                ) : null}
              </SectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
