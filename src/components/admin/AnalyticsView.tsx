'use client'

import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { num, prettify, useApi, type AnalyticsResponse } from '@/lib/admin-client'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { ACCENT, AMBER, AXIS_TICK, GREEN, PURPLE, RED, SLATE_GRID } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0d1526',
  border: '1px solid #1e293b',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
}
const PIE_COLORS = [ACCENT, GREEN, AMBER, PURPLE, RED, '#38BDF8', '#F472B6', '#A3E635', '#FB923C', '#2DD4BF']

function ChartFrame({
  title,
  description,
  loading,
  empty,
  children,
  height = 260,
}: {
  title: string
  description: string
  loading: boolean
  empty: boolean
  children: React.ReactNode
  height?: number
}) {
  return (
    <SectionCard title={title} description={description} contentClassName="p-2 sm:p-4">
      {loading ? (
        <Skeleton className="w-full bg-slate-800/50" style={{ height }} />
      ) : empty ? (
        <div style={{ height }} className="flex items-center justify-center">
          <EmptyState title="No data yet" description="This chart fills in as the platform records activity." />
        </div>
      ) : (
        <div style={{ height }} className="w-full">
          {children}
        </div>
      )}
    </SectionCard>
  )
}

export function AnalyticsView() {
  const { data, loading, error, refresh } = useApi<AnalyticsResponse>('/api/admin/analytics')

  const leadsTrend = useMemo(
    () =>
      (data?.leadsTrend ?? []).map((p) => ({
        date: p.date ?? '—',
        count: num(p.count),
      })),
    [data],
  )
  const pipeline = useMemo(
    () => (data?.pipeline ?? []).map((p) => ({ stage: prettify(p.stage), count: num(p.count) })),
    [data],
  )
  const channelMix = useMemo(
    () =>
      (data?.channelMix ?? []).map((p) => {
        const o = p as Record<string, unknown>
        const name = String(o.channel ?? o.name ?? o.source ?? '—')
        const value = num(o.count ?? o.value ?? o.leads ?? 0)
        return { name: prettify(name), value }
      }),
    [data],
  )
  const agentActivity = useMemo(
    () =>
      (data?.agentActivity ?? []).slice(0, 12).map((p) => {
        const o = p as Record<string, unknown>
        const name = String(o.agent ?? o.name ?? o.code ?? '—')
        const count = num(o.executions ?? o.count ?? o.runs ?? 0)
        return { name, count }
      }),
    [data],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description={data?.period ? `Period: ${data.period}` : 'Aggregated from live platform data — leads, channels, pipeline, and agent activity.'}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load analytics: {error}
        </div>
      ) : null}

      <ChartFrame title="Leads Trend" description="New leads captured over time" loading={loading} empty={leadsTrend.length === 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={leadsTrend} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={SLATE_GRID} />
            <XAxis dataKey="date" tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} />
            <YAxis tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} allowDecimals={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="count" name="Leads" stroke={ACCENT} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Pipeline Distribution" description="Clients across the 20 journey stages" loading={loading} empty={pipeline.length === 0} height={320}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pipeline} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={SLATE_GRID} vertical={false} />
            <XAxis dataKey="stage" tick={{ fill: AXIS_TICK, fontSize: 9 }} stroke={SLATE_GRID} interval={0} angle={-35} textAnchor="end" height={64} />
            <YAxis tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} allowDecimals={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,159,227,0.06)' }} />
            <Bar dataKey="count" name="Clients" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartFrame title="Channel Mix" description="Lead sources by channel" loading={loading} empty={channelMix.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie data={channelMix} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} stroke="#0B1220">
                {channelMix.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1" aria-label="Channel legend">
            {channelMix.map((c, i) => (
              <li key={c.name} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="size-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden="true" />
                {c.name} · {c.value}
              </li>
            ))}
          </ul>
        </ChartFrame>

        <ChartFrame title="Agent Activity" description="Executions by agent (top 12)" loading={loading} empty={agentActivity.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentActivity} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={SLATE_GRID} />
              <XAxis type="number" tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fill: AXIS_TICK, fontSize: 10 }} stroke={SLATE_GRID} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(24,184,58,0.06)' }} />
              <Bar dataKey="count" name="Executions" fill={GREEN} radius={[0, 3, 3, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </div>
  )
}
