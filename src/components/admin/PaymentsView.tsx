'use client'

import { useMemo, useState } from 'react'
import { BadgeDollarSign, FileText, Loader2, Plus, RefreshCw, Wallet } from 'lucide-react'

import {
  api,
  clientDisplayName,
  fmtDate,
  fmtMoney,
  num,
  prettify,
  useApi,
  type PaymentRecord,
  type PaymentsResponse,
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

const PAYABLE = ['DRAFT', 'SENT', 'PARTIAL', 'OVERDUE']

export function PaymentsView({ onOpenClient }: { onOpenClient?: (id: string) => void }) {
  const { data, loading, error, refresh } = useApi<PaymentsResponse>('/api/admin/payments')
  const payments = data?.payments ?? []
  const [filter, setFilter] = useState('ALL')
  const [verifying, setVerifying] = useState<string | null>(null)
  const [recordOpen, setRecordOpen] = useState(false)

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
      toast.success(res.message ?? 'Payment verified.')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setVerifying(null)
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
      header: 'Verified',
      cell: (p: PaymentRecord) =>
        p.verifiedAt ? (
          <span className="text-xs text-slate-500">{fmtDate(p.verifiedAt)}{p.verifiedBy ? ` · ${p.verifiedBy}` : ''}</span>
        ) : (
          <span className="text-xs text-slate-600">Not verified</span>
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

  const invoices = data?.invoices ?? []

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All recorded payments across clients. Verify pending payments to activate projects and settle milestones."
        actions={
          <div className="flex items-center gap-2">
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
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh payments"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load payments: {error}
        </div>
      ) : null}

      <section aria-label="Payment summary" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total Received" value={fmtMoney(summary.received)} icon={Wallet} tone="green" loading={loading} sub="Sum of verified PAID payments" />
        <KpiCard label="Pending Verification" value={summary.pending} icon={BadgeDollarSign} tone="amber" loading={loading} sub="Awaiting admin verification" />
        <KpiCard label="Failed / Refunded" value={summary.failed} icon={BadgeDollarSign} tone="red" loading={loading} sub="Requires follow-up" />
      </section>

      <div className="mb-3 flex justify-start">
        <label htmlFor="pay-status" className="sr-only">Filter by status</label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger id="pay-status" className="h-9 w-[180px] border-slate-800 bg-slate-950/60 text-slate-200">
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

      <SectionCard title="Invoices" description="Milestone invoices generated by the payment request automation — per-invoice payment allocation is applied on verify" className="mt-4" contentClassName="p-0">
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices in this view"
            description="Invoices are created per milestone when payment instructions are requested (see the client journey). If your API returns them with payments, they will be listed here."
          />
        ) : (
          <DataTable
            columns={[
              { key: 'number', header: 'Invoice', cell: (i) => (
                <a
                  href={`/api/admin/invoices/${encodeURIComponent(i.number ?? '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-[#009FE3] underline decoration-transparent underline-offset-2 transition-colors hover:decoration-[#009FE3]"
                  aria-label={`Open official invoice ${i.number} on company letterhead`}
                  title="Open official invoice (company pad) in a new tab"
                >
                  {i.number || '—'}
                  <FileText className="size-3" aria-hidden="true" />
                </a>
              ) },
              { key: 'amount', header: 'Amount', cell: (i) => <span className="tabular-nums text-slate-100">{fmtMoney(num(i.amount), i.currency ?? 'USD')}</span> },
              { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.status} /> },
              { key: 'notes', header: 'Notes', cell: (i) => <span className="text-slate-400">{i.notes || '—'}</span> },
              { key: 'issued', header: 'Issued', cell: (i) => <span className="text-xs text-slate-500">{fmtDate(i.issuedAt)}</span> },
            ]}
            rows={invoices}
            rowKey={(i) => i.id}
            aria-label="Invoices table"
            maxHeightClass="max-h-80"
          />
        )}
      </SectionCard>

      <RecordPaymentDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        invoices={invoices}
        onRecorded={refresh}
      />
    </div>
  )
}

// ---------------- Record payment dialog (per-invoice allocation) ----------------

interface InvoiceLike {
  id: string
  number?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  client?: { clientId?: string; name?: string } | string | null
}

function invoiceClientRef(i: InvoiceLike): string {
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
  invoices: InvoiceLike[]
  onRecorded: () => void
}) {
  const clientsApi = useApi<{ clients: { id: string; clientId: string; name: string; businessName?: string | null }[] }>(
    open ? '/api/admin/clients' : null,
  )
  const [clientRef, setClientRef] = useState('')
  const [amount, setAmount] = useState('')
  // MANUAL is the platform-verified method that needs no gateway credentials —
  // the honest default for the sandbox and for manual bank reconciliations.
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
    if (selectedInvoice && amt > num(selectedInvoice.amount)) {
      return setFormError(`Amount exceeds invoice ${selectedInvoice.number} (${fmtMoney(num(selectedInvoice.amount), selectedInvoice.currency ?? 'USD')}).`)
    }
    setSaving(true)
    try {
      const res = await api.recordPayment({
        clientId: clientRef,
        amount: amt,
        method,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceNumber: invoiceNumber || undefined,
      })
      toast.success(res.message ?? 'Payment recorded.')
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
            Records a PENDING payment — verify it afterwards to settle. Optionally allocate it to a specific invoice;
            the invoice then moves PARTIAL → PAID from its own verified payments.
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
              <Label htmlFor="pay-amount" className="text-slate-300">Amount (USD)</Label>
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
            <Label htmlFor="pay-invoice" className="text-slate-300">Allocate to invoice (optional)</Label>
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
              <p className="text-[11px] text-slate-600">No payable invoices for this client (all PAID or CANCELLED).</p>
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
