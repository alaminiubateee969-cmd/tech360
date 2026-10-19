'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Loader2, MessageSquare, RefreshCw, ShieldCheck, User } from 'lucide-react'

import { useApi, type ClientRow } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { ClientPicker } from './shared/Pager'
import { ACCENT, CARD, SCROLL_THIN } from './shared/styles'

interface PipelineResponse {
  journey: Array<{
    number: number
    key: string
    label: string
    messageStage: string
    gate: 'AUTO_SEND' | 'ADMIN_APPROVAL_REQUIRED'
    clients: number
  }>
  pipelineStages: Array<{ stage: string; label: string; clients: number }>
  autoSendStages: string[]
  adminApprovalStages: string[]
  adminApprovalCategories: string[]
  policies: string[]
  stats: {
    totalClients: number
    pendingApprovals: number
    savedPipelineMessages: number
    channelCounts: Record<string, number>
  }
  copy: Array<{
    stage: string
    whatsapp: string
    emailSubject: string | null
    email: string
    gate: 'AUTO_SEND' | 'ADMIN_APPROVAL_REQUIRED'
    gateReason: string
    detectedCategories: string[]
  }>
}

interface ProfileResponse {
  ok: boolean
  profile: {
    clientId: string
    name: string
    businessName: string | null
    businessType: string | null
    phone: string | null
    whatsapp: string | null
    email: string | null
    leadSource: string
    pipelineStage: string
    status: string
    messageHistory: Array<{ id: string; at: string; channel: string; direction: string; subject: string | null; body: string; status: string; templateName: string | null }>
    scopeHistory: Array<{ id: string; at: string; version: number; status: string; summary: string | null; decision: string | null }>
    approvalHistory: Array<{ id: string; at: string; type: string; status: string; title: string; decidedBy: string | null }>
    paymentHistory: Array<{ id: string; at: string; amount: number; currency: string; status: string; method: string | null; transactionId: string | null; verifiedAt: string | null; invoice: string | null }>
    deliveryHistory: Array<{ id: string; at: string; kind: string; status: string; projectCode: string | null; clientConfirmedAt: string | null; passwordChangeConfirmedAt: string | null }>
    reviewHistory: Array<{ id: string; at: string; kind: string; status: string; published: boolean; consent: boolean }>
    counters: { messages: number; inbound: number; outbound: number; scopes: number; approvals: number; payments: number; paidTotal: number; deliveries: number; reviews: number }
  }
}

function GateBadge({ gate }: { gate: 'AUTO_SEND' | 'ADMIN_APPROVAL_REQUIRED' }) {
  if (gate === 'AUTO_SEND') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
        <CheckCircle2 className="size-3" aria-hidden="true" /> Auto-send
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
      <ShieldCheck className="size-3" aria-hidden="true" /> Admin approval
    </span>
  )
}

export function PipelineView() {
  const { data, loading, error, refresh } = useApi<PipelineResponse>('/api/admin/pipeline')
  const [selected, setSelected] = useState<ClientRow | null>(null)
  const [profile, setProfile] = useState<ProfileResponse['profile'] | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [manualRef, setManualRef] = useState('')

  const lookup = useMemo(() => (ref: string) => `/api/admin/pipeline/profile/${encodeURIComponent(ref)}`, [])

  async function loadProfile(ref: string) {
    if (!ref.trim()) return
    setProfileLoading(true)
    setProfileError(null)
    try {
      const res = await fetch(lookup(ref.trim()))
      const json = (await res.json()) as ProfileResponse & { error?: string }
      if (!res.ok) {
        setProfile(null)
        setProfileError(json.error ?? 'Profile could not be loaded.')
        return
      }
      setProfile(json.profile)
    } catch {
      setProfile(null)
      setProfileError('The profile request failed.')
    } finally {
      setProfileLoading(false)
    }
  }

  const channelRows = data ? Object.entries(data.stats.channelCounts) : []

  return (
    <div>
      <PageHeader
        title="Communication Pipeline"
        description="The eleven-stage client journey from the first message to final delivery — the exact copy that is sent, the auto-send vs admin-approval gate for each stage, and the records the CRM keeps."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Clients" value={data?.stats.totalClients ?? 0} icon={User} tone="accent" sub="Client records in the CRM" loading={loading} />
        <KpiCard label="Pending approvals" value={data?.stats.pendingApprovals ?? 0} icon={ShieldCheck} tone="amber" sub="Gated messages awaiting a Super Admin" loading={loading} />
        <KpiCard label="Pipeline messages saved" value={data?.stats.savedPipelineMessages ?? 0} icon={MessageSquare} tone="green" sub="Outbound pipeline messages in the CRM" loading={loading} />
        <KpiCard label="Journey stages" value={data?.journey.length ?? 11} icon={FileText} tone="slate" sub="First message → final delivery" loading={loading} />
      </div>

      <Tabs defaultValue="journey" className="space-y-4">
        <TabsList>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="copy">Exact copy</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="profile">Client profile</TabsTrigger>
        </TabsList>

        <TabsContent value="journey">
          <SectionCard title="The eleven client-journey stages" description="The client count in each column is read live from the CRM.">
            <ol className="space-y-2">
              {(data?.journey ?? []).map((stage) => (
                <li key={stage.key} className={CARD}>
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#009FE3]/10 text-xs font-semibold text-[#009FE3]">
                      {stage.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{stage.label}</p>
                      <p className="truncate font-mono text-[11px] text-slate-500">{stage.messageStage}</p>
                    </div>
                    <GateBadge gate={stage.gate} />
                    <span className="w-24 text-right text-xs tabular-nums text-slate-400">{stage.clients} client{stage.clients === 1 ? '' : 's'}</span>
                  </div>
                </li>
              ))}
              {!data && !loading ? <EmptyState title="No pipeline data" description="The pipeline definition could not be loaded." /> : null}
            </ol>
          </SectionCard>
        </TabsContent>

        <TabsContent value="copy">
          <SectionCard
            title="The exact copy the pipeline sends"
            description="Taken from the same module the journey engine sends, with sample values. The WhatsApp/SMS body and the email body are the specified wording."
          >
            <div className="space-y-3">
              {(data?.copy ?? []).map((entry) => (
                <details key={entry.stage} className={CARD}>
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-200">
                    <span className="mr-2 inline-flex align-middle"><GateBadge gate={entry.gate} /></span>
                    {entry.stage}
                    {entry.emailSubject ? <span className="ml-2 text-xs font-normal text-slate-500">— {entry.emailSubject}</span> : null}
                  </summary>
                  <p className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
                    Gate: {entry.gateReason}
                    {entry.detectedCategories.length > 0 ? ` · detected: ${entry.detectedCategories.join(', ')}` : ''}
                  </p>
                  <div className="grid gap-3 border-t border-slate-800 p-3 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">WhatsApp / SMS</p>
                      <pre className={`max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-300 ${SCROLL_THIN}`}>
                        {entry.whatsapp}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</p>
                      <pre className={`max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-300 ${SCROLL_THIN}`}>
                        {entry.email}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
              {!data && !loading ? <EmptyState title="No copy loaded" /> : null}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="gates">
          <div className="grid gap-3 lg:grid-cols-2">
            <SectionCard title="The AI agent may auto-send" description="These messages never wait for a human.">
              <ul className="space-y-1.5">
                {(data?.autoSendStages ?? []).map((stage) => (
                  <li key={stage} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                    <span className="font-mono text-xs">{stage}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="An admin approval is required" description="These are composed and saved, but never sent without a Super Admin decision.">
              <ul className="space-y-1.5">
                {(data?.adminApprovalStages ?? []).map((stage) => (
                  <li key={stage} className="flex items-center gap-2 text-sm text-slate-300">
                    <ShieldCheck className="size-3.5 text-amber-400" aria-hidden="true" />
                    <span className="font-mono text-xs">{stage}</span>
                  </li>
                ))}
                {(data?.adminApprovalCategories ?? []).map((category) => (
                  <li key={category} className="flex items-center gap-2 text-sm text-slate-300">
                    <ShieldCheck className="size-3.5 text-amber-400" aria-hidden="true" />
                    <span className="font-mono text-xs">{category}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="The two delivery policies" description="Enforced in code, not in a document.">
              <ul className="space-y-1.5">
                {(data?.policies ?? []).map((policy) => (
                  <li key={policy} className="flex items-center gap-2 text-sm text-slate-200">
                    <ShieldCheck className="size-3.5" style={{ color: ACCENT }} aria-hidden="true" />
                    {policy}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Saved communications by channel" description="Every inbound and outbound message is a CRM record.">
              {channelRows.length === 0 ? (
                <EmptyState title="No communications recorded yet" description="Messages appear here as soon as the pipeline sends or receives one." />
              ) : (
                <ul className="space-y-1.5">
                  {channelRows.map(([key, count]) => (
                    <li key={key} className="flex items-center justify-between border-b border-slate-800/70 py-1 text-sm">
                      <span className="font-mono text-xs text-slate-400">{key}</span>
                      <span className="tabular-nums text-slate-200">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <SectionCard title="Find a client" description="Search by name, Client ID or business.">
              <div className="space-y-3">
                <ClientPicker
                  value={selected}
                  onChange={(client) => {
                    setSelected(client)
                    if (client) void loadProfile(client.clientId)
                  }}
                />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="pipeline-client-ref" className="mb-1 block text-xs text-slate-500">Client ID</label>
                    <Input
                      id="pipeline-client-ref"
                      value={manualRef}
                      placeholder="TECH-2026-000001"
                      onChange={(e) => setManualRef(e.target.value)}
                    />
                  </div>
                  <Button size="sm" className="bg-[#009FE3] text-white hover:bg-[#009FE3]/90" onClick={() => void loadProfile(manualRef)} disabled={profileLoading || !manualRef.trim()}>
                    {profileLoading ? <Loader2 className="size-4 animate-spin" /> : 'Open'}
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="The saved client profile" description="Client ID, contact details, lead source and the six histories the pipeline must keep.">
              {profileError ? (
                <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {profileError}
                </div>
              ) : null}
              {!profile && !profileError ? (
                <EmptyState title="No client selected" description="Pick a client to see the record the pipeline keeps." />
              ) : null}
              {profile ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:grid-cols-3">
                    {[
                      ['Client ID', profile.clientId],
                      ['Client name', profile.name],
                      ['Business name', profile.businessName ?? '—'],
                      ['Business type', profile.businessType ?? '—'],
                      ['Phone', profile.phone ?? '—'],
                      ['WhatsApp', profile.whatsapp ?? '—'],
                      ['Email', profile.email ?? '—'],
                      ['Lead source', profile.leadSource],
                      ['Pipeline stage', profile.pipelineStage],
                      ['Status', profile.status],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
                        <dd className="truncate text-slate-200">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <KpiCard label="Messages" value={profile.counters.messages} sub={`${profile.counters.inbound} in · ${profile.counters.outbound} out`} tone="accent" />
                    <KpiCard label="Scopes" value={profile.counters.scopes} tone="slate" />
                    <KpiCard label="Approvals" value={profile.counters.approvals} tone="amber" />
                    <KpiCard label="Payments" value={profile.counters.payments} sub={`${profile.counters.paidTotal} paid`} tone="green" />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <HistoryList title="Message history" rows={profile.messageHistory.map((row) => ({ id: row.id, at: row.at, label: `${row.direction} ${row.channel}${row.templateName ? ` · ${row.templateName}` : ''}`, detail: (row.subject ?? row.body).slice(0, 180) }))} />
                    <HistoryList title="Scope history" rows={profile.scopeHistory.map((row) => ({ id: row.id, at: row.at, label: `v${row.version} · ${row.status}${row.decision ? ` · ${row.decision}` : ''}`, detail: row.summary ?? '' }))} />
                    <HistoryList title="Approval history" rows={profile.approvalHistory.map((row) => ({ id: row.id, at: row.at, label: `${row.type} · ${row.status}`, detail: row.title }))} />
                    <HistoryList title="Payment history" rows={profile.paymentHistory.map((row) => ({ id: row.id, at: row.at, label: `${row.amount} ${row.currency} · ${row.status}${row.invoice ? ` · ${row.invoice}` : ''}`, detail: row.transactionId ?? '' }))} />
                    <HistoryList title="Delivery history" rows={profile.deliveryHistory.map((row) => ({ id: row.id, at: row.at, label: `${row.kind} · ${row.status}${row.projectCode ? ` · ${row.projectCode}` : ''}`, detail: row.passwordChangeConfirmedAt ? 'Password change confirmed' : row.clientConfirmedAt ? 'Client confirmed' : '' }))} />
                    <HistoryList title="Review history" rows={profile.reviewHistory.map((row) => ({ id: row.id, at: row.at, label: `${row.kind} · ${row.status}`, detail: row.published ? 'Published' : row.consent ? 'Consent given' : '' }))} />
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HistoryList({
  title,
  rows,
}: {
  title: string
  rows: Array<{ id: string; at: string; label: string; detail: string }>
}) {
  return (
    <div className={CARD}>
      <p className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-xs text-slate-500">Nothing recorded yet.</p>
      ) : (
        <ul className="max-h-64 overflow-auto divide-y divide-slate-800/70">
          {rows.map((row) => (
            <li key={row.id} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-slate-200">{row.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{row.at.slice(0, 10)}</span>
              </div>
              {row.detail ? <p className="truncate text-[11px] text-slate-500">{row.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
