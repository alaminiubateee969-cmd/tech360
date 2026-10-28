'use client'

import { useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react'

import {
  api,
  clientDisplayName,
  fmtDate,
  fmtMoney,
  num,
  prettify,
  useApi,
  type InvoiceRecord,
  type PaymentRecord,
  type PaymentsResponse,
  type RefundCaseRecord,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED', 'CANCELLED'] as const
const METHODS = ['BANK_TRANSFER', 'BKASH', 'NAGAD', 'CARD', 'WISE', 'PAYPAL', 'MANUAL'] as const
const CURRENCIES = ['USD', 'BDT', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED'] as const

// Only formally issued/sent/partial/overdue invoices can receive payment allocations (never DRAFT!).
const PAYABLE = ['ISSUED', 'SENT', 'VIEWED', 'PARTIAL', 'OVERDUE']

export function PaymentsView({ onOpenClient }: { onOpenClient?: (id: string) => void }) {
  const { data, loading, error, refresh } = useApi<PaymentsResponse>('/api/admin/payments')
  const refundsApi = useApi<{ cases: RefundCaseRecord[] }>('/api/admin/refunds')
  const payments = data?.payments ?? []
  const invoices = data?.invoices ?? []
  const refundCases = refundsApi.data?.cases ?? []
  const readiness = data?.paymentReadiness

  const [filter, setFilter] = useState('ALL')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [invBusy, setInvBusy] = useState<string | null>(null)
  const [refundBusy, setRefundBusy] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  const refreshAll = () => {
    refresh()
    refundsApi.refresh()
  }

  const filtered = useMemo(
    () => (filter === 'ALL' ? payments : payments.filter((p) => (p.status ?? '').toUpperCase() === filter)),
    [payments, filter],
  )

  const summary = useMemo(() => {
    let received = 0
    let pending = 0
    let failed = 0
    for (const p of payments) {
      const st = (p.status ?? '').toUpperCase()
      const amt = num(p.amount)
      if (st === 'PAID') received += amt
      else if (st === 'PENDING' || st === 'PARTIAL') pending += 1
      else if (st === 'FAILED' || st === 'REFUNDED') failed += 1
    }
    return { received, pending, failed }
  }, [payments])

  async function verify(paymentId: string) {
    setVerifying(paymentId)
    try {
      const res = await api.verifyPayment(paymentId)
      toast.success(res.message ?? 'Payment verified & official receipt issued.')
      refreshAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setVerifying(null)
    }
  }

  async function runInvoiceAction(number: string, action: string, extra?: Record<string, unknown>) {
    setInvBusy(`${number}:${action}`)
    try {
      await api.invoiceAction(number, { action, ...(extra ?? {}) })
      toast.success(`Invoice ${number}: ${action.replace(/_/g, ' ')} succeeded.`)
      refreshAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Invoice action (${action}) failed.`)
    } finally {
      setInvBusy(null)
    }
  }

  async function runRefundDecision(id: string, action: string, extra?: Record<string, unknown>) {
    setRefundBusy(`${id}:${action}`)
    try {
      const res = await api.decideRefundCase(id, { action, ...(extra ?? {}) })
      toast.success(
        res.handoverSuspended
          ? 'Refund settled — project balance updated and source-code handover suspended.'
          : `Case ${action.replace(/_/g, ' ')} completed.`,
      )
      refreshAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Refund action (${action}) failed.`)
    } finally {
      setRefundBusy(null)
    }
  }

  const columns = [
    {
      key: 'client',
      header: 'Client',
      cell: (p: PaymentRecord) => (
        <span className="font-medium text-slate-200">{p.client ? clientDisplayName(p.client) : p.clientId || '—'}</span>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      cell: (p: PaymentRecord) =>
        p.invoice?.number ? (
          <span className="font-mono text-xs text-[#009FE3]">{p.invoice.number}</span>
        ) : (
          <span className="text-xs text-slate-600">unallocated</span>
        ),
    },
    { key: 'milestone', header: 'Milestone', cell: (p: PaymentRecord) => <span className="text-slate-400">{p.milestone || '—'}</span> },
    {
      key: 'amount',
      header: 'Amount',
      cell: (p: PaymentRecord) => <span className="font-semibold tabular-nums text-slate-100">{fmtMoney(num(p.amount), p.currency ?? 'USD')}</span>,
    },
    { key: 'method', header: 'Method', cell: (p: PaymentRecord) => <span className="text-slate-400">{prettify(p.method)}</span> },
    { key: 'txn', header: 'Transaction ID', cell: (p: PaymentRecord) => <span className="font-mono text-xs text-slate-500">{p.transactionId || '—'}</span> },
    { key: 'status', header: 'Status', cell: (p: PaymentRecord) => <StatusBadge status={p.status} /> },
    {
      key: 'verified',
      header: 'Verified & Receipt',
      cell: (p: PaymentRecord) =>
        p.status === 'PAID' && p.verifiedAt ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">{fmtDate(p.verifiedAt)}</span>
            <a
              href={`/api/admin/payments/${encodeURIComponent(p.id)}/receipt?format=html`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-400 hover:underline"
            >
              <Receipt className="size-3" aria-hidden="true" />
              {p.receipt?.receiptNumber ?? 'Official Receipt'}
            </a>
          </div>
        ) : (
          <span className="text-xs text-slate-600">Unverified (no receipt)</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28 text-right',
      cell: (p: PaymentRecord) =>
        (p.status ?? '').toUpperCase() === 'PENDING' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={verifying === p.id}
            className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            onClick={(e) => {
              e.stopPropagation()
              void verify(p.id)
            }}
            aria-label={`Verify payment ${p.transactionId ?? p.id}`}
          >
            {verifying === p.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            Verify
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices, Payments & Refunds"
        description="Itemized invoice lifecycle, server-verified payment ledger, official receipts, and refund/dispute controls."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setInvoiceOpen(true)}
              className="gap-2 border-[#009FE3]/50 bg-[#009FE3]/10 font-semibold text-slate-100 hover:bg-[#009FE3]/20"
              aria-label="Create invoice"
            >
              <FileText className="size-4" aria-hidden="true" /> Create Invoice / ইনভয়েস তৈরি করুন
            </Button>
            <Button
              onClick={() => setRecordOpen(true)}
              className="gap-2 font-semibold"
              style={{ background: '#009FE3' }}
              aria-label="Record a payment"
            >
              <Plus className="size-4" aria-hidden="true" /> Record payment
            </Button>
            <Button
              variant="outline"
              onClick={() => setRefundOpen(true)}
              className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Refund / Dispute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh payments"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
          </div>
        }
      />

      {readiness ? (
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs ${
            readiness.configured
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          }`}
        >
          {readiness.configured ? (
            <ShieldCheck className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
          )}
          <div>
            <span className="font-semibold">
              Customer Payment Readiness: {readiness.configured ? 'Configured & Active' : 'Not Configured'}
            </span>{' '}
            — {readiness.message}
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load payments: {error}
        </div>
      ) : null}

      <section aria-label="Payment summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total Received" value={fmtMoney(summary.received)} icon={Wallet} tone="green" loading={loading} sub="Sum of verified PAID payments" />
        <KpiCard label="Pending Verification" value={summary.pending} icon={BadgeDollarSign} tone="amber" loading={loading} sub="Awaiting Super Admin verification" />
        <KpiCard label="Failed / Refunded" value={summary.failed} icon={BadgeDollarSign} tone="red" loading={loading} sub="Requires follow-up" />
      </section>

      {/* INVOICES LIFECYCLE TABLE */}
      <SectionCard
        title="Invoices Lifecycle"
        description="Drafts remain internal until issued/sent. Issued invoices are immutable — use Reissue to supersede an unpaid issued invoice."
        contentClassName="p-0"
      >
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Create an itemized invoice with server-side minor-unit arithmetic and scope linkage."
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'number',
                header: 'Invoice',
                cell: (i: InvoiceRecord) => (
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`/api/admin/invoices/${encodeURIComponent(i.number ?? '')}?format=html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#009FE3] hover:underline"
                      title="Open official printable invoice on company letterhead"
                    >
                      {i.number || '—'}
                      <FileText className="size-3" aria-hidden="true" />
                    </a>
                    {i.revision && i.revision > 1 ? (
                      <span className="text-[10px] text-slate-500">
                        Rev #{i.revision}{i.supersedesInvoiceNumber ? ` · supersedes ${i.supersedesInvoiceNumber}` : ''}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'client',
                header: 'Client / Scope',
                cell: (i: InvoiceRecord) => (
                  <div className="text-xs">
                    <p className="font-medium text-slate-200">{i.client ? clientDisplayName(i.client) : '—'}</p>
                    <p className="text-[11px] text-slate-500">
                      {i.project?.code ? `${i.project.code}` : 'No project'}
                      {i.scopeVersion ? ` · Scope v${i.scopeVersion}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Total',
                cell: (i: InvoiceRecord) => (
                  <span className="font-semibold tabular-nums text-slate-100">
                    {fmtMoney(num(i.amount), i.currency ?? 'USD')}
                  </span>
                ),
              },
              { key: 'status', header: 'Status', cell: (i: InvoiceRecord) => <StatusBadge status={i.status} /> },
              {
                key: 'issued',
                header: 'Issued / Due',
                cell: (i: InvoiceRecord) => (
                  <div className="text-xs text-slate-500">
                    <p>{fmtDate(i.issuedAt)}</p>
                    {i.dueAt ? <p className="text-[10px] text-slate-600">Due {fmtDate(i.dueAt)}</p> : null}
                  </div>
                ),
              },
              {
                key: 'lifecycle',
                header: 'Lifecycle Actions',
                className: 'text-right',
                cell: (i: InvoiceRecord) => {
                  const numStr = i.number ?? ''
                  const st = (i.status ?? '').toUpperCase()
                  if (!numStr) return null
                  return (
                    <div className="flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {st === 'DRAFT' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={invBusy !== null}
                            onClick={() => void runInvoiceAction(numStr, 'submit_for_approval')}
                            className="h-7 border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-300"
                          >
                            Submit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={invBusy !== null}
                            onClick={() => void runInvoiceAction(numStr, 'approve')}
                            className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-300"
                          >
                            Approve
                          </Button>
                        </>
                      ) : null}
                      {st === 'AWAITING_APPROVAL' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invBusy !== null}
                          onClick={() => void runInvoiceAction(numStr, 'approve')}
                          className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-300"
                        >
                          Approve
                        </Button>
                      ) : null}
                      {st === 'APPROVED' || st === 'DRAFT' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invBusy !== null}
                          onClick={() => void runInvoiceAction(numStr, 'issue')}
                          className="h-7 border-[#009FE3]/40 bg-[#009FE3]/10 px-2 text-[11px] text-[#009FE3]"
                        >
                          Issue to Portal
                        </Button>
                      ) : null}
                      {['APPROVED', 'ISSUED', 'SENT', 'VIEWED', 'OVERDUE'].includes(st) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invBusy !== null}
                          onClick={() => void runInvoiceAction(numStr, 'send')}
                          className="h-7 border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-200"
                        >
                          Send Email
                        </Button>
                      ) : null}
                      {['ISSUED', 'SENT', 'VIEWED', 'OVERDUE'].includes(st) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invBusy !== null}
                          onClick={() => void runInvoiceAction(numStr, 'reissue', { reason: 'Revised commercial terms' })}
                          className="h-7 border-amber-500/40 bg-amber-500/10 px-2 text-[11px] text-amber-300"
                        >
                          Reissue
                        </Button>
                      ) : null}
                      {['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'ISSUED', 'SENT', 'VIEWED', 'OVERDUE'].includes(st) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invBusy !== null}
                          onClick={() => void runInvoiceAction(numStr, 'void', { reason: 'Voided by finance administrator' })}
                          className="h-7 border-red-500/30 bg-red-500/10 px-2 text-[11px] text-red-400"
                        >
                          Void
                        </Button>
                      ) : null}
                    </div>
                  )
                },
              },
            ]}
            rows={invoices}
            rowKey={(i) => i.id}
            aria-label="Invoices table"
            maxHeightClass="max-h-96"
          />
        )}
      </SectionCard>

      {/* PAYMENTS TABLE */}
      <SectionCard
        title="Payments Ledger"
        description="Only verified PAID entries generate official receipts and unlock project / handover milestones."
        contentClassName="p-0"
      >
        <div className="border-b border-slate-800/80 p-3">
          <label htmlFor="pay-status" className="sr-only">Filter by status</label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger id="pay-status" className="h-8 w-[180px] border-slate-800 bg-slate-950/60 text-xs text-slate-200">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{prettify(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          rowKey={(p) => p.id}
          onRowClick={onOpenClient && ((p: PaymentRecord) => p.clientId ? onOpenClient(p.clientId) : undefined)}
          empty={
            <EmptyState
              icon={Wallet}
              title={filter !== 'ALL' ? 'No payments with this status' : 'No payments yet'}
              description={filter !== 'ALL' ? 'Try a different status filter.' : 'Recorded payments will appear here.'}
            />
          }
          aria-label="Payments table"
        />
      </SectionCard>

      {/* REFUNDS, CANCELLATIONS & DISPUTES */}
      <SectionCard
        title="Refunds, Cancellations & Disputes"
        description="Audited exception cases. Settling a refund updates net verified project balance and suspends source-code handover if full payment is no longer satisfied."
        contentClassName="p-0"
      >
        {refundCases.length === 0 ? (
          <EmptyState
            title="No refund or dispute cases"
            description="Open a Refund, Cancellation, or Dispute case above whenever an exception review is needed."
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'caseNumber',
                header: 'Case',
                cell: (c: RefundCaseRecord) => (
                  <span className="font-mono text-xs font-semibold text-amber-300">{c.caseNumber}</span>
                ),
              },
              {
                key: 'kind',
                header: 'Kind',
                cell: (c: RefundCaseRecord) => <span className="text-xs font-medium text-slate-300">{c.kind}</span>,
              },
              {
                key: 'client',
                header: 'Client / Refs',
                cell: (c: RefundCaseRecord) => (
                  <div className="text-xs">
                    <p className="text-slate-200">{c.client?.name ?? c.client?.clientId ?? '—'}</p>
                    <p className="text-[10px] text-slate-500">
                      {c.invoice?.number ? `Inv ${c.invoice.number}` : 'No inv'}
                      {c.project?.code ? ` · ${c.project.code}` : ''}
                    </p>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Requested / Approved',
                cell: (c: RefundCaseRecord) => (
                  <div className="text-xs tabular-nums">
                    <p className="text-slate-200">{fmtMoney(c.requestedAmount ?? c.requestedAmountMinor / 100, c.currency)}</p>
                    {c.approvedAmountMinor > 0 ? (
                      <p className="text-[10px] text-emerald-400">
                        Approved: {fmtMoney(c.approvedAmount ?? c.approvedAmountMinor / 100, c.currency)}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              { key: 'status', header: 'Status', cell: (c: RefundCaseRecord) => <StatusBadge status={c.status} /> },
              {
                key: 'actions',
                header: 'Super Admin Decision',
                className: 'text-right',
                cell: (c: RefundCaseRecord) => {
                  const terminal = ['REFUNDED', 'PARTIALLY_REFUNDED', 'REJECTED', 'CLOSED', 'DISPUTE_RESOLVED'].includes(c.status)
                  if (terminal) return <span className="text-[11px] text-slate-500">Finalized</span>
                  return (
                    <div className="flex flex-wrap justify-end gap-1">
                      {c.kind === 'REFUND' && c.status === 'REQUESTED' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={refundBusy !== null}
                          onClick={() => void runRefundDecision(c.id, 'approve')}
                          className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-300"
                        >
                          Approve
                        </Button>
                      ) : null}
                      {c.kind === 'REFUND' && ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REFUND_PENDING'].includes(c.status) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={refundBusy !== null}
                          onClick={() => void runRefundDecision(c.id, 'settle', { resolutionNotes: 'Settled by Super Admin' })}
                          className="h-7 border-[#009FE3]/40 bg-[#009FE3]/10 px-2 text-[11px] text-[#009FE3]"
                        >
                          Settle Refund
                        </Button>
                      ) : null}
                      {c.kind !== 'REFUND' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={refundBusy !== null}
                          onClick={() => void runRefundDecision(c.id, 'resolve_dispute', { resolutionNotes: 'Resolved after review' })}
                          className="h-7 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-300"
                        >
                          Resolve / Close
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={refundBusy !== null}
                        onClick={() => void runRefundDecision(c.id, 'reject', { resolutionNotes: 'Outside refund policy terms' })}
                        className="h-7 border-red-500/30 bg-red-500/10 px-2 text-[11px] text-red-400"
                      >
                        Reject
                      </Button>
                    </div>
                  )
                },
              },
            ]}
            rows={refundCases}
            rowKey={(c) => c.id}
            aria-label="Refund cases table"
            maxHeightClass="max-h-80"
          />
        )}
      </SectionCard>

      <CreateInvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} onCreated={refreshAll} />
      <RecordPaymentDialog open={recordOpen} onOpenChange={setRecordOpen} invoices={invoices} onRecorded={refreshAll} />
      <OpenRefundCaseDialog open={refundOpen} onOpenChange={setRefundOpen} payments={payments} invoices={invoices} onCreated={refreshAll} />
    </div>
  )
}

// ---------------- Full End-to-End Create Invoice Dialog ----------------

interface LineItemDraft {
  description: string
  quantity: string
  unitPrice: string
}

function CreateInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const clientsApi = useApi<{
    clients: {
      id: string
      clientId: string
      name: string
      businessName?: string | null
      email?: string | null
      country?: string | null
    }[]
  }>(open ? '/api/admin/clients?perPage=100' : null)

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [scopeVersion, setScopeVersion] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [dueAt, setDueAt] = useState('')
  const [description, setDescription] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ])
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [taxRatePercent, setTaxRatePercent] = useState('')
  const [taxLabel, setTaxLabel] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingCountry, setBillingCountry] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(
    'HTML Preview where included in the agreed process. Final source-code handover after required outstanding project payments have cleared, unless otherwise agreed in writing.',
  )
  const [customerNotes, setCustomerNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [initialStatus, setInitialStatus] = useState<'DRAFT' | 'AWAITING_APPROVAL'>('DRAFT')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clients = clientsApi.data?.clients ?? []
  const selectedClient = clients.find((c) => c.clientId === clientId) ?? null

  // Client-side preview math (the server independently re-validates & computes authoritative minor units)
  const previewTotals = useMemo(() => {
    let subtotalMinor = 0
    for (const item of lineItems) {
      const q = Number(item.quantity)
      const u = Number(item.unitPrice)
      if (Number.isFinite(q) && q > 0 && Number.isFinite(u) && u >= 0) {
        subtotalMinor += Math.round(q * Math.round((u + Number.EPSILON) * 100))
      }
    }
    const discMinor =
      discountAmount && Number.isFinite(Number(discountAmount)) && Number(discountAmount) > 0
        ? Math.round((Number(discountAmount) + Number.EPSILON) * 100)
        : 0
    const taxableMinor = Math.max(0, subtotalMinor - discMinor)
    const bps =
      taxRatePercent && Number.isFinite(Number(taxRatePercent)) && Number(taxRatePercent) > 0
        ? Math.round((Number(taxRatePercent) + Number.EPSILON) * 100)
        : 0
    const taxMinor = bps > 0 ? Math.round((taxableMinor * bps) / 10_000) : 0
    const totalMinor = taxableMinor + taxMinor
    return {
      subtotal: subtotalMinor / 100,
      discount: discMinor / 100,
      tax: taxMinor / 100,
      total: totalMinor / 100,
    }
  }, [lineItems, discountAmount, taxRatePercent])

  function reset() {
    setClientId('')
    setProjectId('')
    setScopeVersion('')
    setCurrency('USD')
    setDueAt('')
    setDescription('')
    setLineItems([{ description: '', quantity: '1', unitPrice: '' }])
    setDiscountAmount('')
    setDiscountReason('')
    setTaxRatePercent('')
    setTaxLabel('')
    setBillingAddress('')
    setBillingCountry('')
    setCustomerNotes('')
    setInternalNotes('')
    setInitialStatus('DRAFT')
    setFormError(null)
  }

  function updateItem(idx: number, patch: Partial<LineItemDraft>) {
    setLineItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setLineItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '' }])
  }

  function removeItem(idx: number) {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (!clientId) return setFormError('Select a client.')

    const parsedItems = lineItems.map((it) => ({
      description: it.description.trim(),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    }))
    if (parsedItems.some((it) => !it.description || !Number.isFinite(it.quantity) || it.quantity <= 0 || !Number.isFinite(it.unitPrice) || it.unitPrice < 0)) {
      return setFormError('Every line item requires a description, positive quantity, and non-negative unit price.')
    }

    setSaving(true)
    try {
      const disc = discountAmount ? Number(discountAmount) : undefined
      const taxPct = taxRatePercent ? Number(taxRatePercent) : undefined
      const result = await api.createInvoiceDraft({
        clientId,
        projectId: projectId.trim() || undefined,
        scopeVersion: scopeVersion.trim() ? Number(scopeVersion.trim()) : undefined,
        description: description.trim() || undefined,
        currency,
        dueAt: dueAt || undefined,
        lineItems: parsedItems,
        discountAmount: disc,
        discountReason: discountReason.trim() || undefined,
        taxRatePercent: taxPct,
        taxLabel: taxLabel.trim() || undefined,
        billingName: selectedClient?.name,
        billingBusiness: selectedClient?.businessName ?? undefined,
        billingEmail: selectedClient?.email ?? undefined,
        billingAddress: billingAddress.trim() || undefined,
        billingCountry: billingCountry.trim() || selectedClient?.country || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        initialStatus,
      })
      toast.success(`Invoice ${result.invoice?.number ?? ''} created (${initialStatus}).`)
      onCreated()
      reset()
      onOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create invoice.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-slate-800 bg-slate-950 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Create Invoice / ইনভয়েস তৈরি করুন</DialogTitle>
          <DialogDescription className="text-slate-400">
            Itemized commercial invoice with server-side minor-unit calculation, scope linkage, and separated internal vs customer notes. Saved as {initialStatus} until approved and issued.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 py-2 text-xs">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="invoice-client" className="text-slate-300">Client *</Label>
              <Select required value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="invoice-client" className="border-slate-800 bg-slate-900/60 text-slate-200">
                  <SelectValue placeholder={clientsApi.loading ? 'Loading clients…' : 'Select client'} />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.clientId}>
                      {client.businessName || client.name} · {client.clientId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-currency" className="text-slate-300">Currency *</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="invoice-currency" className="border-slate-800 bg-slate-900/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-project" className="text-slate-300">Project code (optional)</Label>
              <Input id="invoice-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="PRJ-2026-0001" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-scope" className="text-slate-300">Approved Scope Version</Label>
              <Input id="invoice-scope" type="number" min="1" value={scopeVersion} onChange={(e) => setScopeVersion(e.target.value)} placeholder="Auto (latest approved)" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoice-due" className="text-slate-300">Due date</Label>
              <Input id="invoice-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invoice-description" className="text-slate-300">Engagement / Services Summary</Label>
            <Input id="invoice-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Custom Web Platform — Milestone 1 (50% post-preview approval)" className="border-slate-800 bg-slate-900/60 text-slate-200" />
          </div>

          {/* LINE ITEMS */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-slate-300">Line Items ({currency})</span>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 gap-1 border-slate-700 bg-slate-900 text-xs text-slate-200">
                <Plus className="size-3" aria-hidden="true" /> Add item
              </Button>
            </div>
            {lineItems.map((it, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <Input
                    required
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder={`Item #${idx + 1} description`}
                    className="h-8 border-slate-800 bg-slate-950/70 text-xs text-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    placeholder="Qty"
                    className="h-8 border-slate-800 bg-slate-950/70 text-xs text-slate-200"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                    placeholder="Unit price"
                    className="h-8 border-slate-800 bg-slate-950/70 text-xs text-slate-200"
                  />
                </div>
                <div className="flex items-center justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={lineItems.length <= 1}
                    onClick={() => removeItem(idx)}
                    className="h-8 w-8 p-0 text-slate-500 hover:text-red-400"
                    aria-label={`Remove line item ${idx + 1}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* DISCOUNT & TAX */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Discount ({currency})</Label>
              <Input type="number" min="0" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Discount Reason</Label>
              <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Required if discounted" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Tax Rate (%)</Label>
              <Input type="number" min="0" max="50" step="0.01" value={taxRatePercent} onChange={(e) => setTaxRatePercent(e.target.value)} placeholder="0" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Tax Label</Label>
              <Input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} placeholder="e.g. Sales Tax / VAT" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
          </div>

          {/* BILLING & NOTES */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Billing Address</Label>
              <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Street, City, Postal Code" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Billing Country</Label>
              <Input value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} placeholder={selectedClient?.country || 'Country'} className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-300">Payment Terms</Label>
            <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="border-slate-800 bg-slate-900/60 text-slate-200" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Customer-Facing Notes (printed on invoice)</Label>
              <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} placeholder="Visible to the client" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-amber-300">Internal Notes (staff only — NEVER shown to client)</Label>
              <Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} placeholder="Internal finance context" className="border-amber-500/30 bg-slate-900/60 text-slate-200" />
            </div>
          </div>

          {/* SERVER-ENFORCED TOTALS SUMMARY */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs">
            <div className="space-y-0.5 text-slate-400">
              <p>Subtotal: <strong className="text-slate-200">{fmtMoney(previewTotals.subtotal, currency)}</strong></p>
              {previewTotals.discount > 0 ? <p>Discount: <strong className="text-amber-300">-{fmtMoney(previewTotals.discount, currency)}</strong></p> : null}
              {previewTotals.tax > 0 ? <p>Tax: <strong className="text-slate-200">{fmtMoney(previewTotals.tax, currency)}</strong></p> : null}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Server-Validated Total</p>
              <p className="text-lg font-bold tabular-nums text-[#009FE3]">{fmtMoney(previewTotals.total, currency)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-slate-300">Initial Workflow State</Label>
            <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as 'DRAFT' | 'AWAITING_APPROVAL')}>
              <SelectTrigger className="h-8 w-56 border-slate-800 bg-slate-900/60 text-xs text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                <SelectItem value="DRAFT">Save as DRAFT</SelectItem>
                <SelectItem value="AWAITING_APPROVAL">Submit AWAITING_APPROVAL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formError ? <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{formError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="text-slate-400 hover:bg-slate-800/60 hover:text-slate-100">Cancel</Button>
            <Button type="submit" disabled={saving || clientsApi.loading} className="gap-2 font-semibold" style={{ background: '#009FE3' }}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Create Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Record payment dialog (per-invoice allocation) ----------------

function invoiceClientRef(i: InvoiceRecord): string {
  if (typeof i.client === 'string') return i.client
  return i.client?.clientId ?? ''
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  invoices,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  invoices: InvoiceRecord[]
  onRecorded: () => void
}) {
  const clientsApi = useApi<{ clients: { id: string; clientId: string; name: string; businessName?: string | null }[] }>(
    open ? '/api/admin/clients' : null,
  )
  const [clientRef, setClientRef] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('MANUAL')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clients = clientsApi.data?.clients ?? []
  const clientInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          clientRef &&
          invoiceClientRef(i) === clientRef &&
          PAYABLE.includes((i.status ?? '').toUpperCase()),
      ),
    [invoices, clientRef],
  )
  const selectedInvoice = clientInvoices.find((i) => i.number === invoiceNumber) ?? null

  function reset() {
    setClientRef('')
    setAmount('')
    setMethod('MANUAL')
    setInvoiceNumber('')
    setTransactionId('')
    setNotes('')
    setFormError(null)
  }

  async function submit() {
    setFormError(null)
    const amt = Number(amount)
    if (!clientRef) return setFormError('Select the client this payment belongs to.')
    if (!Number.isFinite(amt) || amt <= 0) return setFormError('Enter a valid amount greater than zero.')
    const maxPayable = selectedInvoice ? num(selectedInvoice.remainingAmount ?? selectedInvoice.amount) : null
    if (selectedInvoice && maxPayable !== null && amt > maxPayable) {
      return setFormError(`Amount exceeds remaining balance on invoice ${selectedInvoice.number} (${fmtMoney(maxPayable, selectedInvoice.currency ?? 'USD')}).`)
    }
    setSaving(true)
    try {
      const res = await api.recordPayment({
        clientId: clientRef,
        amount: amt,
        currency: selectedInvoice?.currency ?? 'USD',
        method,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceNumber: invoiceNumber && invoiceNumber !== 'NONE' ? invoiceNumber : undefined,
      })
      toast.success(res.message ?? 'Payment recorded as PENDING.')
      onRecorded()
      reset()
      onOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record the payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Record payment</DialogTitle>
          <DialogDescription className="text-slate-400">
            Records a PENDING payment — Super Admin verification settles it and issues an official receipt. Only issued/sent invoices can receive allocations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="pay-client" className="text-slate-300">Client</Label>
            <Select
              value={clientRef}
              onValueChange={(v) => { setClientRef(v); setInvoiceNumber('') }}
            >
              <SelectTrigger id="pay-client" className="border-slate-800 bg-slate-900/60 text-slate-200">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                {clients.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">{clientsApi.loading ? 'Loading clients…' : 'No clients found.'}</div>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.clientId}>
                      {c.businessName || c.name} · {c.clientId}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pay-amount" className="text-slate-300">Amount ({selectedInvoice?.currency ?? 'USD'})</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 250"
                className="border-slate-800 bg-slate-900/60 text-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-method" className="text-slate-300">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="pay-method" className="border-slate-800 bg-slate-900/60 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{prettify(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-invoice" className="text-slate-300">Allocate to issued invoice (optional)</Label>
            <Select value={invoiceNumber} onValueChange={setInvoiceNumber}>
              <SelectTrigger id="pay-invoice" className="border-slate-800 bg-slate-900/60 text-slate-200">
                <SelectValue placeholder={clientRef ? 'Unallocated (client-level payment)' : 'Select a client first'} />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                <SelectItem value="NONE">Unallocated (client-level payment)</SelectItem>
                {clientInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.number ?? i.id}>
                    {i.number} · {fmtMoney(num(i.amount), i.currency ?? 'USD')} · {prettify(i.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientRef && clientInvoices.length === 0 ? (
              <p className="text-[11px] text-slate-600">No issued/payable invoices for this client (drafts must be issued first).</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-txn" className="text-slate-300">Transaction ID (optional)</Label>
            <Input
              id="pay-txn"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Bank / bKash / Stripe reference"
              className="border-slate-800 bg-slate-900/60 font-mono text-xs text-slate-200"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-notes" className="text-slate-300">Notes (optional)</Label>
            <Textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the team should know about this payment"
              rows={2}
              className="border-slate-800 bg-slate-900/60 text-slate-200"
            />
          </div>

          {formError ? (
            <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="text-slate-400 hover:bg-slate-800/60 hover:text-slate-100">
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-2 font-semibold" style={{ background: '#009FE3' }}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Open Refund / Cancellation / Dispute Case Dialog ----------------

function OpenRefundCaseDialog({
  open,
  onOpenChange,
  payments,
  invoices,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  payments: PaymentRecord[]
  invoices: InvoiceRecord[]
  onCreated: () => void
}) {
  const clientsApi = useApi<{ clients: { id: string; clientId: string; name: string; businessName?: string | null }[] }>(
    open ? '/api/admin/clients?perPage=100' : null,
  )
  const [clientRef, setClientRef] = useState('')
  const [kind, setKind] = useState<'REFUND' | 'CANCELLATION' | 'DISPUTE'>('REFUND')
  const [paymentId, setPaymentId] = useState('NONE')
  const [invoiceNumber, setInvoiceNumber] = useState('NONE')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [reason, setReason] = useState('')
  const [policyBasis, setPolicyBasis] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const clients = clientsApi.data?.clients ?? []
  const clientPaidPayments = useMemo(
    () =>
      payments.filter((p) => {
        const ref = typeof p.client === 'string' ? p.client : p.client?.clientId ?? ''
        return clientRef && ref === clientRef && (p.status ?? '').toUpperCase() === 'PAID'
      }),
    [payments, clientRef],
  )
  const clientInvoices = useMemo(
    () => invoices.filter((i) => clientRef && invoiceClientRef(i) === clientRef),
    [invoices, clientRef],
  )

  function reset() {
    setClientRef('')
    setKind('REFUND')
    setPaymentId('NONE')
    setInvoiceNumber('NONE')
    setRequestedAmount('')
    setCurrency('USD')
    setReason('')
    setPolicyBasis('')
    setFormError(null)
  }

  async function submit() {
    setFormError(null)
    if (!clientRef) return setFormError('Select a client.')
    if (reason.trim().length < 5) return setFormError('Provide a clear reason (at least 5 characters).')
    const amt = requestedAmount ? Number(requestedAmount) : 0
    if (kind === 'REFUND' && (!Number.isFinite(amt) || amt <= 0)) {
      return setFormError('Enter a positive refund amount.')
    }
    setSaving(true)
    try {
      await api.createRefundCase({
        clientId: clientRef,
        kind,
        paymentId: paymentId !== 'NONE' ? paymentId : undefined,
        invoiceId: invoiceNumber !== 'NONE' ? invoiceNumber : undefined,
        requestedAmount: amt,
        currency,
        reason: reason.trim(),
        policyBasis: policyBasis.trim() || undefined,
      })
      toast.success(`${kind} case opened and queued for Super Admin review.`)
      onCreated()
      reset()
      onOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not open case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Open Refund, Cancellation or Dispute Case</DialogTitle>
          <DialogDescription className="text-slate-400">
            Creates an auditable RFD-YYYY-NNNN case and Super Admin approval gate. Settled refunds automatically adjust project paid balance and revoke source-code handover if full payment is invalidated.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Client *</Label>
              <Select value={clientRef} onValueChange={(v) => { setClientRef(v); setPaymentId('NONE'); setInvoiceNumber('NONE') }}>
                <SelectTrigger className="border-slate-800 bg-slate-900/60 text-slate-200">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.clientId}>
                      {c.businessName || c.name} · {c.clientId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Case Kind *</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as 'REFUND' | 'CANCELLATION' | 'DISPUTE')}>
                <SelectTrigger className="border-slate-800 bg-slate-900/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectItem value="REFUND">REFUND</SelectItem>
                  <SelectItem value="CANCELLATION">CANCELLATION</SelectItem>
                  <SelectItem value="DISPUTE">DISPUTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Linked Verified Payment</Label>
              <Select value={paymentId} onValueChange={setPaymentId}>
                <SelectTrigger className="border-slate-800 bg-slate-900/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectItem value="NONE">None</SelectItem>
                  {clientPaidPayments.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {fmtMoney(num(p.amount), p.currency ?? 'USD')} · {p.transactionId || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Linked Invoice</Label>
              <Select value={invoiceNumber} onValueChange={setInvoiceNumber}>
                <SelectTrigger className="border-slate-800 bg-slate-900/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectItem value="NONE">None</SelectItem>
                  {clientInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.number ?? i.id}>
                      {i.number} · {fmtMoney(num(i.amount), i.currency ?? 'USD')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Requested Amount</Label>
              <Input type="number" min="0" step="0.01" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} placeholder="0.00" className="border-slate-800 bg-slate-900/60 text-slate-200" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-300">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="border-slate-800 bg-slate-900/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  {CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-300">Reason &amp; Facts *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Describe the client request, cancellation stage, or provider dispute" className="border-slate-800 bg-slate-900/60 text-slate-200" />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-slate-300">Policy Basis (optional)</Label>
            <Input value={policyBasis} onChange={(e) => setPolicyBasis(e.target.value)} placeholder="e.g. Refund Policy §3 — pre-delivery milestone cancellation" className="border-slate-800 bg-slate-900/60 text-slate-200" />
          </div>

          {formError ? <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="text-slate-400">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-2 font-semibold" style={{ background: '#009FE3' }}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Open Case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
