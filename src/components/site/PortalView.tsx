'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  LogOut, RefreshCw, ShieldCheck, FileText, CreditCard, MessageSquare,
  Download, KeyRound, Eye, Package, ArrowRight, CheckCircle2, Clock, Lock,
  Star, Handshake, LinkIcon, Undo2, Paperclip, Trash2, FileUp, FileCheck2,
  ShieldAlert, File as FileIcon, Upload, CalendarDays, Video, CalendarX, Send,
} from 'lucide-react'

type PortalData = {
  client: { clientId: string; name: string; businessName: string | null; businessType: string | null; stage: string; stageLabel: string; progressPct: number }
  project: { code: string; name: string; status: string; totalAmount: number; paidAmount: number; currency: string; paymentStatus: string; startedAt: string | null; timelineWeeks: number | null; tasks: Array<{ title: string; status: string }>; taskProgress: number | null } | null
  scope: { version: number; approvedAt: string | null; text: string } | null
  preview: { link: string; status: string; version: number } | null
  previewExpired: boolean
  review: { status: string; rating: number | null; content: string | null; consent: boolean; createdAt: string } | null
  referral: { status: string; name: string | null; contact: string | null; createdAt: string } | null
  handover: { status: string; downloadLink: string | null; confirmLink: string | null; passwordChangeRequested: boolean; passwordChangeConfirmed: boolean } | null
  delivery: { status: string; confirmedAt: string | null } | null
  payments: Array<{ milestone: string | null; amount: number; currency: string; status: string; verifiedAt: string | null }>
  invoices: Array<{ number: string; amount: number; currency: string; status: string; notes: string | null }>
  communications: Array<{ channel: string; direction: string; subject: string | null; preview: string; status: string; at: string }>
  meetings: Array<{ id: string; status: string; scheduledAt: string | null; reason: string | null; channel: string | null; bookingLink: string | null; notes: string | null; clientResponse: string | null; clientRespondedAt: string | null }>
  documents: Array<{ id: string; name: string; mimeType: string; size: number; note: string | null; scanStatus: string; direction: string; classification: string; at: string }>
  policy: { previewBeforePayment: boolean; sourceAfterFullPayment: boolean; supportContact: string; whatsapp: string }
}

const STAGE_LABELS_SHORT: Record<string, string> = {
  NEW: 'Received', CONTACTED: 'Contacted', BUSINESS_IDENTIFIED: 'Identified', PLAN_RECOMMENDED: 'Plan',
  SCOPE_COLLECTION: 'Discovery', SCOPE_REVIEW: 'Scope review', FINAL_SCOPE: 'Final scope', CLIENT_APPROVAL: 'Your approval',
  PAYMENT_PENDING: 'Payment', PROJECT_ACTIVE: 'Started', DEVELOPMENT: 'Building', CLIENT_REVIEW: 'Your review',
  FINAL_PAYMENT: 'Final payment', DELIVERY: 'Delivery', HANDOVER: 'Handover', PASSWORD_CHANGE: 'Security',
  REVIEW_REQUESTED: 'Feedback', REFERRAL_REQUESTED: 'Referral', COMPLETED: 'Completed', CLOSED: 'Closed',
}
const STAGE_ORDER = Object.keys(STAGE_LABELS_SHORT)

function fmtDate(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '—' }
}
function fmtMoney(n: number, c = 'USD') {
  return `${c === 'USD' ? '$' : `${c} `}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
function statusTone(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['PAID', 'SENT', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'DELIVERED', 'RELEASED', 'RECEIVED', 'DONE'].includes(s)) return 'default'
  if (['FAILED', 'REJECTED', 'EXPIRED'].includes(s)) return 'destructive'
  if (['NOT_CONFIGURED', 'CANCELLED', 'BLOCKED'].includes(s)) return 'outline'
  return 'secondary'
}

export default function PortalView() {
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signedOut, setSignedOut] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/me', { cache: 'no-store' })
      if (res.status === 401) { setData(null); setSignedOut(true); setError(null) }
      else if (!res.ok) { const j = await res.json().catch(() => ({})); setError((j as { error?: string }).error ?? 'Could not load your portal.') }
      else setData(await res.json() as PortalData)
    } catch { setError('Connection problem. Please retry.') }
    setLoading(false)
  }, [])

  useEffect(() => {
    // deferred so no setState runs synchronously inside the effect body
    const t = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <Skeleton className="h-10 w-72 mb-2" />
        <Skeleton className="h-5 w-96 mb-10" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return <LoginPanel onLoggedIn={() => { setSignedOut(false); load() }} />

  const stageIdx = STAGE_ORDER.indexOf(data.client.stage)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">Client Portal</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">Welcome, {data.client.name.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-slate-500">{data.client.businessName ?? data.client.businessType ?? ''} · Reference <span className="font-mono font-medium text-[#063B8F]">{data.client.clientId}</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Refresh portal data" className="h-10 gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={async () => { await fetch('/api/portal/login', { method: 'DELETE' }); setData(null); setSignedOut(true) }}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
        {/* Progress */}
        <Card className="mt-6 border-[#E2E8F0] bg-gradient-to-r from-[#F4FAFF] to-white shadow-sm">
          <CardContent className="py-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#0B1F33]">Delivery progress</span>
              <span className="text-slate-500 capitalize">{data.client.stageLabel} · {data.client.progressPct}%</span>
            </div>
            <Progress value={data.client.progressPct} className="h-2.5 bg-[#E2E8F0]" indicatorClassName="bg-gradient-to-r from-[#009FE3] to-[#063B8F]" />
            <div className="mt-4">
              <ol className="flex flex-wrap items-center gap-y-2" aria-label="Delivery stages completed so far">
                {STAGE_ORDER.slice(0, 18).map((s, i) => {
                  const done = i < stageIdx
                  const current = i === stageIdx
                  return (
                    <li key={s} className="flex items-center">
                      {i > 0 ? <span className={`h-0.5 w-2.5 sm:w-4 ${done || current ? 'bg-[#18B83A]/50' : 'bg-slate-200'}`} aria-hidden="true" /> : null}
                      <span
                        title={`Stage ${i + 1}: ${STAGE_LABELS_SHORT[s]}`}
                        aria-current={current ? 'step' : undefined}
                        className={`inline-flex items-center justify-center rounded-full text-[10.5px] font-bold transition-all ${
                          current
                            ? 'h-8 min-w-8 bg-[#063B8F] text-white shadow-md shadow-[#063B8F]/25 ring-4 ring-[#063B8F]/10'
                            : done
                              ? 'h-6.5 min-w-6.5 bg-[#18B83A] text-white'
                              : 'h-6 min-w-6 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {i + 1}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                {stageIdx >= 18 ? (
                  <>
                    <span className="inline-block size-2 rounded-full bg-[#18B83A]" aria-hidden="true" />
                    <span className="font-medium text-[#0B1F33]">All {STAGE_ORDER.slice(0, 18).length} delivery stages completed</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block size-2 rounded-full bg-[#18B83A]" aria-hidden="true" /> completed
                    <span className="ml-2 inline-block size-2 rounded-full bg-[#063B8F]" aria-hidden="true" /> current ·
                    <span className="ml-1 font-medium text-[#0B1F33]">{STAGE_LABELS_SHORT[data.client.stage] ?? data.client.stage}</span>
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {error && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: project + scope + payments (min-w-0 lets cards shrink on mobile) */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Project */}
          <SectionCard icon={<Package className="h-5 w-5" />} title="Your project">
            {data.project ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-[#0B1F33]">{data.project.name}</p>
                    <p className="text-xs font-mono text-slate-500">{data.project.code} · started {fmtDate(data.project.startedAt)}</p>
                  </div>
                  <Badge className="capitalize" variant={statusTone(data.project.status)}>{data.project.status.toLowerCase()}</Badge>
                </div>
                {data.project.taskProgress !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-slate-500"><span>Build progress</span><span>{data.project.taskProgress}% of milestones done</span></div>
                    <Progress value={data.project.taskProgress} className="h-2 bg-[#E2E8F0]" indicatorClassName="bg-[#18B83A]" />
                  </div>
                )}
                <Separator className="my-4" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xl font-bold text-[#0B1F33]">{fmtMoney(data.project.totalAmount, data.project.currency)}</p><p className="text-xs text-slate-500">Total value</p></div>
                  <div><p className="text-xl font-bold text-[#18B83A]">{fmtMoney(data.project.paidAmount, data.project.currency)}</p><p className="text-xs text-slate-500">Paid & verified</p></div>
                  <div><p className="text-xl font-bold text-[#063B8F]">{data.project.paymentStatus}</p><p className="text-xs text-slate-500">Payment status</p></div>
                </div>
              </div>
            ) : (
              <EmptyLine text="Your project is created after preview approval and payment verification — you will see it here the moment it starts." />
            )}
          </SectionCard>

          {/* Scope */}
          <SectionCard icon={<FileText className="h-5 w-5" />} title={data.scope ? `Final Scope of Work (v${data.scope.version})` : 'Scope of Work'}>
            {data.scope ? (
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-[#009FE3] hover:text-[#063B8F]">
                  <span className="inline-flex items-center gap-1">View the full approved document <ArrowRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /></span>
                </summary>
                <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-[#F4FAFF] p-4 font-sans text-[13px] leading-relaxed text-slate-700">{data.scope.text}</pre>
              </details>
            ) : (
              <EmptyLine text="Your final scope appears here once drafted and approved. Nothing is signed or paid before you approve it in writing." />
            )}
          </SectionCard>

          {/* Payments */}
          <SectionCard icon={<CreditCard className="h-5 w-5" />} title="Payments">
            {data.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[#E2E8F0] text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-medium">Milestone</th><th className="py-2 pr-4 font-medium">Amount</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium">Verified</th>
                  </tr></thead>
                  <tbody>
                    {data.payments.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4 text-slate-700">{p.milestone ?? 'Payment'}</td>
                        <td className="py-2.5 pr-4 font-semibold text-[#0B1F33]">{fmtMoney(p.amount, p.currency)}</td>
                        <td className="py-2.5 pr-4"><Badge variant={statusTone(p.status)} className="capitalize">{p.status.toLowerCase()}</Badge></td>
                        <td className="py-2.5 text-xs text-slate-500">{p.verifiedAt ? fmtDate(p.verifiedAt) : 'pending verification'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">Payments are marked paid only after verification by Tech360 — never automatically.</p>
              </div>
            ) : <EmptyLine text="No payments recorded yet. Payment milestones appear here after you approve your preview." />}
          </SectionCard>

          {/* Communications */}
          <SectionCard icon={<MessageSquare className="h-5 w-5" />} title="Our communication history">
            {data.communications.length > 0 ? (
              <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {data.communications.map((c, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${c.direction === 'IN' ? 'bg-[#063B8F]/10 text-[#063B8F]' : 'bg-[#18B83A]/10 text-[#116b26]'}`}>
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">{c.channel}</span>·<span>{c.direction === 'IN' ? 'from you' : 'from Tech360'}</span>·<span>{fmtDate(c.at)}</span>
                        {c.status === 'FAILED' && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">failed</Badge>}
                        {c.status === 'NOT_CONFIGURED' && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">channel not configured</Badge>}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-700">{c.subject ?? c.preview}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <EmptyLine text="Messages appear here — every WhatsApp, email and form message linked to your reference ID." />}
          </SectionCard>

          {/* Documents hub — two-way file exchange with full scan statuses */}
          <DocumentsCard documents={data.documents} onDone={load} />
        </div>

        {/* Right column: actions + handover + feedback + policy */}
        <div className="min-w-0 space-y-6">
          {/* Preview action */}
          <SectionCard icon={<Eye className="h-5 w-5" />} title="Project preview">
            {data.preview ? (
              <div>
                <p className="text-sm text-slate-600">Preview v{data.preview.version} · status: <span className="font-semibold lowercase">{data.preview.status}</span></p>
                <p className="mt-2 text-xs text-slate-500">Review everything before any payment decision. Approve or request changes right inside the preview.</p>
                <Button asChild className="mt-4 w-full gap-2 bg-[#009FE3] hover:bg-[#063B8F]">
                  <a href={data.preview.link} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /> Open preview</a>
                </Button>
              </div>
            ) : data.previewExpired ? (
              <RequestFreshLink onDone={load} />
            ) : <EmptyLine text="Your HTML preview is generated after scope approval — nothing is payable before you see it." />}
          </SectionCard>

          {/* Handover */}
          <SectionCard icon={<Download className="h-5 w-5" />} title="Source code handover">
            {data.handover ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {data.handover.status === 'PENDING_APPROVAL' && <><Clock className="h-4 w-4 text-amber-500" /><span className="text-slate-600">Prepared — awaiting Tech360 release approval</span></>}
                  {['RELEASED', 'DOWNLOADED', 'CONFIRMED'].includes(data.handover.status) && <><CheckCircle2 className="h-4 w-4 text-[#18B83A]" /><span className="text-slate-600">Released after full payment verification</span></>}
                </div>
                {data.handover.downloadLink && (
                  <Button asChild className="w-full gap-2 bg-[#063B8F] hover:bg-[#0B1F33]">
                    <a href={data.handover.downloadLink}><Download className="h-4 w-4" /> Download package</a>
                  </Button>
                )}
                {data.handover.confirmLink && !data.handover.passwordChangeConfirmed && (
                  <PasswordConfirm link={data.handover.confirmLink} onDone={load} />
                )}
                {data.handover.passwordChangeConfirmed && (
                  <p className="flex items-center gap-2 rounded-lg bg-[#18B83A]/10 p-2.5 text-xs text-[#116b26]"><KeyRound className="h-3.5 w-3.5" /> Password change confirmed — thank you.</p>
                )}
              </div>
            ) : <EmptyLine text="The source package is released only after full payment verification — by policy, automatically enforced." />}
          </SectionCard>

          {/* Policy card */}
          <Card className="border-[#E2E8F0] bg-gradient-to-b from-[#063B8F] to-[#0B1F33] text-white shadow-md">
            <CardContent className="py-5">
              <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#4ade80]" /> Your protections</p>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-300">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18B83A]" /> HTML preview before payment</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18B83A]" /> Source code only after full payment</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18B83A]" /> Every action recorded against your Client ID</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18B83A]" /> Scope changes require written approval</li>
              </ul>
              <Separator className="my-4 bg-white/15" />
              <p className="text-xs text-slate-300">Questions? <a className="font-semibold text-white underline underline-offset-2" href={`mailto:${data.policy.supportContact}`}>{data.policy.supportContact}</a> · WhatsApp <a className="font-semibold text-white underline underline-offset-2" href="https://wa.me/8801327100297" target="_blank" rel="noopener noreferrer">{data.policy.whatsapp}</a></p>
            </CardContent>
          </Card>

          {/* Review + referral feedback (right rail keeps both columns balanced) */}
          <ReviewCard review={data.review} stage={data.client.stage} onDone={load} />
          <ReferralCard referral={data.referral} onDone={load} />

          {/* Meetings — schedule + responses */}
          <MeetingsCard meetings={data.meetings} onDone={load} />
        </div>
      </div>
    </div>
  )
}

// ---------------- Password-change confirmation (real action) ----------------
function PasswordConfirm({ link, onDone }: { link: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await fetch(link, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwordsChanged: true, received: true, working: true, notes: 'Confirmed via client portal' }) })
      setDone(true)
      onDone()
    } finally { setBusy(false) }
  }
  if (done) return <p className="flex items-center gap-2 rounded-lg bg-[#18B83A]/10 p-2.5 text-xs text-[#116b26]"><KeyRound className="h-3.5 w-3.5" /> Password change confirmed — thank you.</p>
  return (
    <Button onClick={confirm} disabled={busy} variant="outline" className="w-full gap-2 border-[#063B8F] text-[#063B8F] hover:bg-[#F4FAFF]">
      <KeyRound className="h-4 w-4" /> {busy ? 'Confirming…' : 'I changed my passwords'}
    </Button>
  )
}

// ---------------- Review submission (real record, consent-aware) ----------------
function ReviewCard({ review, stage, onDone }: { review: PortalData['review']; stage: string; onDone: () => void }) {
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [content, setContent] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  const eligible = ['REVIEW_REQUESTED', 'REFERRAL_REQUESTED', 'COMPLETED', 'CLOSED', 'PASSWORD_CHANGE', 'DELIVERY', 'HANDOVER'].includes(stage)
  const submitted = review && !resubmitting && ['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(review.status)
  const withdrawn = review?.status === 'WITHDRAWN' && !resubmitting

  async function submit() {
    if (rating < 1) { toast.error('Please choose a star rating.'); return }
    if (content.trim().length < 20) { toast.error('Please write at least 20 characters.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/portal/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, content: content.trim(), consent }),
      })
      const j = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) toast.error(j.error ?? 'Submission failed.')
      else { toast.success(j.message ?? 'Thank you — your review was submitted.'); setResubmitting(false); onDone() }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  async function withdraw() {
    setBusy(true)
    try {
      const res = await fetch('/api/portal/review/withdraw', { method: 'POST' })
      const j = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) toast.error(j.error ?? 'Withdrawal failed.')
      else {
        toast.success(j.message ?? 'Your review consent is withdrawn.')
        setConfirmWithdraw(false)
        onDone()
      }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  return (
    <SectionCard icon={<Star className="h-5 w-5" />} title="Share your experience">
      {withdrawn ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Lock className="h-4 w-4 text-slate-400" /> Your review consent is withdrawn — nothing of yours is published on our website.
          </p>
          {review?.rating ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < review.rating! ? 'fill-slate-300 text-slate-300' : 'fill-slate-100 text-slate-200'}`} aria-hidden="true" />
              ))}
              <span className="ml-2 text-xs text-slate-400">kept as a private record</span>
            </div>
          ) : null}
          {eligible ? (
            <div className="rounded-xl bg-[#F4FAFF] p-3 text-xs leading-relaxed text-slate-600">
              Changed your mind? You can submit a new review with fresh consent at any time.
              <Button variant="outline" size="sm" className="ml-2 border-[#063B8F]/30 text-[#063B8F] hover:bg-[#063B8F]/5" onClick={() => { setRating(0); setContent(''); setConsent(false); setResubmitting(true) }}>
                <Undo2 className="h-3.5 w-3.5" /> Write a new review
              </Button>
            </div>
          ) : null}
        </div>
      ) : submitted ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            {review?.status === 'APPROVED' ? <><CheckCircle2 className="h-4 w-4 text-[#18B83A]" /> Published on our website — thank you.</> : null}
            {review?.status === 'SUBMITTED' ? <><Clock className="h-4 w-4 text-amber-500" /> Submitted — awaiting Tech360 moderation.</> : null}
            {review?.status === 'REJECTED' ? <><Lock className="h-4 w-4 text-slate-400" /> Received, but kept private after moderation.</> : null}
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < (review?.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300'}`} aria-hidden="true" />
            ))}
            <span className="ml-2 text-xs text-slate-400">submitted {fmtDate(review?.createdAt)}</span>
          </div>
          {review?.content ? <blockquote className="border-l-2 border-[#E2E8F0] pl-3 text-sm italic leading-relaxed text-slate-600">“{review.content}”</blockquote> : null}
          {review && (review.status === 'SUBMITTED' || review.status === 'APPROVED') ? (
            <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
              {confirmWithdraw ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800" role="alert">
                  <p className="font-medium">Withdraw your review consent?</p>
                  <p className="mt-1">{review.status === 'APPROVED' ? 'Your review is currently live on bdtech360.com — withdrawing removes it immediately.' : 'Your review will not be published.'} Your review is kept as a private record and never displayed without consent again.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmWithdraw(false)} disabled={busy} className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100">Keep my review</Button>
                    <Button size="sm" onClick={withdraw} disabled={busy} className="bg-amber-600 text-white hover:bg-amber-700">
                      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Yes, withdraw consent
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmWithdraw(true)}
                  className="inline-flex items-center gap-1.5 rounded-sm text-xs text-slate-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Withdraw my review consent (removes it from the website)
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : eligible ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">How was your experience working with us? Your review is published only with your explicit consent, after Tech360 moderation.</p>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={rating === i + 1}
                aria-label={`${i + 1} star${i > 0 ? 's' : ''}`}
                onClick={() => setRating(i + 1)}
                className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]"
              >
                <Star className={`h-6 w-6 transition-colors ${i < rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-300 hover:text-amber-300'}`} aria-hidden="true" />
              </button>
            ))}
            <span className="ml-2 text-xs text-slate-500">{rating > 0 ? `${rating}/5` : 'tap to rate'}</span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="review-content" className="text-xs text-slate-500">Your review</Label>
            <Textarea
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did we do well? What could be better? (min 20 characters)"
              className="min-h-[90px] border-[#E2E8F0] focus-visible:ring-[#009FE3]/40"
              maxLength={2000}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#F4FAFF] p-3 text-xs leading-relaxed text-slate-600">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5 border-[#063B8F] data-[state=checked]:bg-[#063B8F]" aria-label="Consent to publish review" />
            <span>I consent to my review, name and company being published on bdtech360.com. I can withdraw this consent myself, right here in the portal, anytime.</span>
          </label>
          <Button onClick={submit} disabled={busy} className="w-full gap-2 bg-[#009FE3] hover:bg-[#063B8F]">
            <Star className="h-4 w-4" /> {busy ? 'Submitting…' : 'Submit review'}
          </Button>
        </div>
      ) : (
        <EmptyLine text="After your project is delivered, we will invite you to share a review — published only with your consent." />
      )}
    </SectionCard>
  )
}

// ---------------- Referral submission (real record) ----------------
function ReferralCard({ referral, onDone }: { referral: PortalData['referral']; onDone: () => void }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (name.trim().length < 2) { toast.error('Please tell us who you are referring.'); return }
    if (contact.trim().length < 5) { toast.error('A contact for the referral is required.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/portal/referral', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), notes: notes.trim() }),
      })
      const j = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) toast.error(j.error ?? 'Submission failed.')
      else { toast.success(j.message ?? 'Thank you for the referral!'); onDone() }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  const hasReferral = referral && referral.status !== 'REQUESTED'

  return (
    <SectionCard icon={<Handshake className="h-5 w-5" />} title="Refer a business">
      {hasReferral ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-[#18B83A]" />
            You referred <span className="font-semibold text-[#0B1F33]">{referral?.name}</span> — status: <Badge variant={referral?.status === 'CONVERTED' ? 'default' : 'secondary'} className="capitalize">{referral?.status.toLowerCase()}</Badge>
          </p>
          <p className="text-xs text-slate-500">Thank you! Referrals are the strongest compliment a software partner can get.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Know a business that needs software, automation or a website? Introduce us — we take care of the rest.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-name" className="text-xs text-slate-500">Business or person name *</Label>
            <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dhaka Traders Ltd. / Rahim Uddin" className="border-[#E2E8F0] focus-visible:ring-[#009FE3]/40" maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-contact" className="text-xs text-slate-500">Their email or phone *</Label>
            <Input id="ref-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="name@company.com or +880…" className="border-[#E2E8F0] focus-visible:ring-[#009FE3]/40" maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ref-notes" className="text-xs text-slate-500">What do they need? (optional)</Label>
            <Textarea id="ref-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. inventory system, eCommerce site…" className="min-h-[60px] border-[#E2E8F0] focus-visible:ring-[#009FE3]/40" maxLength={1000} />
          </div>
          <Button onClick={submit} disabled={busy} variant="outline" className="w-full gap-2 border-[#063B8F] text-[#063B8F] hover:bg-[#F4FAFF]">
            <Handshake className="h-4 w-4" /> {busy ? 'Sending…' : 'Send referral'}
          </Button>
        </div>
      )}
    </SectionCard>
  )
}

// ---------------- Fresh preview link request (expired previews) ----------------
function RequestFreshLink({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [requested, setRequested] = useState(false)

  async function request() {
    setBusy(true)
    try {
      const res = await fetch('/api/portal/request-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: '' }),
      })
      const j = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) toast.error(j.error ?? 'Request failed.')
      else { toast.success(j.message ?? 'Request sent.'); setRequested(true); onDone() }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  if (requested) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-xl bg-[#18B83A]/10 p-3 text-sm text-[#116b26]">
          <CheckCircle2 className="h-4 w-4" /> Request sent — our team will regenerate your preview link.
        </p>
        <p className="text-xs text-slate-500">We will share the fresh link over your configured channel (email/WhatsApp) once it is ready.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Clock className="h-4 w-4 text-amber-500" /> Your preview link has expired (links expire after 30 days for security).
      </p>
      <Button onClick={request} disabled={busy} className="w-full gap-2 bg-[#009FE3] hover:bg-[#063B8F]">
        <LinkIcon className="h-4 w-4" /> {busy ? 'Requesting…' : 'Request a fresh link'}
      </Button>
    </div>
  )
}

// ---------------- Documents hub (two-way file exchange) ----------------
const DOC_ACCEPT = '.pdf,.txt,.md,.csv,.json,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.webp'

function docIcon(mime: string) {
  if (mime.startsWith('image/')) return <FileIcon className="h-4 w-4" />
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('document')) return <FileText className="h-4 w-4" />
  if (mime.includes('sheet') || mime === 'text/csv') return <Paperclip className="h-4 w-4" />
  return <FileIcon className="h-4 w-4" />
}

function fmtDocSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function DocumentsCard({ documents, onDone }: { documents: PortalData['documents']; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploads = documents.filter((d) => d.direction === 'UPLOADED')
  const shared = documents.filter((d) => d.direction === 'SHARED')

  async function upload() {
    if (!file) { toast.error('Choose a file first.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Files must be 5MB or smaller.'); return }
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (note.trim()) form.append('note', note.trim())
      const res = await fetch('/api/portal/documents', { method: 'POST', body: form })
      const j = await res.json().catch(() => ({})) as { error?: string; warning?: string }
      if (!res.ok) toast.error(j.error ?? 'Upload failed.')
      else {
        toast.success(j.warning ? 'Uploaded — flagged for review by our team.' : `"${file.name}" uploaded and scanned clean.`)
        setFile(null); setNote('')
        if (inputRef.current) inputRef.current.value = ''
        onDone()
      }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/portal/documents/${id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) toast.error(j.error ?? 'Delete failed.')
      else { toast.success('File deleted.'); setConfirmDelete(null); onDone() }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  return (
    <SectionCard icon={<Paperclip className="h-5 w-5" />} title="Documents">
      <div className="space-y-4">
        {/* Upload control */}
        <div className="rounded-xl border border-dashed border-[#009FE3]/50 bg-[#F4FAFF] p-4">
          <input
            ref={inputRef}
            id="doc-file"
            type="file"
            accept={DOC_ACCEPT}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="doc-file"
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg px-3 py-4 text-center transition-colors hover:bg-[#E6F5FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3]"
          >
            <Upload className="h-6 w-6 text-[#009FE3]" aria-hidden="true" />
            <span className="text-sm font-semibold text-[#063B8F]">{file ? file.name : 'Choose a file to share with us'}</span>
            <span className="text-xs text-slate-500">
              {file ? `${fmtDocSize(file.size)} selected` : 'Brand assets, briefs, requirements, references — up to 5MB'}
            </span>
          </label>
          {file && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note for the team (e.g. “logo pack v2”)"
                maxLength={300}
                aria-label="Note for the Tech360 team"
                className="h-9 flex-1 border-[#CBD5E1] bg-white text-sm"
              />
              <Button onClick={upload} disabled={busy} className="h-9 gap-2 bg-[#009FE3] px-5 hover:bg-[#063B8F]">
                <FileUp className="h-4 w-4" /> {busy ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3 w-3 shrink-0 text-[#18B83A]" aria-hidden="true" />
            Every file is scanned before anyone can open it — quarantined files stay locked until a human reviews them.
          </p>
        </div>

        {/* Shared by Tech360 */}
        {shared.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#063B8F]">
              <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" /> Shared by Tech360
            </p>
            <ul className="space-y-2">
              {shared.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-xl border-l-4 border-[#009FE3] border-y border-r border-[#E2E8F0] bg-white p-3 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#063B8F]">{docIcon(d.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/portal/documents/${d.id}`}
                      className="block truncate text-sm font-semibold text-[#0B1F33] underline-offset-2 hover:text-[#009FE3] hover:underline"
                    >
                      {d.name}
                    </a>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fmtDocSize(d.size)} · {fmtDate(d.at)}{d.note ? ` · ${d.note}` : ''}
                    </p>
                  </div>
                  <Badge className={d.classification === 'CONFIDENTIAL' || d.classification === 'HIGHLY_SENSITIVE' ? 'h-5 bg-amber-100 px-1.5 text-[10px] text-amber-800 hover:bg-amber-100' : 'h-5 bg-slate-100 px-1.5 text-[10px] text-slate-600 hover:bg-slate-100'}>
                    {d.classification.toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Your uploads */}
        {uploads.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Your uploads ({uploads.length})
            </p>
            <ul className="space-y-2">
              {uploads.map((d) => (
                <li key={d.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    {d.mimeType.startsWith('image/') && d.scanStatus === 'CLEAN' ? (
                      <img
                        src={`/api/portal/documents/${d.id}?inline=1`}
                        alt={`Thumbnail of ${d.name}`}
                        className="h-9 w-9 shrink-0 rounded-lg border border-[#E2E8F0] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{docIcon(d.mimeType)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      {d.scanStatus === 'CLEAN' ? (
                        <a href={`/api/portal/documents/${d.id}`} className="block truncate text-sm font-semibold text-[#0B1F33] underline-offset-2 hover:text-[#009FE3] hover:underline">{d.name}</a>
                      ) : (
                        <p className="block truncate text-sm font-semibold text-slate-400">{d.name}</p>
                      )}
                      <p className="mt-0.5 truncate text-xs text-slate-500">{fmtDocSize(d.size)} · {fmtDate(d.at)}{d.note ? ` · ${d.note}` : ''}</p>
                    </div>
                    {d.scanStatus === 'CLEAN' && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18B83A]/10 text-[#116b26]" title="Scanned clean">
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    {d.scanStatus === 'QUARANTINED' && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700" title="Quarantined — pending review">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${d.name}`}
                      onClick={() => setConfirmDelete(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {d.scanStatus === 'QUARANTINED' && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] leading-snug text-amber-800">
                      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      Locked by the content scan — our team reviews it before download is possible.
                    </p>
                  )}
                  {confirmDelete === d.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-2">
                      <p className="min-w-0 flex-1 text-xs text-red-700">Delete “{d.name}”? This is recorded and our team is notified.</p>
                      <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-700 hover:bg-red-100" onClick={() => setConfirmDelete(null)}>Keep</Button>
                      <Button size="sm" className="h-7 bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => remove(d.id)}>Delete</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {documents.length === 0 && (
          <EmptyLine text="Share your logo, brand guide, content or any reference file — everything stays linked to your Client ID." />
        )}
      </div>
    </SectionCard>
  )
}

// ---------------- Meetings (real schedule, client responses) ----------------
const CHANNEL_LABELS: Record<string, string> = {
  GOOGLE_MEET: 'Google Meet', ZOOM: 'Zoom', PHONE: 'Phone call', WHATSAPP_CALL: 'WhatsApp call',
}

function fmtMeetingWhen(d?: string | null): string {
  if (!d) return 'Time to be confirmed'
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch { return 'Time to be confirmed' }
}

function MeetingCountdown({ at }: { at: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = new Date(at).getTime() - Date.now()
      if (diff <= 0) { setLabel('Happening now / started'); return }
      const mins = Math.floor(diff / 60_000)
      if (mins < 60) { setLabel(`in ${mins} min`); return }
      const hrs = Math.floor(mins / 60)
      if (hrs < 24) { setLabel(`in ${hrs}h ${mins % 60}m`); return }
      setLabel(`in ${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? '' : 's'}`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [at])
  if (!label) return null
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#063B8F]/5 px-2.5 py-1 text-xs font-semibold text-[#063B8F]"><Clock className="h-3 w-3" aria-hidden /> {label}</span>
}

function MeetingsCard({ meetings, onDone }: { meetings: PortalData['meetings']; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const now = Date.now()
  const upcoming = meetings.filter((m) => ['REQUESTED', 'SCHEDULED'].includes(m.status) && (!m.scheduledAt || new Date(m.scheduledAt).getTime() > now - 60 * 60_000))
  const past = meetings.filter((m) => !upcoming.includes(m))

  async function respond(meetingId: string, action: 'CONFIRM' | 'DECLINE' | 'RESCHEDULE', msg?: string) {
    setBusy(`${meetingId}:${action}`)
    try {
      const res = await fetch('/api/portal/meeting/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, action, message: msg ?? '' }),
      })
      const j = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) toast.error(j.error ?? 'Could not save your response.')
      else {
        toast.success(action === 'CONFIRM' ? 'See you there — your confirmation is recorded.' : action === 'DECLINE' ? 'Noted. We will reach out to re-plan.' : 'Reschedule request sent to our team.')
        setRescheduleFor(null)
        setMessage('')
        onDone()
      }
    } catch { toast.error('Connection problem. Please retry.') }
    finally { setBusy(null) }
  }

  return (
    <SectionCard icon={<CalendarDays className="h-5 w-5" />} title="Meetings with our team">
      {meetings.length === 0 ? (
        <EmptyLine text="No meetings yet. If you would like a call to discuss your scope or progress, request one from your preview page or reply to any message — we will schedule it here." />
      ) : (
        <div className="space-y-4">
          {/* Next meetings — hero treatment */}
          {upcoming.map((m) => (
            <div key={m.id} className="rounded-2xl border border-[#DCEAF6] bg-gradient-to-br from-[#F4FAFF] to-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0B1F33]">{m.reason ?? 'Consultation call'}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#063B8F]">
                    <CalendarDays className="h-4 w-4 shrink-0 text-[#009FE3]" aria-hidden />
                    <span className="capitalize">{fmtMeetingWhen(m.scheduledAt)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {m.status === 'SCHEDULED' && m.scheduledAt && <MeetingCountdown at={m.scheduledAt} />}
                  <Badge variant={m.status === 'SCHEDULED' ? 'default' : 'secondary'} className="capitalize">{m.status === 'SCHEDULED' ? 'scheduled' : 'requested'}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-[#063B8F] ring-1 ring-[#DCEAF6]"><Video className="h-3 w-3" aria-hidden /> {CHANNEL_LABELS[m.channel ?? 'GOOGLE_MEET'] ?? m.channel}</span>
                {m.clientResponse && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${m.clientResponse === 'CONFIRMED' ? 'bg-[#18B83A]/10 text-[#116b26]' : m.clientResponse === 'DECLINED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300/60'}`}>
                    you: {m.clientResponse === 'CONFIRMED' ? 'confirmed' : m.clientResponse === 'DECLINED' ? 'declined' : 'asked to reschedule'}
                  </span>
                )}
              </div>
              {m.bookingLink && (
                <Button asChild className="mt-3 w-full gap-2 bg-[#009FE3] hover:bg-[#063B8F] sm:w-auto">
                  <a href={m.bookingLink} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4" /> Join {CHANNEL_LABELS[m.channel ?? 'GOOGLE_MEET'] ?? 'call'}</a>
                </Button>
              )}
              {(!m.clientResponse || m.clientResponse === 'RESCHEDULE_REQUESTED') && (
                rescheduleFor === m.id ? (
                  <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                    <Label htmlFor={`rs-${m.id}`} className="text-xs font-semibold text-amber-800">When works better for you?</Label>
                    <Textarea id={`rs-${m.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={300} placeholder="e.g. Weekday afternoons after 4pm, or a specific date/time…" className="bg-white text-sm" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="gap-1.5 bg-[#063B8F] hover:bg-[#0B1F33]" disabled={busy === `${m.id}:RESCHEDULE` || !message.trim()} onClick={() => respond(m.id, 'RESCHEDULE', message)}>
                        {busy === `${m.id}:RESCHEDULE` ? 'Sending…' : <><Send className="h-3.5 w-3.5" /> Send request</>}
                      </Button>
                      <Button size="sm" variant="outline" className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100" onClick={() => { setRescheduleFor(null); setMessage('') }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Respond to meeting invitation">
                    <Button size="sm" className="gap-1.5 bg-[#18B83A] hover:bg-[#116b26]" disabled={busy === `${m.id}:CONFIRM`} onClick={() => respond(m.id, 'CONFIRM')}>
                      {busy === `${m.id}:CONFIRM` ? 'Saving…' : <><CheckCircle2 className="h-3.5 w-3.5" /> I can make it</>}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-[#DCEAF6] text-slate-600 hover:bg-[#F4FAFF]" disabled={busy === `${m.id}:RESCHEDULE`} onClick={() => setRescheduleFor(m.id)}>
                      <Clock className="h-3.5 w-3.5" /> Propose another time
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-[#E2E8F0] text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600" disabled={busy === `${m.id}:DECLINE`} onClick={() => respond(m.id, 'DECLINE')}>
                      <CalendarX className="h-3.5 w-3.5" /> Can&apos;t make it
                    </Button>
                  </div>
                )
              )}
            </div>
          ))}

          {/* Past meetings — compact history */}
          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">History</p>
              <ul className="space-y-2">
                {past.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.status === 'COMPLETED' ? 'bg-[#18B83A]/10 text-[#116b26]' : 'bg-slate-100 text-slate-400'}`}>
                      {m.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> : <CalendarX className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                        {m.reason ?? 'Meeting'}
                        <Badge variant={statusTone(m.status)} className="h-4 px-1.5 text-[10px] capitalize">{m.status.toLowerCase()}</Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{fmtMeetingWhen(m.scheduledAt)}</p>
                      {m.status === 'COMPLETED' && m.notes && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-500">{m.notes.slice(0, 220)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ---------------- Shared bits ----------------
function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.35 }}>
      <Card className="border-[#E2E8F0] shadow-sm transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center gap-3 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#009FE3]/10 text-[#063B8F]">{icon}</span>
          <CardTitle className="text-base font-bold text-[#0B1F33]">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.section>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-500">{text}</p>
}

// ---------------- Login panel ----------------
function LoginPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [clientId, setClientId] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!clientId.trim() || !contact.trim()) { setError('Both fields are required.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), contact: contact.trim() }),
      })
      const j = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) setError(j.error ?? 'Sign-in failed. Please check your details.')
      else onLoggedIn()
    } catch { setError('Connection problem. Please retry.') }
    finally { setBusy(false) }
  }

  return (
    <div className="relative overflow-hidden py-16">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#F4FAFF] via-white to-transparent" />
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">Client Portal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">Your project, on the record.</h1>
          <p className="mt-4 max-w-md leading-relaxed text-slate-600">Track your delivery stage, review your approved scope, open your HTML preview before payment, follow every message linked to your reference ID, and receive your source package after full payment verification.</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            <li className="flex items-center gap-2.5"><ShieldCheck className="h-4.5 w-4.5 text-[#18B83A]" /> HTML Preview Before Payment — always</li>
            <li className="flex items-center gap-2.5"><Lock className="h-4.5 w-4.5 text-[#063B8F]" /> Source code released only after verified full payment</li>
            <li className="flex items-center gap-2.5"><Eye className="h-4.5 w-4.5 text-[#009FE3]" /> Every status you see is the real system status</li>
          </ul>
          <p className="mt-6 text-xs text-slate-400">Don't have your reference? Email <a className="font-medium text-[#009FE3]" href="mailto:info@bdtech360.com">info@bdtech360.com</a> or message us on WhatsApp.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-[#E2E8F0] shadow-xl shadow-[#063B8F]/5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-[#0B1F33]"><Lock className="h-5 w-5 text-[#063B8F]" /> Sign in to your portal</CardTitle>
            </CardHeader>
            <CardContent>
              <form ref={formRef} onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="portal-client-id">Client ID</Label>
                  <Input id="portal-client-id" placeholder="TECH-2026-000001" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" className="h-11 font-mono uppercase" aria-required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="portal-contact">Email or WhatsApp number</Label>
                  <Input id="portal-contact" placeholder="you@company.com or +8801XXXXXXXXX" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="off" className="h-11" aria-required />
                  <p className="text-xs text-slate-400">Must match the email/WhatsApp you gave when you contacted us.</p>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</motion.p>
                  )}
                </AnimatePresence>
                <Button type="submit" disabled={busy} className="h-11 w-full gap-2 bg-[#009FE3] text-base font-semibold hover:bg-[#063B8F]">
                  {busy ? 'Verifying…' : <>Enter my portal <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
