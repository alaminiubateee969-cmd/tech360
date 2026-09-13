'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Clock,
  Eye,
  Globe2,
  Handshake,
  Loader2,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, useApi, fmtDateShort, type ReviewRow, type ReferralRow, type ReviewsResponse } from '@/lib/admin-client'
import { SectionCard, EmptyState, KpiCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { SCROLL_THIN } from './shared/styles'

const STATUS_FILTERS = ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PENDING'] as const

function Stars({ rating, className = '' }: { rating?: number | null; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating ?? 0))))
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={rating ? `${rating} out of 5 stars` : 'No rating'}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < n ? 'fill-amber-400 text-amber-400' : 'fill-slate-800 text-slate-700'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export function ReviewsView() {
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refBusyId, setRefBusyId] = useState<string | null>(null)

  const url = useMemo(
    () => `/api/admin/reviews${statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''}`,
    [statusFilter],
  )
  const { data, loading, error, refresh } = useApi<ReviewsResponse>(url)

  const reviews = data?.reviews ?? []
  const referrals = data?.referrals ?? []
  const stats = data?.stats ?? {}
  const pending = (stats.SUBMITTED ?? 0)

  async function moderate(review: ReviewRow, action: 'PUBLISH' | 'REJECT') {
    setBusyId(review.id)
    try {
      await api.moderateReview(review.id, action)
      toast.success(action === 'PUBLISH' ? `Review by ${review.clientName} published to the website.` : 'Review rejected (stays private).')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Moderation failed')
    } finally {
      setBusyId(null)
    }
  }

  async function setReferralStatus(referral: ReferralRow, status: string) {
    setRefBusyId(referral.id)
    try {
      await api.referralStatus(referral.id, status)
      toast.success(`Referral marked ${status.toLowerCase()}.`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Referral update failed')
    } finally {
      setRefBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Awaiting Moderation" value={stats.SUBMITTED ?? 0} icon={Clock} tone="amber" loading={loading} />
        <KpiCard label="Published" value={stats.APPROVED ?? 0} icon={Globe2} tone="green" loading={loading} />
        <KpiCard label="Rejected" value={stats.REJECTED ?? 0} icon={ThumbsDown} tone="red" loading={loading} />
        <KpiCard label="Referrals" value={referrals.length} icon={Users} tone="accent" loading={loading} />
      </div>

      <SectionCard
        title="Client Reviews"
        description="Clients submit reviews from their portal. Publishing requires explicit client consent — nothing goes public without it."
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]" aria-label="Filter reviews by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="border-slate-700">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </Button>
          </>
        }
      >
        {error ? (
          <EmptyState icon={X} title="Could not load reviews" description={error} />
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title={statusFilter === 'SUBMITTED' ? 'No reviews awaiting moderation' : 'No reviews in this status'}
            description={
              statusFilter === 'SUBMITTED'
                ? 'Reviews appear here after a client submits one from their portal. Request reviews via the client’s Journey → Request Review action.'
                : 'Switch the filter to see other review states.'
            }
          />
        ) : (
          <div className={`space-y-3 ${SCROLL_THIN} max-h-[60vh] overflow-y-auto pr-1`}>
            {reviews.map((r) => (
              <article
                key={r.id}
                className={`rounded-lg border p-4 transition-colors ${
                  r.status === 'SUBMITTED'
                    ? 'border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50'
                    : r.status === 'APPROVED'
                      ? 'border-emerald-500/25 bg-emerald-500/[0.03] hover:border-emerald-500/40'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-sm font-medium text-slate-200">{r.clientName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{r.clientId}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {r.businessName ?? '—'}{r.projectCode ? ` · ${r.projectCode}` : ''} · submitted {fmtDateShort(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.consent ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        <ThumbsUp className="size-3" aria-hidden="true" /> Consent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        No consent
                      </span>
                    )}
                  </div>
                </div>

                {r.content ? (
                  <blockquote className="mt-3 border-l-2 border-slate-700 pl-3 text-sm leading-relaxed text-slate-300">
                    “{r.content}”
                  </blockquote>
                ) : (
                  <p className="mt-3 text-xs italic text-slate-600">Review slot created — the client has not submitted content yet.</p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">
                    {r.moderatedBy ? `Moderated by ${r.moderatedBy} · ${fmtDateShort(r.moderatedAt)}` : 'Not moderated yet'}
                    {r.published ? ' · live on website' : ''}
                  </p>
                  {r.status === 'SUBMITTED' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => moderate(r, 'REJECT')}
                        className="border-slate-700 text-slate-400 hover:border-red-500/40 hover:text-red-400"
                      >
                        {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ThumbsDown className="size-3.5" aria-hidden="true" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === r.id || !r.consent}
                        title={r.consent ? 'Publish to the public website' : 'Client has not consented to public display — cannot publish'}
                        onClick={() => moderate(r, 'PUBLISH')}
                        className="bg-[#18B83A] text-white hover:bg-[#18B83A]/85 disabled:opacity-40"
                      >
                        {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                        Approve & Publish
                      </Button>
                    </div>
                  ) : r.status === 'APPROVED' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <Eye className="size-3" aria-hidden="true" /> Visible at #/work → Client Reviews
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {pending > 0 ? (
          <p className="mt-3 text-[11px] text-amber-400/80">
            {pending} review{pending === 1 ? '' : 's'} awaiting moderation — publish only what the client consented to.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Referrals"
        description="Real referrals submitted by clients via the portal. Track them from RECEIVED to CONVERTED."
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-slate-800 bg-slate-900/60" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No referrals yet"
            description="Referrals appear here after a client submits one from their portal (Journey → Request Review creates the invitation record)."
          />
        ) : (
          <div className={`space-y-2 ${SCROLL_THIN} max-h-[40vh] overflow-y-auto pr-1`}>
            {referrals.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 transition-colors hover:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {f.name ?? 'Unnamed referral'} <span className="font-normal text-slate-500">· referred by {f.clientName}</span>
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {f.contact ?? '—'} · from {f.clientId} · {fmtDateShort(f.createdAt)}{f.notes ? ` · ${f.notes.slice(0, 80)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={f.status} />
                  {f.status === 'RECEIVED' || f.status === 'REQUESTED' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refBusyId === f.id}
                      onClick={() => setReferralStatus(f, 'CONVERTED')}
                      className="border-slate-700 text-emerald-400 hover:border-emerald-500/40"
                    >
                      {refBusyId === f.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Handshake className="size-3.5" aria-hidden="true" />}
                      Converted
                    </Button>
                  ) : null}
                  {f.status === 'CONVERTED' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={refBusyId === f.id}
                      onClick={() => setReferralStatus(f, 'CLOSED')}
                      className="border-slate-700 text-slate-400 hover:border-slate-600"
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
