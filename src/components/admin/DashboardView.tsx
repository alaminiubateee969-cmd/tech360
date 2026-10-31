'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertOctagon,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  Clapperboard,
  Clock,
  CreditCard,
  DollarSign,
  FileBarChart,
  FileClock,
  FileText,
  FolderKanban,
  ListTodo,
  LucideIcon,
  Mail,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  PhoneCall,
  Radar,
  RefreshCw,
  Rss,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  UserPlus,
  Users,
  Wallet,
  Workflow,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  fmtDate,
  fmtMoney,
  num,
  prettify,
  useApi,
  type DashboardAgentRow,
  type DashboardResponse,
  type RecentLead,
} from '@/lib/admin-client'
import { canAccessAdminView } from '@/lib/admin-view-policy'
import { AgentProviderNotice } from './AgentProviderNotice'
import { DataTable, type Column } from './shared/DataTable'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT, GREEN, AXIS_TICK, SCROLL_THIN, SLATE_GRID } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#0d1526',
  border: '1px solid #1e293b',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
}

const activityIcon = (type?: string | null) => {
  const t = (type ?? '').toUpperCase()
  if (t.includes('LEAD') || t.includes('INTAKE')) return <UserPlus className="size-3.5" />
  if (t.includes('PAY')) return <DollarSign className="size-3.5" />
  if (t.includes('COMM') || t.includes('MESSAGE') || t.includes('WHATSAPP') || t.includes('EMAIL')) return <MessageSquare className="size-3.5" />
  if (t.includes('PROJECT')) return <FolderKanban className="size-3.5" />
  if (t.includes('SCOPE') || t.includes('PREVIEW')) return <FileClock className="size-3.5" />
  if (t.includes('APPROVAL')) return <BadgeCheck className="size-3.5" />
  if (t.includes('AUTOM') || t.includes('WORKFLOW')) return <Activity className="size-3.5" />
  return <Activity className="size-3.5" />
}

// ============================================================
// LIVE AI OPERATIONS CARD — visible proof the autonomous loop is
// running the platform: heartbeat, cycles, executed actions and
// agent workforce stats, all from /api/admin/ops-status.
// ============================================================
type OpsStatus = {
  status: string
  heartbeatAgeSec: number | null
  intervalSec: number
  cycles: number | null
  lastCycleAt: string | null
  recentCycles: Array<{ id: string; at: string; status: string; summary: Record<string, unknown>; actions: string[] }>
  agents: { registered: number; totalExecutions: number; successes: number; failures: number; executions24h: number }
  unreadAlerts: number
  provider?: { name: string; state: string; configured: boolean; detail: string }
}

function fmtAge(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}

function AiOpsCard({ loading }: { loading: boolean }) {
  const [ops, setOps] = useState<OpsStatus | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/admin/ops-status', { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as OpsStatus
        if (!cancelled) { setOps(data); setFailed(false) }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void load()
    const t = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const active = ops?.status === 'ACTIVE'
  const lastCycle = ops?.recentCycles?.[0]
  const actions = lastCycle?.actions ?? []
  const successRate = ops && ops.agents.totalExecutions > 0
    ? Math.round((ops.agents.successes / ops.agents.totalExecutions) * 100)
    : null

  return (
    <section
      aria-label="Autonomous AI operations status"
      className="relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0A1A2E]"
    >
      {/* subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#009FE3]/60 to-transparent" aria-hidden="true" />
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        {/* status block */}
        <div className="flex min-w-[230px] items-center gap-3">
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#009FE3]/25 bg-[#009FE3]/10">
            <Bot className="size-5 text-[#009FE3]" aria-hidden="true" />
            {active ? (
              <span className="absolute -right-1 -top-1 flex size-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
              </span>
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-100">
              Autonomous AI Operations
              <span
                className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                  loading || !ops
                    ? 'bg-slate-800 text-slate-400'
                    : active
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : ops.status === 'STALE'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400'
                }`}
              >
                {loading ? '…' : failed ? 'FEED ERROR' : (ops?.status ?? 'OFFLINE')}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              {ops
                ? `Cycle #${ops.cycles ?? '—'} · heartbeat ${fmtAge(ops.heartbeatAgeSec)} · beats every ${Math.round(ops.intervalSec / 60) || 1} min`
                : 'Detect → Understand → Decide → Execute → Verify → Log → Learn'}
            </p>
            {ops?.provider ? <p className="mt-1 text-[10px] text-slate-400">AI provider: {ops.provider.name} · {ops.provider.state}</p> : null}
          </div>
        </div>

        {/* agent workforce stats */}
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Agents', value: ops ? String(ops.agents.registered) : '—', icon: Bot },
            { label: 'Runs (24h)', value: ops ? String(ops.agents.executions24h) : '—', icon: Zap },
            { label: 'Total runs', value: ops ? String(ops.agents.totalExecutions) : '—', icon: Activity },
            { label: 'Success', value: successRate != null ? `${successRate}%` : '—', icon: CheckCircle2 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                <s.icon className="size-3" aria-hidden="true" /> {s.label}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-slate-100">{s.value}</p>
            </div>
          ))}
        </div>

        {/* last cycle actions — evidence of real work */}
        <div className="min-w-0 lg:max-w-[280px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last cycle executed</p>
          {actions.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Actions performed in the last AI operations cycle">
              {actions.slice(0, 6).map((a, i) => (
                <li key={i} className="truncate rounded-md border border-slate-700/70 bg-slate-800/50 px-2 py-0.5 text-[10.5px] text-slate-300" title={a}>
                  {a}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-slate-600">
              {ops ? 'No actions needed — the loop scans continuously.' : 'Waiting for the first cycle…'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ============================================================
// MODULE DIRECTORY — every operating module reachable from the
// dashboard in one click (Enerpize-style modular-ERP overview).
// Ids mirror the sidebar routes in AdminApp exactly.
// ============================================================
const MODULE_DIRECTORY: Array<{ section: string; items: Array<{ id: string; label: string; blurb: string; icon: LucideIcon }> }> = [
  {
    section: 'Operations',
    items: [
      { id: 'ops', label: 'Ops Monitor', blurb: 'Heartbeats, queues and retries', icon: Radar },
      { id: 'chat', label: 'Live Chat Inbox', blurb: 'Visitor threads and conversions', icon: MessagesSquare },
      { id: 'approvals', label: 'Approvals', blurb: 'Client decisions waiting on you', icon: ShieldCheck },
      { id: 'projects', label: 'Projects', blurb: 'Delivery board and artifacts', icon: FolderKanban },
    ],
  },
  {
    section: 'Relationships',
    items: [
      { id: 'leads', label: 'Leads', blurb: 'Inquiries before qualification', icon: UserPlus },
      { id: 'clients', label: 'Clients', blurb: 'Records and journey stages', icon: Building2 },
      { id: 'communications', label: 'Communications', blurb: 'Follow-ups and outreach', icon: MessageSquare },
      { id: 'telephony', label: 'Calls & SMS', blurb: 'Voice and text activity', icon: PhoneCall },
    ],
  },
  {
    section: 'Finance & Production',
    items: [
      { id: 'payments', label: 'Payments', blurb: 'Milestones and verification', icon: Wallet },
      { id: 'factory', label: 'App Factory', blurb: 'Conversations into scoped builds', icon: Boxes },
      { id: 'media', label: 'Media Studio', blurb: 'Generated media and assets', icon: Clapperboard },
      { id: 'blog', label: 'Blog Studio', blurb: 'Write, schedule, publish', icon: Newspaper },
    ],
  },
  {
    section: 'Growth & Intelligence',
    items: [
      { id: 'reviews', label: 'Reviews & Referrals', blurb: 'Moderate client feedback', icon: Star },
      { id: 'newsletter', label: 'Newsletter', blurb: 'Campaigns and subscribers', icon: Mail },
      { id: 'feeds', label: 'Feed Hub', blurb: 'Tech and industry updates', icon: Rss },
      { id: 'seo', label: 'SEO Audit', blurb: 'Site health and keywords', icon: Search },
      { id: 'marketing', label: 'Marketing Kit', blurb: 'Reusable collateral', icon: Megaphone },
      { id: 'prompts', label: 'Prompt Library', blurb: 'Curated prompt recipes', icon: Sparkles },
      { id: 'agents', label: 'AI Workforce', blurb: 'Registry, runs, approvals', icon: Bot },
      { id: 'command', label: 'Command Center', blurb: 'Ask the Oracle in plain English', icon: Terminal },
      { id: 'memory', label: 'AI Memory', blurb: 'What the AI remembers', icon: BookOpen },
      { id: 'knowledge', label: 'Knowledge Base', blurb: 'Documents powering answers', icon: BookOpen },
      { id: 'content', label: 'Content Studio', blurb: 'AI drafts under review', icon: Clapperboard },
      { id: 'analytics', label: 'Analytics', blurb: 'Traffic and funnels', icon: BarChart3 },
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'logs', label: 'Logs', blurb: 'Immutable audit trail', icon: ScrollText },
      { id: 'n8n', label: 'n8n Workflows', blurb: 'External integrations', icon: Workflow },
      { id: 'reports', label: 'Reports', blurb: 'Scheduled and on-demand', icon: FileBarChart },
      { id: 'team', label: 'Team', blurb: 'Roles and sessions', icon: Users },
      { id: 'settings', label: 'Settings', blurb: 'Flags and integrations', icon: Settings },
    ],
  },
]

function AgentRosterCard({ data, loading, canOperate, onNavigate }: {
  data: DashboardResponse['aiAgents'] | undefined
  loading: boolean
  canOperate: boolean
  onNavigate: (id: string) => void
}) {
  const groups = new Map<string, DashboardAgentRow[]>()
  for (const a of data?.agents ?? []) {
    const key = a.deptName
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  const statusTone = (s: string) =>
    s === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : s === 'PAUSED' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-700/60 text-slate-400'
  return (
    <SectionCard
      title="AI Workforce roster"
      description={data ? `${data.active} active of ${data.total} registered AI agents. Identity and status only.` : 'Every registered AI agent'}
      actions={canOperate ? <Button size="sm" variant="outline" onClick={() => onNavigate('agents')}>Open AI Workforce</Button> : undefined}
    >
      {loading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : data && data.agents.length > 0 ? (
        <div className={`max-h-[420px] space-y-4 overflow-y-auto pr-1 ${SCROLL_THIN}`} aria-label="All registered AI agents">
          {[...groups.entries()].map(([dept, rows]) => (
            <div key={dept}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{dept} · {rows.length}</p>
              <ul className="divide-y divide-slate-800/70 rounded-lg border border-slate-800/70">
                {rows.map((a) => (
                  <li key={a.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[12px]">
                    <span className="font-mono text-[10.5px] text-slate-500">{a.code}</span>
                    <span className="font-medium text-slate-100">{a.name}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{a.title ?? '—'}</span>
                    <span className="text-[10px] text-slate-500">L{a.level}</span>
                    {a.requiresApproval ? <span className="text-[10px] text-amber-400">approval</span> : null}
                    <span className="text-[10px] tabular-nums text-slate-500">{a.executions} runs</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${statusTone(a.status)}`}>{a.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No AI agents registered" description="Agents appear here once the workforce is bootstrapped." />
      )}
    </SectionCard>
  )
}

export function DashboardView({ role = 'STAFF', onOpenClient, onNavigate }: { role?: string; onOpenClient: (id: string) => void; onNavigate: (id: string) => void }) {
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const canSeeRoster = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const { data, loading, error, refresh } = useApi<DashboardResponse>('/api/admin/dashboard')
  const stats = data?.stats
  const pipeline = (data?.pipeline ?? []).map((p) => ({
    stage: prettify(p.stage),
    count: num(p.count),
  }))
  const revenue = (data?.revenueByMonth ?? []).map((r) => ({ month: r.month, paid: num(r.paid) }))
  const recentLeads = data?.recentLeads ?? []
  const activity = data?.recentActivity ?? []
  const financialValue = (value: unknown, currency = false): string | number => {
    if (!data) return '—'
    if (!data.financialDataAvailable) return 'Restricted'
    return currency ? fmtMoney(num(value)) : num(value)
  }

  const leadColumns: Column<RecentLead>[] = [
    { key: 'clientId', header: 'Client ID', cell: (r) => <span className="font-mono text-xs text-[#009FE3]">{r.clientId}</span> },
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium text-slate-200">{r.name}</span> },
    { key: 'business', header: 'Business', cell: (r) => <span className="text-slate-400">{r.businessName || '—'}</span> },
    { key: 'stage', header: 'Stage', cell: (r) => <StatusBadge status={r.pipelineStage} /> },
    { key: 'created', header: 'Created', cell: (r) => <span className="text-xs text-slate-500">{fmtDate(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Command Dashboard"
        description="Live operational snapshot — every number below is queried from the platform database."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data?.financialDataAvailable ? (
              <Button onClick={() => onNavigate('payments')} className="gap-2 font-semibold" style={{ background: '#009FE3' }} aria-label="Create invoice draft">
                <FileText className="size-4" aria-hidden="true" /> Create Invoice / ইনভয়েস তৈরি করুন
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium">Dashboard unavailable: {error}</p>
          <p className="mt-1 text-xs text-red-400/70">Check the API server, then refresh.</p>
        </div>
      ) : null}

      {/* Database-backed CRM and operations indicators */}
      <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Leads" value={num(stats?.totalLeads)} icon={Users} tone="accent" loading={loading} sub="All inquiries captured" />
        <KpiCard label="New Leads" value={num(stats?.newLeads)} icon={UserPlus} tone="green" loading={loading} sub="Created in the last 24 hours" />
        <KpiCard label="Qualified Leads" value={num(stats?.qualifiedLeads)} icon={BadgeCheck} tone="green" loading={loading} sub="Intent confirmed" />
        <KpiCard label="Clients" value={num(stats?.clients)} icon={Building2} tone="accent" loading={loading} sub="With Client ID" />
        <KpiCard label="Active Projects" value={num(stats?.activeProjects)} icon={Rocket} tone="accent" loading={loading} sub="Development through handover" />
        <KpiCard label="Payment Pending" value={num(stats?.paymentPending)} icon={CreditCard} tone="amber" loading={loading} sub="Clients at payment-pending pipeline stage" />
        <KpiCard label="Paid Projects" value={financialValue(stats?.paidProjects)} icon={CheckCircle2} tone="green" loading={loading} sub="Finance view: Manager+" />
        <KpiCard label="Outstanding" value={financialValue(stats?.outstandingReceivables, true)} icon={DollarSign} tone="red" loading={loading} sub="Finance view: Manager+" />
        <KpiCard label="Completed" value={num(stats?.completedProjects)} icon={CheckCircle2} tone="green" loading={loading} sub="Projects delivered" />
        <KpiCard label="Open Tasks" value={num(stats?.openTasks)} icon={ListTodo} tone="slate" loading={loading} sub="Across projects" />
        <KpiCard label="Inbound Messages" value={num(stats?.unreadCommunications)} icon={MessageSquare} tone="accent" loading={loading} sub="Received inbound communications" />
        <KpiCard label="Failed Automations" value={num(stats?.failedAutomations)} icon={AlertOctagon} tone="red" loading={loading} sub="Need attention" />
        <KpiCard label="Pending Approvals" value={num(stats?.pendingAdminApprovals)} icon={FileClock} tone="amber" loading={loading} sub="Pending admin approval records" />
        <KpiCard label="Payment Verification" value={financialValue(stats?.pendingPaymentVerifications)} icon={CreditCard} tone="amber" loading={loading} sub="Payment records in PENDING state" />
        <KpiCard label="Overdue Tasks" value={num(stats?.overdueTasks)} icon={AlertOctagon} tone="red" loading={loading} sub="Open tasks past due date" />
        <KpiCard label="Deadlines (7 days)" value={num(stats?.upcomingDeadlines)} icon={Clock} tone="amber" loading={loading} sub="Open tasks due this week" />
        <KpiCard label="Refunds Pending" value={financialValue(stats?.pendingRefunds)} icon={Wallet} tone="amber" loading={loading} sub="Awaiting authorized decision" />
        <KpiCard label="Refunds Approved" value={financialValue(stats?.approvedRefunds)} icon={BadgeCheck} tone="slate" loading={loading} sub="Approval records; not proof of processing" />
        <KpiCard label="Email Queue" value={num(stats?.emailQueued)} icon={Mail} tone="accent" loading={loading} sub="Awaiting send processing" />
        <KpiCard label="Emails Sent" value={num(stats?.emailSent)} icon={Mail} tone="green" loading={loading} sub="Recorded SENT state; not delivery confirmation" />
        <KpiCard label="Email Failures" value={num(stats?.emailFailed)} icon={AlertOctagon} tone="red" loading={loading} sub="Failed or dead-letter records" />
        <KpiCard label="Verified Emails" value={num(stats?.verifiedEmailIdentities)} icon={ShieldCheck} tone="green" loading={loading} sub="Verified email identity records" />
        <KpiCard label="Handovers: Payment" value={num(stats?.handoversAwaitingPayment)} icon={FolderKanban} tone="amber" loading={loading} sub="Waiting payment verification" />
        <KpiCard label="Handovers: Confirm" value={num(stats?.handoversAwaitingConfirmation)} icon={CheckCircle2} tone="amber" loading={loading} sub="Released/downloaded; awaiting confirmation" />
      </section>

      {/* LIVE AI operations evidence strip — ops-status is SUPER_ADMIN only */}
      {isSuperAdmin ? <AiOpsCard loading={loading} /> : null}

      {/* Every registered AI agent — ADMIN and SUPER_ADMIN */}
      {canSeeRoster ? <AgentProviderNotice status={data?.aiProvider} /> : null}
      {canSeeRoster ? <AgentRosterCard data={data?.aiAgents} loading={loading} canOperate={canSeeRoster} onNavigate={onNavigate} /> : null}

      {/* Module directory — one click to any operating module */}
      <SectionCard
        title="Modules"
        description="Every operating module of the platform, one click away."
        contentClassName="p-4"
      >
        <nav aria-label="Platform modules" className="space-y-4">
          {MODULE_DIRECTORY.map((group) => ({ ...group, items: group.items.filter((m) => canAccessAdminView(role, m.id)) })).filter((group) => group.items.length > 0).map((group) => (
            <div key={group.section}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.section}</p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(m.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-slate-700/70 bg-slate-800/40 p-2.5 text-left transition hover:border-[#009FE3]/60 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3]"
                      aria-label={`Open ${m.label} — ${m.blurb}`}
                    >
                      <m.icon className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-200">{m.label}</span>
                        <span className="block truncate text-[10.5px] text-slate-500">{m.blurb}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </SectionCard>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <SectionCard
          title="Pipeline by Stage"
          description="Client count at each of the 20 journey stages"
          className="xl:col-span-3"
          contentClassName="p-2 sm:p-4"
        >
          {loading ? (
            <Skeleton className="h-[480px] w-full bg-slate-800/50" />
          ) : pipeline.length === 0 ? (
            <EmptyState title="No pipeline data yet" description="Clients appear here as soon as the first lead is captured." />
          ) : (
            <div className="h-[480px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke={SLATE_GRID} />
                  <XAxis
                    type="number"
                    tick={{ fill: AXIS_TICK, fontSize: 11 }}
                    allowDecimals={false}
                    stroke={SLATE_GRID}
                    domain={[0, (dataMax: number) => Math.max(2, dataMax)]}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={140}
                    tick={{ fill: AXIS_TICK, fontSize: 11 }}
                    stroke={SLATE_GRID}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,159,227,0.06)' }} />
                  <Bar dataKey="count" name="Clients" fill={ACCENT} radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Revenue by Month" description="Verified payments, month by month" contentClassName="p-2 sm:p-4">
            {loading ? (
              <Skeleton className="h-[220px] w-full bg-slate-800/50" />
            ) : data?.financialDataAvailable === false ? (
              <EmptyState title="Restricted" description="Finance metrics require Manager or higher access in the current role model." />
            ) : revenue.length === 0 ? (
              <EmptyState title="No payments yet" description="Revenue appears here once payments are recorded and verified." />
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={SLATE_GRID} />
                    <XAxis dataKey="month" tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} />
                    <YAxis tick={{ fill: AXIS_TICK, fontSize: 11 }} stroke={SLATE_GRID} width={60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number | string) => fmtMoney(Number(v))} />
                    <Area type="monotone" dataKey="paid" name="Paid" stroke={GREEN} strokeWidth={2} fill="url(#revGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent Activity" description="Latest events across the platform" contentClassName="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full bg-slate-800/50" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState title="No activity yet" description="Platform events will appear here as the system runs." />
            ) : (
              <ul className={`max-h-72 divide-y divide-slate-800 overflow-auto ${SCROLL_THIN}`} aria-label="Recent activity">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-800/30">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-800/70 text-slate-400">
                      {activityIcon(a.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[13px] leading-snug text-slate-300">{a.text || a.type || 'Event'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {a.type ? prettify(a.type) : ''}
                        {a.actor ? ` · ${a.actor}` : ''} · {fmtDate(a.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Recent leads */}
      <SectionCard
        title="Recent Leads"
        description="Newest inquiries — click a row to open the full client record"
        contentClassName="p-0"
      >
        <DataTable
          columns={leadColumns}
          rows={recentLeads}
          loading={loading}
          rowKey={(r) => r.id}
          onRowClick={(r) => onOpenClient(r.id)}
          empty={<EmptyState title="No leads yet" description="New inquiries will appear here after the first contact form submission or message." />}
          aria-label="Recent leads table"
          maxHeightClass="max-h-80"
        />
      </SectionCard>

      <p className="pb-2 text-center text-[11px] text-slate-500" aria-hidden="true">
        Data source: /api/admin/dashboard · refreshed manually and on view switch
      </p>
    </div>
  )
}
