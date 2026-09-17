'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'

import {
  api,
  clientDisplayName,
  fetchJson,
  fmtDate,
  fmtDateShort,
  fmtMoney,
  num,
  parseMaybeJson,
  prettify,
  useApi,
  type ApprovalItem,
  type ApprovalsResponse,
  type ClientDetailResponse,
  type DocumentRecord,
  type MeetingRecord,
  type PaymentRecord,
} from '@/lib/admin-client'
import { PIPELINE_STAGES } from '@/lib/constants'
import { DataTable, type Column } from './shared/DataTable'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { JsonView } from './shared/JsonView'
import { Markdownish } from './shared/Markdownish'
import { RiskBadge, StatusBadge } from './shared/StatusBadge'
import { ACCENT, CARD, GREEN, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const PAY_METHODS = ['BANK_TRANSFER', 'BKASH', 'NAGAD', 'CARD', 'WISE', 'PAYPAL', 'OTHER'] as const

interface JourneyDialog {
  action: string
  title: string
  description: string
  fields: 'none' | 'scope' | 'payment' | 'project'
}

export function ClientDetailView({
  clientId,
  onBack,
  onOpenProject,
}: {
  clientId: string
  onBack: () => void
  onOpenProject: (id: string) => void
}) {
  const { data, loading, error, refresh } = useApi<ClientDetailResponse>(`/api/admin/clients/${encodeURIComponent(clientId)}`)
  const approvalsApi = useApi<ApprovalsResponse>('/api/admin/approvals')
  const client = data?.client

  const [dialog, setDialog] = useState<JourneyDialog | null>(null)
  const [busy, setBusy] = useState(false)
  const [journeyMessage, setJourneyMessage] = useState<{ ok: boolean; text: string; result?: unknown } | null>(null)
  // Controlled tab so refreshes (journey actions, doc moderation, payments)
  // never yank the admin back to the Timeline tab mid-work.
  const [activeTab, setActiveTab] = useState('timeline')

  // dialog form state
  const [scopeText, setScopeText] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string>('BANK_TRANSFER')
  const [payTxn, setPayTxn] = useState('')
  const [payMilestone, setPayMilestone] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [projectId, setProjectId] = useState('')

  // record-payment tab form state
  const [rpAmount, setRpAmount] = useState('')
  const [rpMethod, setRpMethod] = useState<string>('BANK_TRANSFER')
  const [rpTxn, setRpTxn] = useState('')
  const [rpMilestone, setRpMilestone] = useState('')
  const [rpNotes, setRpNotes] = useState('')
  const [rpBusy, setRpBusy] = useState(false)

  const projects = data?.projects ?? []
  const stageIdx = client?.pipelineStage ? PIPELINE_STAGES.indexOf(client.pipelineStage as (typeof PIPELINE_STAGES)[number]) : -1

  const clientApprovals = useMemo(() => {
    const list = approvalsApi.data?.approvals ?? []
    return list.filter((a) => {
      const cid = a.clientId ?? ''
      const label = clientDisplayName(a.client)
      return cid === clientId || label === client?.clientId || label === client?.name
    })
  }, [approvalsApi.data, clientId, client?.clientId, client?.name])

  const dialogs: Record<string, JourneyDialog> = {
    ASK_SCOPE_QUESTIONS: {
      action: 'ASK_SCOPE_QUESTIONS',
      title: 'Ask Scope Questions',
      description: 'The AI scope agent will send discovery questions to the client over their configured channels.',
      fields: 'none',
    },
    SUBMIT_SCOPE: {
      action: 'SUBMIT_SCOPE',
      title: 'Submit Requirements',
      description: 'Enter the client requirements / raw scope text. This creates a draft scope for AI review.',
      fields: 'scope',
    },
    GENERATE_PREVIEW: {
      action: 'GENERATE_PREVIEW',
      title: 'Generate HTML Preview',
      description: 'Generates the client-facing preview page from the final scope and sends the review link.',
      fields: 'none',
    },
    REQUEST_PAYMENT: {
      action: 'REQUEST_PAYMENT',
      title: 'Request Payment',
      description: 'Sends milestone payment instructions to the client. Sensitive sends are approval-gated.',
      fields: 'none',
    },
    RECORD_PAYMENT: {
      action: 'RECORD_PAYMENT',
      title: 'Record Payment (Journey)',
      description: 'Records a payment against this client and advances the payment stage.',
      fields: 'payment',
    },
    PREPARE_HANDOVER: {
      action: 'PREPARE_HANDOVER',
      title: 'Prepare Handover',
      description: 'Packages source code and deliverables. Handover release is payment-gated and approval-gated.',
      fields: 'project',
    },
    CLOSE_PROJECT: {
      action: 'CLOSE_PROJECT',
      title: 'Close Project',
      description: 'Closes the project and moves the client record to closure stage.',
      fields: 'project',
    },
    REQUEST_REVIEW: {
      action: 'REQUEST_REVIEW',
      title: 'Request Review & Referral',
      description: 'Creates the real Review + Referral records and asks the client (over configured channels) to share their experience. The client submits via the portal; an admin moderates before anything goes public.',
      fields: 'none',
    },
    REQUEST_REFERRAL: {
      action: 'REQUEST_REFERRAL',
      title: 'Request Referral',
      description: 'Same engine step as Request Review — creates the referral record and invites the client to refer another business from their portal.',
      fields: 'none',
    },
  }

  function openDialog(action: string) {
    const d = dialogs[action]
    if (!d) return
    if (d.fields === 'project' && projects.length > 0) setProjectId(projects[0].id)
    setJourneyMessage(null)
    setDialog(d)
  }

  async function runJourney(action: string, payload: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await api.journey({ clientId, action, payload })
      const text = res.message ?? (res.ok ? 'Action completed.' : 'Action did not complete.')
      setJourneyMessage({ ok: Boolean(res.ok), text, result: res.result ?? null })
      if (res.ok) toast.success(text)
      else toast.error(text)
      refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Journey action failed.'
      setJourneyMessage({ ok: false, text })
      toast.error(text)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  function confirmDialog() {
    if (!dialog) return
    if (dialog.fields === 'scope') {
      if (!scopeText.trim()) {
        toast.error('Scope text is required.')
        return
      }
      void runJourney('SUBMIT_SCOPE', { text: scopeText.trim(), scopeText: scopeText.trim() })
      return
    }
    if (dialog.fields === 'payment') {
      const amount = Number(payAmount)
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Enter a valid payment amount.')
        return
      }
      void runJourney('RECORD_PAYMENT', {
        amount,
        method: payMethod,
        transactionId: payTxn.trim() || undefined,
        milestone: payMilestone.trim() || undefined,
        notes: payNotes.trim() || undefined,
      })
      return
    }
    if (dialog.fields === 'project') {
      void runJourney(dialog.action, projectId ? { projectId } : {})
      return
    }
    void runJourney(dialog.action, {})
  }

  async function recordPaymentTab(e: React.FormEvent) {
    e.preventDefault()
    if (rpBusy) return
    const amount = Number(rpAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount.')
      return
    }
    setRpBusy(true)
    try {
      const res = await api.recordPayment({
        clientId,
        amount,
        method: rpMethod,
        transactionId: rpTxn.trim() || undefined,
        milestone: rpMilestone.trim() || undefined,
        notes: rpNotes.trim() || undefined,
      })
      toast.success(res.message ?? 'Payment recorded.')
      setRpAmount(''); setRpTxn(''); setRpMilestone(''); setRpNotes('')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.')
    } finally {
      setRpBusy(false)
    }
  }

  async function verifyPayment(paymentId: string) {
    try {
      const res = await api.verifyPayment(paymentId)
      toast.success(res.message ?? 'Payment verified.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed.')
    }
  }

  const previewLink = useMemo(() => {
    if (!journeyMessage?.result) return null
    const r = journeyMessage.result as Record<string, unknown>
    const link = typeof r.link === 'string' ? r.link : typeof r.previewUrl === 'string' ? r.previewUrl : null
    return link
  }, [journeyMessage])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-slate-800/60" />
        <Skeleton className="h-28 w-full bg-slate-800/50" />
        <Skeleton className="h-96 w-full bg-slate-800/40" />
      </div>
    )
  }
  if (error) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Button>
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load this client: {error}
        </div>
      </div>
    )
  }
  if (!client) return <EmptyState title="Client not found" />

  const paymentColumns: Column<PaymentRecord>[] = [
    {
      key: 'milestone',
      header: 'Milestone',
      cell: (p) => <span className="text-slate-300">{p.milestone || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (p) => <span className="font-semibold tabular-nums text-slate-100">{fmtMoney(num(p.amount), p.currency ?? 'USD')}</span>,
    },
    { key: 'method', header: 'Method', cell: (p) => <span className="text-slate-400">{prettify(p.method)}</span> },
    { key: 'txn', header: 'Transaction ID', cell: (p) => <span className="font-mono text-xs text-slate-500">{p.transactionId || '—'}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'verified',
      header: 'Verified',
      cell: (p) =>
        p.verifiedAt ? (
          <span className="text-xs text-slate-500">{fmtDateShort(p.verifiedAt)}{p.verifiedBy ? ` · ${p.verifiedBy}` : ''}</span>
        ) : (
          <span className="text-xs text-slate-600">Not verified</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (p) =>
        (p.status ?? '').toUpperCase() === 'PENDING' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            onClick={(e) => {
              e.stopPropagation()
              void verifyPayment(p.id)
            }}
          >
            Verify
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={client.clientId}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-300">{client.name}</span>
            {client.businessName ? <span className="text-slate-500">· {client.businessName}</span> : null}
            <StatusBadge status={client.status} />
            <StatusBadge status={client.pipelineStage} />
          </span>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-400 hover:text-slate-100"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh client"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
          </>
        }
      />

      {/* Stage stepper (20 stages) */}
      <section className={CARD} aria-label="Pipeline progress">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Journey Progress</h2>
            <span className="text-xs tabular-nums text-slate-500">
              {stageIdx >= 0 ? `Stage ${stageIdx + 1} of ${PIPELINE_STAGES.length}` : '—'} · {prettify(client.pipelineStage)}
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${((stageIdx + 1) / PIPELINE_STAGES.length) * 100}%`,
                background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`,
              }}
            />
          </div>
        </div>
        <div className={`overflow-x-auto px-4 py-4 ${SCROLL_THIN}`}>
          <ol className="flex min-w-max items-start gap-0" aria-label="Pipeline stages">
            {PIPELINE_STAGES.map((s, i) => {
              const done = i < stageIdx
              const current = i === stageIdx
              return (
                <li key={s} className="flex w-24 shrink-0 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
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
                      {done ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <span className="text-[9px] font-bold">{i + 1}</span>}
                    </span>
                    <span className={`h-0.5 flex-1 ${i === PIPELINE_STAGES.length - 1 ? 'invisible' : done ? 'bg-emerald-500/60' : 'bg-slate-800'}`} />
                  </div>
                  <span
                    className={`mt-1.5 text-[9px] font-medium leading-tight ${
                      current ? 'text-[#009FE3]' : done ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {prettify(s)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Contact + lead info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Contact" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500"><Mail className="size-3" aria-hidden="true" /> Email</dt>
              <dd className="mt-0.5 break-words text-slate-300">{client.email || '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500"><Phone className="size-3" aria-hidden="true" /> Phone</dt>
              <dd className="mt-0.5 text-slate-300">{client.phone || '—'}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500"><MessageSquare className="size-3" aria-hidden="true" /> WhatsApp</dt>
              <dd className="mt-0.5 text-slate-300">{client.whatsapp || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Country</dt>
              <dd className="mt-0.5 text-slate-300">{client.country || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Source</dt>
              <dd className="mt-0.5 text-slate-300">{prettify(client.source)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Preferred Contact</dt>
              <dd className="mt-0.5 text-slate-300">{prettify(client.preferredContact)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Client ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-slate-300">{client.clientId}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Created</dt>
              <dd className="mt-0.5 text-slate-300">{fmtDateShort(client.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-slate-500">Score</dt>
              <dd className="mt-0.5 text-slate-300">{num(client.score)}</dd>
            </div>
          </dl>
          {client.notes ? (
            <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Notes</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{client.notes}</p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Lead Intake" description={data?.lead ? 'Captured requirements' : 'No lead record attached'}>
          {data?.lead ? (
            <div className="space-y-2.5 text-sm">
              <p className="text-slate-400"><span className="text-slate-500">Project type:</span> {data.lead.projectType || '—'}</p>
              <p className="text-slate-400"><span className="text-slate-500">Budget:</span> {data.lead.budgetRange || '—'}</p>
              {data.lead.requirements ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Requirements</p>
                  <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed text-slate-400">
                    {data.lead.requirements}
                  </p>
                </div>
              ) : null}
              <p className="text-xs text-slate-600">Contacted: {fmtDateShort(data.lead.contactedAt)} · Qualified: {fmtDateShort(data.lead.qualifiedAt)}</p>
            </div>
          ) : (
            <EmptyState title="No lead details" />
          )}
        </SectionCard>
      </div>

      {/* Journey action bar */}
      <SectionCard
        title="Journey Actions"
        description="Advance this client through the pipeline — each action runs the real backend automation engine."
      >
        <div className="flex flex-wrap gap-2">
          {Object.keys(dialogs).map((action) => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => openDialog(action)}
              className="border-slate-700 bg-slate-900/60 text-slate-300 hover:border-[#009FE3]/50 hover:bg-[#009FE3]/10 hover:text-[#009FE3]"
            >
              {action === 'GENERATE_PREVIEW' ? <Sparkles className="size-3.5" aria-hidden="true" /> : null}
              {action === 'REQUEST_PAYMENT' || action === 'RECORD_PAYMENT' ? <BadgeDollarSign className="size-3.5" aria-hidden="true" /> : null}
              {action === 'PREPARE_HANDOVER' ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : null}
              {action === 'SUBMIT_SCOPE' || action === 'ASK_SCOPE_QUESTIONS' ? <FileText className="size-3.5" aria-hidden="true" /> : null}
              {action === 'CLOSE_PROJECT' ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
              {action === 'REQUEST_REVIEW' ? <Star className="size-3.5" aria-hidden="true" /> : null}
              {action === 'REQUEST_REFERRAL' ? <Users className="size-3.5" aria-hidden="true" /> : null}
              {dialogs[action].title}
            </Button>
          ))}
        </div>

        {journeyMessage ? (
          <div
            role="status"
            className={`mt-3 rounded-md border p-3 text-sm ${
              journeyMessage.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <p className="flex items-center gap-2 font-medium">
              {journeyMessage.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
              {journeyMessage.text}
            </p>
            {previewLink ? (
              <a
                href={previewLink}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#009FE3] underline-offset-2 hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden="true" /> Open preview: {previewLink}
              </a>
            ) : null}
            {journeyMessage.result && typeof journeyMessage.result === 'object' && Object.keys(journeyMessage.result).length > 0 ? (
              <div className="mt-2">
                <JsonView value={journeyMessage.result} maxHeightClass="max-h-48" />
              </div>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      {/* Detail tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-900/80 p-1">
          {[
            ['timeline', 'Timeline'],
            ['comms', `Communications (${(data?.communications ?? []).length})`],
            ['scope', `Scope (${(data?.scopes ?? []).length})`],
            ['payments', `Payments (${(data?.payments ?? []).length})`],
            ['projects', `Projects (${projects.length})`],
            ['approvals', `Approvals (${clientApprovals.length})`],
            ['documents', `Documents (${(data?.documents ?? []).length})`],
            ['meetings', `Meetings (${(data?.meetings ?? []).length})`],
            ['memory', `Memory (${(data?.memories ?? []).length})`],
            ['automation', `Automation (${(data?.automationLogs ?? []).length})`],
            ['research', 'AI Research'],
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

        <TabsContent value="timeline" className="mt-3">
          <SectionCard title="Merged Timeline" description="All events for this client, newest first" contentClassName="p-0">
            {(data?.timeline ?? []).length === 0 ? (
              <EmptyState title="No events yet" description="Timeline entries appear as the journey engine records them." />
            ) : (
              <ol className={`max-h-[60vh] overflow-auto ${SCROLL_THIN}`}>
                {(data?.timeline ?? [])
                  .slice()
                  .sort((a, b) => (a.at && b.at ? new Date(b.at).getTime() - new Date(a.at).getTime() : 0))
                  .map((ev, i) => (
                    <li key={i} className="relative flex gap-3 px-4 py-3 pl-6">
                      <span className="absolute left-2.5 top-5 size-2 rounded-full bg-[#009FE3]/70" aria-hidden="true" />
                      {i !== 0 ? <span className="absolute left-[13px] top-0 h-5 w-px bg-slate-800" aria-hidden="true" /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug text-slate-300">{ev.text || prettify(ev.type)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          {prettify(ev.type)} · {fmtDate(ev.at)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ol>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="comms" className="mt-3">
          <SectionCard title="Communications" description="Every message across channels — statuses are reported exactly as the providers returned them" contentClassName="p-0">
            <DataTable
              columns={[
                { key: 'channel', header: 'Channel', cell: (c) => <span className="text-xs font-medium text-slate-300">{prettify(c.channel)}</span> },
                {
                  key: 'dir',
                  header: 'Dir',
                  cell: (c) =>
                    (c.direction ?? '').toUpperCase() === 'IN' ? (
                      <span className="text-[11px] font-semibold text-[#009FE3]">IN</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-500">OUT</span>
                    ),
                },
                { key: 'recipient', header: 'Recipient', cell: (c) => <span className="text-xs text-slate-400">{c.recipient || c.sender || '—'}</span> },
                {
                  key: 'body',
                  header: 'Message',
                  className: 'max-w-[280px]',
                  cell: (c) => (
                    <div className="min-w-0">
                      {c.subject ? <p className="truncate text-xs font-medium text-slate-300">{c.subject}</p> : null}
                      <p className="truncate text-xs text-slate-500">{c.body || '—'}</p>
                    </div>
                  ),
                },
                { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} title={c.error ?? undefined} /> },
                { key: 'provider', header: 'Provider ID', cell: (c) => <span className="font-mono text-[11px] text-slate-600">{c.providerMessageId || '—'}</span> },
                { key: 'date', header: 'Date', cell: (c) => <span className="text-xs text-slate-500">{fmtDate(c.sentAt ?? c.createdAt)}</span> },
              ]}
              rows={data?.communications}
              rowKey={(c) => c.id}
              empty={<EmptyState title="No communications yet" description="Messages sent and received for this client will appear here." />}
              aria-label="Client communications"
              maxHeightClass="max-h-[60vh]"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="scope" className="mt-3">
          <div className="space-y-3">
            {(data?.scopes ?? []).length === 0 ? (
              <SectionCard>
                <EmptyState title="No scope versions yet" description="Submit requirements via the journey actions to create the first draft." />
              </SectionCard>
            ) : (
              (data?.scopes ?? [])
                .slice()
                .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
                .map((s) => {
                  const parsed = parseMaybeJson(s.content)
                  return (
                    <SectionCard
                      key={s.id}
                      title={`Version ${s.version ?? '—'} · ${prettify(s.status)}`}
                      description={`Created ${fmtDate(s.createdAt)}${s.generatedBy ? ` · generated by ${s.generatedBy}` : ''}`}
                      actions={<StatusBadge status={s.status} />}
                    >
                      {s.summary ? <p className="mb-2 text-[13px] text-slate-400">{s.summary}</p> : null}
                      {parsed ? <JsonView value={parsed} /> : <Markdownish text={s.content} />}
                      {s.aiNotes ? (
                        <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/50 p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                            <Bot className="size-3" aria-hidden="true" /> AI Notes
                          </p>
                          <Markdownish text={s.aiNotes} />
                        </div>
                      ) : null}
                    </SectionCard>
                  )
                })
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-3">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SectionCard title="Payments" description="Recorded payments — verify to activate projects and settle milestones" className="xl:col-span-2" contentClassName="p-0">
              <DataTable
                columns={paymentColumns}
                rows={data?.payments}
                rowKey={(p) => p.id}
                empty={<EmptyState title="No payments yet" description="Payments appear here after the first record." />}
                aria-label="Client payments"
                maxHeightClass="max-h-[60vh]"
              />
            </SectionCard>
            <SectionCard title="Record Payment" description="Manually record an incoming payment">
              <form onSubmit={recordPaymentTab} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-amount" className="text-xs text-slate-400">Amount (USD)</Label>
                  <Input id="rp-amount" type="number" min="0" step="0.01" required value={rpAmount} onChange={(e) => setRpAmount(e.target.value)} className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-method" className="text-xs text-slate-400">Method</Label>
                  <Select value={rpMethod} onValueChange={setRpMethod}>
                    <SelectTrigger id="rp-method" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                      {PAY_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{prettify(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-txn" className="text-xs text-slate-400">Transaction ID</Label>
                  <Input id="rp-txn" value={rpTxn} onChange={(e) => setRpTxn(e.target.value)} placeholder="Optional" className="h-9 border-slate-800 bg-slate-950/60 font-mono text-xs text-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-milestone" className="text-xs text-slate-400">Milestone</Label>
                  <Input id="rp-milestone" value={rpMilestone} onChange={(e) => setRpMilestone(e.target.value)} placeholder="e.g. ADVANCE, FINAL" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-notes" className="text-xs text-slate-400">Notes</Label>
                  <Textarea id="rp-notes" value={rpNotes} onChange={(e) => setRpNotes(e.target.value)} rows={2} className="border-slate-800 bg-slate-950/60 text-sm text-slate-200" />
                </div>
                <Button type="submit" disabled={rpBusy} className="w-full font-semibold" style={{ background: '#18B83A' }}>
                  {rpBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Record Payment
                </Button>
              </form>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-3">
          <SectionCard title="Projects" description="Delivery projects for this client" contentClassName="p-0">
            <DataTable
              columns={[
                { key: 'code', header: 'Code', cell: (p) => <span className="font-mono text-xs text-[#009FE3]">{p.code || '—'}</span> },
                { key: 'name', header: 'Name', cell: (p) => <span className="font-medium text-slate-200">{p.name}</span> },
                { key: 'plan', header: 'Plan', cell: (p) => <span className="text-slate-400">{p.plan || '—'}</span> },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
                { key: 'total', header: 'Total', cell: (p) => <span className="tabular-nums text-slate-300">{fmtMoney(num(p.totalAmount), p.currency ?? 'USD')}</span> },
                { key: 'paid', header: 'Paid', cell: (p) => <span className="tabular-nums text-emerald-400">{fmtMoney(num(p.paidAmount), p.currency ?? 'USD')}</span> },
                { key: 'started', header: 'Started', cell: (p) => <span className="text-xs text-slate-500">{fmtDateShort(p.startedAt)}</span> },
              ]}
              rows={projects}
              rowKey={(p) => p.id}
              onRowClick={(p) => onOpenProject(p.id)}
              empty={<EmptyState title="No projects yet" description="A project is created when payment activates the scope." />}
              aria-label="Client projects"
              maxHeightClass="max-h-[60vh]"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="approvals" className="mt-3">
          <SectionCard title="Approval Requests" description="Governance queue items linked to this client" contentClassName="p-0">
            {approvalsApi.loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-800/50" />
                ))}
              </div>
            ) : clientApprovals.length === 0 ? (
              <EmptyState title="No approval requests" description="Approval-gated actions for this client will queue here." />
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {clientApprovals.map((a: ApprovalItem) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{a.title}</p>
                      <p className="text-xs text-slate-500">{prettify(a.type)} · {fmtDate(a.createdAt)}{a.agentCode ? ` · ${a.agentCode}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={a.risk} />
                      <StatusBadge status={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents" className="mt-3">
          <DocumentsPanel
            clientId={client.clientId}
            documents={data?.documents ?? []}
            onChanged={refresh}
          />
        </TabsContent>

        <TabsContent value="meetings" className="mt-3">
          <MeetingsPanel
            clientId={client.clientId}
            clientName={clientDisplayName(data?.client)}
            meetings={data?.meetings ?? []}
            onChanged={refresh}
          />
        </TabsContent>

        <TabsContent value="memory" className="mt-3">
          <SectionCard title="AI Memory" description="What the AI workforce remembers about this client" contentClassName="p-0">
            {(data?.memories ?? []).length === 0 ? (
              <EmptyState title="No memories yet" description="Agents store durable client context here as they work." />
            ) : (
              <ul className={`max-h-[60vh] divide-y divide-slate-800/60 overflow-auto ${SCROLL_THIN}`}>
                {(data?.memories ?? []).map((m) => (
                  <li key={m.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{m.scope}</span>
                      <span className="font-mono text-xs text-slate-300">{m.key}</span>
                      <span className="ml-auto text-[11px] text-slate-600">importance {num(m.importance)} · {fmtDate(m.updatedAt ?? m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{m.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="automation" className="mt-3">
          <SectionCard title="Automation Logs" description="Workflow engine runs related to this client" contentClassName="p-0">
            <DataTable
              columns={[
                { key: 'workflow', header: 'Workflow', cell: (l) => <span className="font-mono text-xs text-slate-300">{l.workflow || '—'}</span> },
                { key: 'status', header: 'Status', cell: (l) => <StatusBadge status={l.status} /> },
                { key: 'duration', header: 'Duration', cell: (l) => <span className="tabular-nums text-xs text-slate-500">{l.durationMs != null ? `${num(l.durationMs)} ms` : '—'}</span> },
                { key: 'corr', header: 'Correlation ID', cell: (l) => <span className="font-mono text-[11px] text-slate-600">{l.correlationId || '—'}</span> },
                { key: 'when', header: 'Started', cell: (l) => <span className="text-xs text-slate-500">{fmtDate(l.startedAt ?? l.createdAt)}</span> },
              ]}
              rows={data?.automationLogs}
              rowKey={(l) => l.id}
              empty={<EmptyState title="No automation runs yet" description="Workflow executions for this client will appear here." />}
              aria-label="Automation logs"
              maxHeightClass="max-h-[60vh]"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="research" className="mt-3">
          <AiResearchPanel clientId={client.clientId} clientLabel={clientDisplayName(client)} />
        </TabsContent>
      </Tabs>

      {/* Journey dialog */}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">{dialog?.title}</DialogTitle>
            <DialogDescription className="text-slate-500">{dialog?.description}</DialogDescription>
          </DialogHeader>

          {dialog?.fields === 'scope' ? (
            <div className="space-y-1.5">
              <Label htmlFor="scope-text" className="text-xs text-slate-400">Requirements / scope text</Label>
              <Textarea
                id="scope-text"
                rows={6}
                value={scopeText}
                onChange={(e) => setScopeText(e.target.value)}
                placeholder="Paste the client requirements here…"
                className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
              />
            </div>
          ) : null}

          {dialog?.fields === 'payment' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jp-amount" className="text-xs text-slate-400">Amount</Label>
                <Input id="jp-amount" type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jp-method" className="text-xs text-slate-400">Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger id="jp-method" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {PAY_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{prettify(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="jp-txn" className="text-xs text-slate-400">Transaction ID</Label>
                <Input id="jp-txn" value={payTxn} onChange={(e) => setPayTxn(e.target.value)} className="h-9 border-slate-800 bg-slate-950/60 font-mono text-xs text-slate-200" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="jp-milestone" className="text-xs text-slate-400">Milestone</Label>
                <Input id="jp-milestone" value={payMilestone} onChange={(e) => setPayMilestone(e.target.value)} placeholder="ADVANCE / MILESTONE / FINAL" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="jp-notes" className="text-xs text-slate-400">Notes</Label>
                <Input id="jp-notes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" />
              </div>
            </div>
          ) : null}

          {dialog?.fields === 'project' ? (
            projects.length === 0 ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                This client has no projects yet — the backend will apply its default project selection or refuse the action.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="jp-project" className="text-xs text-slate-400">Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger id="jp-project" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code ?? p.id} · {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy} className="text-slate-400 hover:text-slate-200">
              Cancel
            </Button>
            <Button onClick={confirmDialog} disabled={busy} className="font-semibold" style={{ background: ACCENT }}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Run Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ---------------- Documents hub panel (moderation + two-way sharing) ----------------
const DOC_CLASSIFICATIONS = ['PUBLIC', 'PRIVATE', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE'] as const
const DOC_ACCEPT = '.pdf,.txt,.md,.csv,.json,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.webp'

function docScanTone(status: string): string {
  if (status === 'CLEAN') return 'bg-emerald-500/15 text-emerald-300'
  if (status === 'QUARANTINED') return 'bg-amber-500/15 text-amber-300'
  if (status === 'REJECTED') return 'bg-red-500/15 text-red-300'
  return 'bg-slate-700/50 text-slate-400'
}

function fmtDocSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function DocumentsPanel({
  clientId,
  documents,
  onChanged,
}: {
  clientId: string
  documents: DocumentRecord[]
  onChanged: () => void
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [shareFile, setShareFile] = useState<File | null>(null)
  const [shareNote, setShareNote] = useState('')
  const [shareClass, setShareClass] = useState<string>('PRIVATE')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const quarantined = documents.filter((d) => d.scanStatus === 'QUARANTINED').length
  const totalDownloads = documents.reduce((s, d) => s + d.downloads, 0)

  async function share() {
    if (!shareFile) { toast.error('Choose a file first.'); return }
    setShareBusy(true)
    try {
      const res = await api.docShare(clientId, shareFile, shareNote.trim(), shareClass)
      toast.success(res.message ?? 'File shared with the client.')
      setShareOpen(false)
      setShareFile(null)
      setShareNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Share failed.')
    } finally { setShareBusy(false) }
  }

  async function moderate(docId: string, action: 'RELEASE' | 'REJECT') {
    setBusyId(docId + action)
    try {
      const res = await api.docStatus(docId, action)
      toast.success(res.message ?? 'Updated.')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally { setBusyId(null) }
  }

  return (
    <SectionCard
      title="Documents Hub"
      description="Two-way file exchange — client uploads awaiting moderation and files shared by the team"
      contentClassName="p-0"
      actions={
        <Button size="sm" onClick={() => setShareOpen(true)} className="gap-1.5" style={{ background: ACCENT }}>
          <Upload className="size-3.5" aria-hidden="true" /> Share file with client
        </Button>
      }
    >
      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Files the client uploads from their portal (brand assets, briefs, payment proofs) and files your team shares back appear here — every one scanned and audited."
        />
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 border-b border-slate-800/60 px-4 py-2.5 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-800/70 px-2 py-0.5">{documents.length} files</span>
            <span className="rounded-full bg-slate-800/70 px-2 py-0.5">{fmtDocSize(documents.reduce((s, d) => s + d.size, 0))} stored</span>
            <span className="rounded-full bg-slate-800/70 px-2 py-0.5">{totalDownloads} downloads</span>
            {quarantined > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">
                {quarantined} quarantined — review required
              </span>
            )}
          </div>
          <ul className={`max-h-[60vh] divide-y divide-slate-800/60 overflow-auto ${SCROLL_THIN}`}>
            {documents.map((d) => {
              const scan = (d.scanResult ?? {}) as { verdict?: string; notes?: string[]; releasedBy?: string; rejectedBy?: string }
              return (
                <li key={d.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${d.direction === 'SHARED' ? 'bg-[#009FE3]/15 text-[#7dd3fc]' : 'bg-slate-800/70 text-slate-400'}`}>
                      <Paperclip className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/admin/documents/${encodeURIComponent(d.id)}`}
                          className="truncate text-sm font-semibold text-slate-200 underline-offset-2 hover:text-white hover:underline"
                        >
                          {d.name}
                        </a>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${docScanTone(d.scanStatus)}`}>
                          {d.scanStatus.toLowerCase()}
                        </span>
                        <span className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                          {d.classification.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
                        <span>{d.direction === 'SHARED' ? 'shared by Tech360' : 'client upload'}</span>
                        <span>· {fmtDocSize(d.size)}</span>
                        <span>· {d.downloads} dl</span>
                        <span>· {d.uploadedBy || '—'}</span>
                        <span>· {fmtDate(d.at)}</span>
                        {d.note ? <span className="text-slate-400">· “{d.note}”</span> : null}
                      </p>
                      {scan.notes && scan.notes.length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-600">scan: {scan.notes.join(' · ')}</p>
                      )}
                      {scan.releasedBy && (
                        <p className="mt-1 text-[11px] text-emerald-400/80">released by {scan.releasedBy}</p>
                      )}
                      {scan.rejectedBy && (
                        <p className="mt-1 text-[11px] text-red-400/80">rejected by {scan.rejectedBy} — content removed, record retained</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {d.scanStatus === 'QUARANTINED' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === d.id + 'RELEASE'}
                            onClick={() => moderate(d.id, 'RELEASE')}
                            className="h-7 gap-1 border-emerald-500/40 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
                          >
                            {busyId === d.id + 'RELEASE' ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-3" aria-hidden="true" />}
                            Release
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === d.id + 'REJECT'}
                            onClick={() => moderate(d.id, 'REJECT')}
                            className="h-7 gap-1 border-red-500/40 text-[11px] text-red-300 hover:bg-red-500/10"
                          >
                            {busyId === d.id + 'REJECT' ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3" aria-hidden="true" />}
                            Reject
                          </Button>
                        </>
                      )}
                      {d.scanStatus === 'CLEAN' && d.direction === 'UPLOADED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === d.id + 'REJECT'}
                          onClick={() => moderate(d.id, 'REJECT')}
                          className="h-7 gap-1 border-red-500/40 text-[11px] text-red-300 hover:bg-red-500/10"
                        >
                          {busyId === d.id + 'REJECT' ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3" aria-hidden="true" />}
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" aria-hidden="true" /> Share a file with {clientId}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              The file is scanned with the same engine as client uploads — flagged files are refused, never delivered.
              Clean files become visible in the client portal instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="share-file" className="text-xs text-slate-400">File (≤ 5MB · pdf, docx, xlsx, images, text)</Label>
              <input
                ref={fileInputRef}
                id="share-file"
                type="file"
                accept={DOC_ACCEPT}
                onChange={(e) => setShareFile(e.target.files?.[0] ?? null)}
                className="w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-400 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
              />
              {shareFile && (
                <p className="text-[11px] text-slate-500">{shareFile.name} · {fmtDocSize(shareFile.size)} — ready to scan &amp; share</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-note" className="text-xs text-slate-400">Note shown to the client</Label>
              <Input
                id="share-note"
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
                placeholder="e.g. Milestone 2 invoice — bank transfer copy"
                maxLength={300}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Classification</Label>
              <Select value={shareClass} onValueChange={setShareClass}>
                <SelectTrigger className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" aria-label="Classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {DOC_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {['CONFIDENTIAL', 'HIGHLY_SENSITIVE'].includes(shareClass) && (
                <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  Sensitive classification — the client sees the label; the file stays bound to their Client ID and every download is audited.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareOpen(false)} disabled={shareBusy} className="text-slate-400 hover:text-slate-200">Cancel</Button>
            <Button onClick={share} disabled={shareBusy || !shareFile} className="font-semibold" style={{ background: ACCENT }}>
              {shareBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
              Scan &amp; share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ---------------- Meetings panel (real scheduling + lifecycle) ----------------
const MEETING_CHANNELS = [
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'WHATSAPP_CALL', label: 'WhatsApp call' },
] as const

const RESPONSE_TONE: Record<string, string> = {
  CONFIRMED: 'bg-emerald-500/15 text-emerald-300',
  DECLINED: 'bg-red-500/15 text-red-300',
  RESCHEDULE_REQUESTED: 'bg-amber-500/15 text-amber-300',
}

function fmtMeetingWhenFull(d?: string | null): string {
  if (!d) return 'Time to be confirmed'
  try {
    const dt = new Date(d)
    return dt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return 'Time to be confirmed' }
}

function MeetingsPanel({
  clientId,
  clientName,
  meetings,
  onChanged,
}: {
  clientId: string
  clientName: string
  meetings: MeetingRecord[]
  onChanged: () => void
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [mWhen, setMWhen] = useState('')
  const [mChannel, setMChannel] = useState<string>('GOOGLE_MEET')
  const [mReason, setMReason] = useState('')
  const [mLink, setMLink] = useState('')
  const [mNotes, setMNotes] = useState('')
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<MeetingRecord | null>(null)
  const [reschedWhen, setReschedWhen] = useState('')
  const [completeFor, setCompleteFor] = useState<MeetingRecord | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')

  const active = meetings.filter((m) => ['REQUESTED', 'SCHEDULED'].includes(m.status ?? ''))
  const upcoming = active.filter((m) => !m.scheduledAt || new Date(m.scheduledAt).getTime() > Date.now() - 60 * 60_000)
  const awaitingClient = active.filter((m) => m.clientResponse === 'RESCHEDULE_REQUESTED')

  async function schedule() {
    if (!mWhen) { toast.error('Pick a date and time first.'); return }
    setScheduleBusy(true)
    try {
      const res = await api.meetingSchedule({
        clientId,
        scheduledAt: new Date(mWhen).toISOString(),
        channel: mChannel,
        reason: mReason.trim() || undefined,
        bookingLink: mLink.trim() || undefined,
        notes: mNotes.trim() || undefined,
      })
      toast.success(`Meeting scheduled. ${res.agent?.ok ? 'Tempo (MTG-015) prepared the agenda — see the notes on the new row.' : 'Agent unavailable — add notes manually.'}`)
      setScheduleOpen(false)
      setMWhen(''); setMReason(''); setMLink(''); setMNotes('')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scheduling failed.')
    } finally { setScheduleBusy(false) }
  }

  async function manage(m: MeetingRecord, action: 'COMPLETE' | 'CANCEL' | 'RESCHEDULE', body?: { notes?: string; scheduledAt?: string }) {
    setBusyId(m.id + action)
    try {
      const res = await api.meetingManage(m.id, action, body)
      toast.success(res.message ?? 'Updated.')
      setRescheduleFor(null); setReschedWhen('')
      setCompleteFor(null); setCompleteNotes('')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally { setBusyId(null) }
  }

  return (
    <SectionCard
      title="Meetings"
      description="Real scheduling with the client — invitations land in their portal and their responses appear here"
      contentClassName="p-0"
      actions={
        <Button size="sm" onClick={() => setScheduleOpen(true)} className="gap-1.5" style={{ background: ACCENT }}>
          <CalendarDays className="size-3.5" aria-hidden="true" /> Schedule meeting
        </Button>
      }
    >
      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Schedule a consultation, progress review or handover walkthrough — the client confirms or proposes a new time from their portal."
        />
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 border-b border-slate-800/60 px-4 py-2.5 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-800/70 px-2 py-0.5">{upcoming.length} upcoming</span>
            <span className="rounded-full bg-slate-800/70 px-2 py-0.5">{meetings.filter((m) => m.status === 'COMPLETED').length} completed</span>
            {awaitingClient.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">
                {awaitingClient.length} awaiting a new time proposal
              </span>
            )}
          </div>
          <ul className={`max-h-[60vh] divide-y divide-slate-800/60 overflow-auto ${SCROLL_THIN}`}>
            {[...meetings]
              .sort((a, b) => (b.scheduledAt ?? b.createdAt ?? '').localeCompare(a.scheduledAt ?? a.createdAt ?? ''))
              .map((m) => {
                const isActive = ['REQUESTED', 'SCHEDULED'].includes(m.status ?? '')
                return (
                  <li key={m.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${m.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-300' : isActive ? 'bg-[#009FE3]/15 text-[#7dd3fc]' : 'bg-slate-800/70 text-slate-500'}`}>
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-200">{m.reason ?? 'Consultation call'}</p>
                          <StatusBadge status={m.status ?? ''} />
                          {m.clientResponse && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RESPONSE_TONE[m.clientResponse] ?? 'bg-slate-700/50 text-slate-400'}`}>
                              client: {m.clientResponse === 'RESCHEDULE_REQUESTED' ? 'wants new time' : m.clientResponse.toLowerCase()}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-400">{fmtMeetingWhenFull(m.scheduledAt)}</span>
                          <span>· {MEETING_CHANNELS.find((c) => c.value === (m.channel ?? 'GOOGLE_MEET'))?.label ?? m.channel}</span>
                          <span>· created {fmtDate(m.createdAt)}</span>
                          {m.bookingLink && (
                            <a href={m.bookingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#009FE3] hover:underline">
                              join link <ExternalLink className="size-2.5" aria-hidden="true" />
                            </a>
                          )}
                        </p>
                        {m.clientRespondedAt && (
                          <p className="mt-0.5 text-[11px] text-slate-600">client responded {fmtDate(m.clientRespondedAt)}</p>
                        )}
                        {m.notes && (
                          <details className="group mt-1.5" open={m.status === 'SCHEDULED' && m.createdAt != null && Date.now() - new Date(m.createdAt).getTime() < 5 * 60_000}>
                            <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-500 hover:text-slate-300">
                              <span className="inline-flex items-center gap-1">Agenda &amp; notes <Clock className="size-2.5 transition-transform group-open:rotate-90" aria-hidden="true" /></span>
                            </summary>
                            <p className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950/60 p-2 text-[11.5px] leading-relaxed text-slate-400">{m.notes.slice(0, 1500)}</p>
                          </details>
                        )}
                      </div>
                      {isActive && (
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <Button
                            size="sm" variant="outline"
                            disabled={busyId === m.id + 'COMPLETE'}
                            onClick={() => { setCompleteFor(m); setCompleteNotes('') }}
                            className="h-7 gap-1 border-emerald-500/40 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <CheckCircle2 className="size-3" aria-hidden="true" /> Complete
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={busyId === m.id + 'RESCHEDULE'}
                            onClick={() => { setRescheduleFor(m); setReschedWhen('') }}
                            className="h-7 gap-1 border-[#009FE3]/40 text-[11px] text-[#7dd3fc] hover:bg-[#009FE3]/10"
                          >
                            <Clock className="size-3" aria-hidden="true" /> Move
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={busyId === m.id + 'CANCEL'}
                            onClick={() => manage(m, 'CANCEL')}
                            className="h-7 gap-1 border-red-500/40 text-[11px] text-red-300 hover:bg-red-500/10"
                          >
                            {busyId === m.id + 'CANCEL' ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3" aria-hidden="true" />}
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* inline reschedule row */}
                    {rescheduleFor?.id === m.id && (
                      <div className="mt-2.5 flex flex-wrap items-end gap-2 rounded-lg border border-[#009FE3]/30 bg-[#009FE3]/5 p-2.5">
                        <div className="space-y-1">
                          <Label htmlFor={`rs-when-${m.id}`} className="text-[11px] text-slate-400">New date &amp; time</Label>
                          <Input
                            id={`rs-when-${m.id}`}
                            type="datetime-local"
                            value={reschedWhen}
                            onChange={(e) => setReschedWhen(e.target.value)}
                            className="h-8 w-56 border-slate-800 bg-slate-950/60 text-xs text-slate-200"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={busyId === m.id + 'RESCHEDULE' || !reschedWhen}
                          onClick={() => manage(m, 'RESCHEDULE', { scheduledAt: new Date(reschedWhen).toISOString() })}
                          className="h-8 gap-1 font-semibold"
                          style={{ background: ACCENT }}
                        >
                          {busyId === m.id + 'RESCHEDULE' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CalendarDays className="size-3.5" aria-hidden="true" />}
                          Confirm new time
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRescheduleFor(null)} className="h-8 text-[11px] text-slate-400">Dismiss</Button>
                      </div>
                    )}
                    {/* inline complete row */}
                    {completeFor?.id === m.id && (
                      <div className="mt-2.5 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                        <Label htmlFor={`done-${m.id}`} className="text-[11px] text-slate-400">Outcome notes (visible to the client in their portal)</Label>
                        <Textarea
                          id={`done-${m.id}`}
                          value={completeNotes}
                          onChange={(e) => setCompleteNotes(e.target.value)}
                          rows={2}
                          maxLength={1000}
                          placeholder="e.g. Agreed milestone 2 scope, client will send brand assets by Friday…"
                          className="border-slate-800 bg-slate-950/60 text-xs text-slate-200"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            disabled={busyId === m.id + 'COMPLETE' || !completeNotes.trim()}
                            onClick={() => manage(m, 'COMPLETE', { notes: completeNotes.trim() })}
                            className="h-8 gap-1 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                          >
                            {busyId === m.id + 'COMPLETE' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                            Mark completed
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setCompleteFor(null)} className="h-8 text-[11px] text-slate-400">Dismiss</Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      )}

      {/* Schedule dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" aria-hidden="true" /> Schedule a meeting with {clientName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              The invitation appears instantly in the client&apos;s portal (Meetings section) — they confirm or propose a new time there.
              MTG-015 “Tempo” prepares a call agenda from the client&apos;s live context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meet-when" className="text-xs text-slate-400">Date &amp; time</Label>
                <Input
                  id="meet-when"
                  type="datetime-local"
                  value={mWhen}
                  onChange={(e) => setMWhen(e.target.value)}
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Channel</Label>
                <Select value={mChannel} onValueChange={setMChannel}>
                  <SelectTrigger className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" aria-label="Meeting channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {MEETING_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meet-reason" className="text-xs text-slate-400">Purpose (title the client sees)</Label>
              <Input
                id="meet-reason"
                value={mReason}
                onChange={(e) => setMReason(e.target.value)}
                placeholder="e.g. Scope walkthrough — milestone 1 review"
                maxLength={200}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meet-link" className="text-xs text-slate-400">Joining link (optional)</Label>
              <Input
                id="meet-link"
                value={mLink}
                onChange={(e) => setMLink(e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                maxLength={500}
                className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
              />
              <p className="text-[11px] text-slate-600">For phone/WhatsApp calls, leave empty — the client will use the number on file.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meet-notes" className="text-xs text-slate-400">Private notes (prepended to the agenda)</Label>
              <Textarea
                id="meet-notes"
                value={mNotes}
                onChange={(e) => setMNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Anything specific to cover…"
                className="border-slate-800 bg-slate-950/60 text-slate-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)} disabled={scheduleBusy} className="text-slate-400 hover:text-slate-200">Cancel</Button>
            <Button onClick={schedule} disabled={scheduleBusy || !mWhen} className="font-semibold" style={{ background: ACCENT }}>
              {scheduleBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CalendarDays className="size-4" aria-hidden="true" />}
              Schedule &amp; prepare agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ---------------- AI Research panel (CRM-003 lead enrichment dossier) ----------------

interface EnrichRecommendedService {
  service: string
  reasoning: string
}

interface EnrichDossier {
  companySnapshot: string
  industryAnalysis: string
  recommendedServices: EnrichRecommendedService[]
  talkingPoints: string[]
  risks: string[]
  budgetExpectation: string
  recommendedPlan: string
  priorityScore: number
  followUpRecommendation: string
  confidenceNote: string
}

interface EnrichWebResearch {
  ok: boolean
  url: string
  fetchedAt?: string
  error?: string
  chars?: number
  title?: string
}

interface EnrichResponse {
  ok?: boolean
  dossier: EnrichDossier | null
  agentCode?: string
  executedAt?: string | null
  executionId?: string | null
  cached?: boolean
  webResearch?: EnrichWebResearch | null
  suggestedWebsiteUrl?: string | null
}

function scoreTone(score: number): { chip: string; text: string; label: string } {
  if (score >= 70) return { chip: 'bg-red-500/15 text-red-300', text: 'text-red-300', label: 'Hot lead' }
  if (score >= 40) return { chip: 'bg-amber-500/15 text-amber-300', text: 'text-amber-300', label: 'Warm lead' }
  return { chip: 'bg-slate-700/50 text-slate-400', text: 'text-slate-400', label: 'Low priority' }
}

function scoreRingColor(score: number): string {
  if (score >= 70) return '#EF4444'
  if (score >= 40) return '#F59E0B'
  return '#64748B'
}

function PriorityRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const r = 26
  const circumference = 2 * Math.PI * r
  const tone = scoreTone(clamped)
  return (
    <div className="relative size-16 shrink-0">
      <svg
        viewBox="0 0 64 64"
        className="size-16 -rotate-90"
        role="img"
        aria-label={`AI priority score ${clamped} out of 100 — ${tone.label}`}
      >
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={scoreRingColor(clamped)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * clamped) / 100}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold tabular-nums ${tone.text}`}>{clamped}</span>
      </div>
    </div>
  )
}

function AiResearchPanel({ clientId, clientLabel }: { clientId: string; clientLabel: string }) {
  const enrichApi = useApi<EnrichResponse>(`/api/admin/clients/${encodeURIComponent(clientId)}/enrich`)

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [override, setOverride] = useState<EnrichResponse | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')

  // prefill from the suggested URL extracted out of the lead record (once)
  useEffect(() => {
    if (!websiteUrl && enrichApi.data?.suggestedWebsiteUrl) {
      setWebsiteUrl(enrichApi.data.suggestedWebsiteUrl)
    }
  }, [enrichApi.data?.suggestedWebsiteUrl, websiteUrl])

  const record = override ?? enrichApi.data
  const dossier = record?.dossier ?? null

  async function runResearch() {
    if (running) return
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetchJson<EnrichResponse>(`/api/admin/clients/${encodeURIComponent(clientId)}/enrich`, {
        method: 'POST',
        body: { websiteUrl: websiteUrl.trim() || undefined },
      })
      setOverride(res)
      if (res.cached) {
        toast.info('Recent research returned — generated less than 2 minutes ago (agent quota protected).')
      } else if (res.webResearch?.ok) {
        toast.success('AI research completed with live web research.')
      } else if (res.webResearch && !res.webResearch.ok) {
        toast.warning(`Website fetch failed (${res.webResearch.error ?? 'unknown error'}) — the dossier was generated from CRM data only.`)
      } else {
        toast.success('AI research completed.')
      }
    } catch (e) {
      // honest failure — surface the real API error, keep any existing dossier visible
      setRunError(e instanceof Error ? e.message : 'AI research failed.')
    } finally {
      setRunning(false)
    }
  }

  const websiteInput = (
    <div className="relative w-full">
      <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <Input
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="https://client-website.com — optional, fetched live as primary evidence"
        aria-label="Client website URL for live research"
        className="h-8 w-full border-slate-700 bg-slate-900/60 pl-8 text-xs text-slate-200"
      />
    </div>
  )

  if (enrichApi.loading && !record) {
    return (
      <SectionCard title="AI Research" description="CRM-003 “Ledger” — market-intelligence dossier for this client">
        <div className="space-y-3">
          <Skeleton className="h-24 w-full bg-slate-800/50" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-40 w-full bg-slate-800/40" />
            <Skeleton className="h-40 w-full bg-slate-800/40" />
          </div>
        </div>
      </SectionCard>
    )
  }

  if (enrichApi.error && !record) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Could not load AI research: {enrichApi.error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {runError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{runError}</span>
        </div>
      ) : null}

      {!dossier ? (
        <SectionCard
          title="AI Research"
          description="CRM-003 “Ledger” — market-intelligence dossier for this client"
        >
          <EmptyState
            icon={Sparkles}
            title="No AI research yet"
            description={
              <>
                Ledger (CRM-003) builds a market-intelligence dossier for {clientLabel}: company snapshot, industry
                analysis, recommended TECH360 services with reasoning, talking points, risks, budget expectation, a
                phased plan and a follow-up recommendation.
              </>
            }
            action={
              <div className="flex w-full max-w-md flex-col gap-2">
                {websiteInput}
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Leave empty for CRM-only research, or paste the client&apos;s website to fetch it live (firecrawl-style)
                  and feed it to the agent as primary evidence.
                </p>
                <Button
                  onClick={runResearch}
                  disabled={running}
                  className="mt-1 w-full font-semibold"
                  style={{ background: ACCENT }}
                >
                  {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                  Run AI research on this client
                </Button>
              </div>
            }
          />
        </SectionCard>
      ) : (
        <>
          {/* Dossier header — priority, re-run controls and evidence provenance */}
          <section className={CARD} aria-label="AI research dossier header">
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <PriorityRing score={dossier.priorityScore} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${scoreTone(dossier.priorityScore).chip}`}>
                        {scoreTone(dossier.priorityScore).label}
                      </span>
                      <span className={`text-sm font-semibold tabular-nums ${scoreTone(dossier.priorityScore).text}`}>
                        {Math.max(0, Math.min(100, Math.round(dossier.priorityScore)))}/100
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Hot ≥ 70 · Warm 40–69 · Low &lt; 40</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="sm:w-80">{websiteInput}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={runResearch}
                    disabled={running}
                    className="h-8 gap-1.5 border border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                  >
                    {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
                    Re-run research
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-600">
                Generated {record?.executedAt ? fmtDate(record.executedAt) : '—'} by {record?.agentCode ?? 'CRM-003'}
                {record?.executionId ? ` · execution ${record.executionId.slice(0, 8)}` : ''}
                {record?.cached ? ' · cached (generated less than 2 minutes ago)' : ''}
              </p>

              {record?.webResearch ? (
                record.webResearch.ok ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-400/90">
                    <Globe className="size-3 shrink-0" aria-hidden="true" />
                    Web research included — {record.webResearch.title || record.webResearch.url}
                    {record.webResearch.chars ? ` · ${num(record.webResearch.chars)} chars fetched live from ` : ' · '}
                    <a
                      href={record.webResearch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline-offset-2 hover:underline"
                    >
                      {record.webResearch.url}
                    </a>
                  </p>
                ) : (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-400/90">
                    <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    Web research failed ({record.webResearch.error ?? 'unknown error'}) — this dossier is based on CRM data only.
                  </p>
                )
              ) : null}
            </div>
          </section>

          {/* Dossier body */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Company Snapshot" description="Who this business is and how they sell">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.companySnapshot}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <Building2 className="size-4 text-[#7dd3fc]" aria-hidden="true" /> Grounded in the CRM record{record?.webResearch?.ok ? ' + live website evidence' : ''}
              </p>
            </SectionCard>

            <SectionCard title="Industry Analysis" description="Vertical, pains and buying behavior">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.industryAnalysis}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <TrendingUp className="size-4 text-[#7dd3fc]" aria-hidden="true" /> Market context for the pitch
              </p>
            </SectionCard>

            <SectionCard title="Budget Expectation" description="What they are realistically able to spend">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.budgetExpectation}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <BadgeDollarSign className="size-4 text-[#7dd3fc]" aria-hidden="true" /> Stated range + agent estimate
              </p>
            </SectionCard>

            <SectionCard title="Recommended Plan" description="Phased engagement plan">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.recommendedPlan}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <Route className="size-4 text-[#7dd3fc]" aria-hidden="true" /> First milestone included
              </p>
            </SectionCard>

            <SectionCard title="Follow-up Recommendation" description="Concrete next step with timing" className="lg:col-span-2">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.followUpRecommendation}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <CalendarClock className="size-4 text-[#7dd3fc]" aria-hidden="true" /> Act on this, not the score alone
              </p>
            </SectionCard>

            <SectionCard title="Recommended Services" description="From the TECH360 catalog, with reasoning">
              <div className="space-y-2.5">
                {dossier.recommendedServices.length > 0 ? (
                  dossier.recommendedServices.map((s, i) => (
                    <div key={i} className="rounded-md border border-slate-800 bg-slate-950/40 p-2.5">
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-200">
                        <Layers className="size-4 shrink-0 text-[#7dd3fc]" aria-hidden="true" /> {s.service}
                      </p>
                      {s.reasoning ? <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.reasoning}</p> : null}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No services recommended.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Talking Points" description="Conversation openers for the next call">
              {dossier.talkingPoints.length > 0 ? (
                <ul className="space-y-1.5">
                  {dossier.talkingPoints.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-300">
                      <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#7dd3fc]" aria-hidden="true" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No talking points returned.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Risks"
              description="Deal and delivery risks observed in the record"
              className="border-amber-500/25 bg-amber-500/[0.03]"
            >
              {dossier.risks.length > 0 ? (
                <ul className="space-y-1.5">
                  {dossier.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-200/90">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-400/80" aria-hidden="true" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No specific risks returned.</p>
              )}
            </SectionCard>

            <SectionCard title="AI Confidence" description="What this dossier is grounded in">
              <p className="text-[13px] leading-relaxed text-slate-300">{dossier.confidenceNote}</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
                <Info className="size-4 text-[#7dd3fc]" aria-hidden="true" /> Advisory — verify before committing
              </p>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
