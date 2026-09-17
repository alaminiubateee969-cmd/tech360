'use client'

import { useMemo } from 'react'
import { Eye, MousePointerClick, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import {
  Area,
  AreaChart,
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
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
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

// Website-traffic additions to the analytics payload (local types only —
// the shared AnalyticsResponse keeps its frozen shape).
interface TrafficResponse {
  trafficTrend?: Array<{ date?: string | null; pageviews?: number | null; uniques?: number | null }>
  topPages?: Array<{ path?: string | null; count?: number | null; share?: number | null }>
  referrers?: Array<{ source?: string | null; count?: number | null }>
  eventMix?: Array<{ name?: string | null; count?: number | null }>
  trafficKpis?: {
    pageviews30?: number | null
    uniques30?: number | null
    viewsToday?: number | null
    conversionEvents30?: number | null
    topReferrer?: string | null
  }
}

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
  const { data, loading, error, refresh } = useApi<AnalyticsResponse & TrafficResponse>('/api/admin/analytics')

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

  // ---- Website traffic ----
  const traffic = useMemo(
    () =>
      (data?.trafficTrend ?? []).map((p) => ({
        date: (p.date ?? '').slice(5),
        pageviews: num(p.pageviews),
        uniques: num(p.uniques),
      })),
    [data],
  )
  const topPages = useMemo(
    () => (data?.topPages ?? []).map((p) => ({ path: p.path ?? '—', count: num(p.count), share: num(p.share) })),
    [data],
  )
  const referrers = useMemo(
    () => (data?.referrers ?? []).map((p) => ({ source: p.source ?? '—', count: num(p.count) })),
    [data],
  )
  const eventMix = useMemo(
    () => (data?.eventMix ?? []).map((p) => ({ name: p.name ?? '—', count: num(p.count) })),
    [data],
  )
  const trafficKpis = data?.trafficKpis ?? {}

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description={data?.period ? `Period: ${data.period}` : 'Aggregated from live platform data — leads, channels, pipeline, agent activity and website traffic.'}
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

      {/* ---------------- Website Traffic (first-party, TrackingEvent-based) ---------------- */}
      <div className="pt-2">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Website Traffic</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Pageviews 30d" value={num(trafficKpis.pageviews30)} icon={Eye} tone="accent" loading={loading} sub="page_view events, last 30 days" />
            <KpiCard label="Unique visitors 30d" value={num(trafficKpis.uniques30)} icon={Users} tone="green" loading={loading} sub="Distinct anonymous visitor ids" />
            <KpiCard label="Views today" value={num(trafficKpis.viewsToday)} icon={Eye} tone="amber" loading={loading} sub="Pageviews since midnight UTC" />
            <KpiCard label="Conversion events 30d" value={num(trafficKpis.conversionEvents30)} icon={MousePointerClick} tone="slate" loading={loading} sub="lead · contact · form_submit · approval · whatsapp_click" />
          </div>

          <ChartFrame
            title="Traffic Trend"
            description="Pageviews and unique visitors, last 30 days"
            loading={loading}
            empty={traffic.length === 0}
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="uvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={SLATE_GRID} />
                <XAxis dataKey="date" tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} />
                <YAxis tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} allowDecimals={false} width={36} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="pageviews" name="Pageviews" stroke={ACCENT} strokeWidth={2} fill="url(#pvGradient)" />
                <Area type="monotone" dataKey="uniques" name="Unique visitors" stroke={GREEN} strokeWidth={2} fill="url(#uvGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Top pages with share bars */}
            <SectionCard title="Top Pages" description="Most-viewed paths (last 30 days)" className="xl:col-span-2">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full bg-slate-800/50" />
                  ))}
                </div>
              ) : topPages.length === 0 ? (
                <EmptyState title="No pageviews yet" description="Pageviews are recorded server-side as visitors browse the site." />
              ) : (
                <ul className="space-y-2.5" aria-label="Top pages">
                  {topPages.map((p) => (
                    <li key={p.path} className="min-w-0">
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="truncate font-mono text-xs text-slate-300" title={p.path}>{p.path}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {p.count} · {p.share.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="presentation">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#009FE3] to-[#063B8F]"
                          style={{ width: `${Math.max(1.5, Math.min(100, p.share))}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Referrers */}
            <SectionCard title="Referrers" description="Where pageviews originate (last 30 days)">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full bg-slate-800/50" />
                  ))}
                </div>
              ) : referrers.length === 0 ? (
                <EmptyState title="No referrer data yet" description="Referrer hosts appear here as tracked pageviews carry them." />
              ) : (
                <ul className="divide-y divide-slate-800" aria-label="Referrers">
                  {referrers.map((r) => (
                    <li key={r.source} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-xs text-slate-300" title={r.source}>{r.source}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Event mix */}
          <SectionCard title="Event Mix" description="All recorded event types (last 30 days, top 10)">
            {loading ? (
              <Skeleton className="h-12 w-full bg-slate-800/50" />
            ) : eventMix.length === 0 ? (
              <EmptyState title="No events yet" description="Server-side tracking events will be counted here." />
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Event mix">
                {eventMix.map((e, i) => (
                  <li
                    key={e.name}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <span className="size-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden="true" />
                    <span className="font-mono">{e.name}</span>
                    <span className="tabular-nums text-slate-500">{e.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Privacy footnote */}
          <p className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-slate-600" aria-hidden="true" />
            <span>
              First-party, cookie-light analytics · events recorded server-side · anonymous visitor ids generated locally — no
              cross-site tracking. Uniques undercount events recorded before anonymous ids existed (they collapse into one legacy
              bucket per day).
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
