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
import {
  LogOut, RefreshCw, ShieldCheck, FileText, CreditCard, MessageSquare,
  Download, KeyRound, Eye, Package, ArrowRight, CheckCircle2, Clock, Lock,
} from 'lucide-react'

type PortalData = {
  client: { clientId: string; name: string; businessName: string | null; businessType: string | null; stage: string; stageLabel: string; progressPct: number }
  project: { code: string; name: string; status: string; totalAmount: number; paidAmount: number; currency: string; paymentStatus: string; startedAt: string | null; timelineWeeks: number | null; tasks: Array<{ title: string; status: string }>; taskProgress: number | null } | null
  scope: { version: number; approvedAt: string | null; text: string } | null
  preview: { link: string; status: string; version: number } | null
  handover: { status: string; downloadLink: string | null; confirmLink: string | null; passwordChangeRequested: boolean; passwordChangeConfirmed: boolean } | null
  delivery: { status: string; confirmedAt: string | null } | null
  payments: Array<{ milestone: string | null; amount: number; currency: string; status: string; verifiedAt: string | null }>
  invoices: Array<{ number: string; amount: number; currency: string; status: string; notes: string | null }>
  communications: Array<{ channel: string; direction: string; subject: string | null; preview: string; status: string; at: string }>
  meetings: Array<{ status: string; scheduledAt: string | null; reason: string | null }>
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">Client Portal</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">Welcome, {data.client.name.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-slate-500">{data.client.businessName ?? data.client.businessType ?? ''} · Reference <span className="font-mono font-semibold text-[#063B8F]">{data.client.clientId}</span></p>
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
            <Progress value={data.client.progressPct} className="h-2.5 bg-[#E2E8F0]" />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {STAGE_ORDER.slice(0, 18).map((s, i) => (
                <span key={s} title={STAGE_LABELS_SHORT[s]} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${i <= stageIdx ? (i === stageIdx ? 'bg-[#063B8F] text-white' : 'bg-[#18B83A]/15 text-[#116b26]') : 'bg-slate-100 text-slate-400'}`}>
                  {i + 1}
                </span>
              ))}
              <span className="ml-2 text-xs text-slate-500">{STAGE_LABELS_SHORT[data.client.stage] ?? data.client.stage}</span>
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
        {/* Left column: project + scope + payments */}
        <div className="space-y-6 lg:col-span-2">
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
                    <Progress value={data.project.taskProgress} className="h-2" />
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
        </div>

        {/* Right column: actions + handover + policy */}
        <div className="space-y-6">
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
