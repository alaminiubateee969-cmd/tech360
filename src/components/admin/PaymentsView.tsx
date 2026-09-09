'use client'

import { useMemo, useState } from 'react'
import { BadgeDollarSign, Loader2, RefreshCw, Wallet } from 'lucide-react'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED', 'CANCELLED'] as const

export function PaymentsView({ onOpenClient }: { onOpenClient?: (id: string) => void }) {
  const { data, loading, error, refresh } = useApi<PaymentsResponse>('/api/admin/payments')
  const payments = data?.payments ?? []
  const [filter, setFilter] = useState('ALL')
  const [verifying, setVerifying] = useState<string | null>(null)

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

      <SectionCard title="Invoices" description="Milestone invoices generated by the payment request automation" className="mt-4" contentClassName="p-0">
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices in this view"
            description="Invoices are created per milestone when payment instructions are requested (see the client journey). If your API returns them with payments, they will be listed here."
          />
        ) : (
          <DataTable
            columns={[
              { key: 'number', header: 'Invoice', cell: (i) => <span className="font-mono text-xs text-[#009FE3]">{i.number || '—'}</span> },
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
    </div>
  )
}
