'use client'

import { useMemo, useState } from 'react'
import { Building2, RefreshCw, Search, Users, XCircle } from 'lucide-react'

import { useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================================
// DEPARTMENT REGISTRY
//
// The 110 canonical departments, each with its category, the number of
// executable LLM agents persisted against it, and the number of logical
// agent definitions and skills registered for it.
// ============================================================

type DepartmentRow = {
  code: string
  name: string
  category: string
  description: string | null
  persisted: boolean
  executableAgents: number
  logicalAgents: number
  skills: number
}

type DepartmentsResponse = {
  total: number
  canonicalTotal: number
  categories: string[]
  departments: DepartmentRow[]
}

export default function DepartmentsView() {
  const [query, setQuery] = useState('')
  const { data, loading, error, refresh } = useApi<DepartmentsResponse>('/api/departments')

  const filtered = useMemo(() => {
    const rows = data?.departments ?? []
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(term) ||
        row.name.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term),
    )
  }, [data, query])

  const totals = useMemo(
    () => ({
      executable: filtered.reduce((sum, row) => sum + row.executableAgents, 0),
      logical: filtered.reduce((sum, row) => sum + row.logicalAgents, 0),
      persisted: filtered.filter((row) => row.persisted).length,
    }),
    [filtered],
  )

  return (
    <div>
      <PageHeader
        title="Department Registry"
        description="The canonical department list. Each department owns a set of logical agents and a set of skills."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh the department registry">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Departments" value={data?.canonicalTotal ?? '—'} icon={Building2} loading={loading} sub="canonical definition" />
        <KpiCard label="Persisted" value={totals.persisted} icon={Building2} tone="green" loading={loading} sub="rows in the database" />
        <KpiCard label="Logical agents" value={totals.logical} icon={Users} tone="accent" loading={loading} sub="registered definitions" />
        <KpiCard label="Executable agents" value={totals.executable} icon={Users} tone="slate" loading={loading} sub="LLM agents in the registry" />
      </div>

      <SectionCard
        title="Departments"
        description={data ? `${filtered.length} of ${data.total} shown` : 'Loading…'}
        actions={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, code or category…"
            aria-label="Filter departments"
            className="h-8 w-56 text-xs"
          />
        }
      >
        {error ? (
          <EmptyState icon={XCircle} title="The department registry could not be loaded" description={error} />
        ) : loading && !data ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-md bg-slate-800/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No department matches" description="Try a different search term." />
        ) : (
          <div className={CARD + ' max-h-[560px] overflow-auto'}>
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-800 bg-slate-900/95 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Executable</th>
                  <th className="px-3 py-2 font-semibold">Logical</th>
                  <th className="px-3 py-2 font-semibold">Persisted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.code} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <span className={MONO}>{row.code}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{row.name}</td>
                    <td className="px-3 py-2 text-slate-400">{row.category}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{row.executableAgents}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{row.logicalAgents}</td>
                    <td className="px-3 py-2 text-slate-400">{row.persisted ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
