'use client'

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
  type ApprovalItem,
  type ApprovalsResponse,
  type ClientDetailResponse,
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
      <Tabs defaultValue="timeline">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-900/80 p-1">
          {[
            ['timeline', 'Timeline'],
            ['comms', `Communications (${(data?.communications ?? []).length})`],
            ['scope', `Scope (${(data?.scopes ?? []).length})`],
            ['payments', `Payments (${(data?.payments ?? []).length})`],
            ['projects', `Projects (${projects.length})`],
            ['approvals', `Approvals (${clientApprovals.length})`],
            ['memory', `Memory (${(data?.memories ?? []).length})`],
            ['automation', `Automation (${(data?.automationLogs ?? []).length})`],
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
