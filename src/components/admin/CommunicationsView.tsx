'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from 'lucide-react'

import {
  api,
  fmtDate,
  prettify,
  useApi,
  type ClientRow,
  type CommSendResponse,
  type CommunicationRecord,
  type CommunicationsResponse,
} from '@/lib/admin-client'
import { DataTable } from './shared/DataTable'
import { EmptyState, PageHeader, SectionCard } from './shared/cards'
import { ClientPicker, Pager } from './shared/Pager'
import { StatusBadge } from './shared/StatusBadge'
import { ACCENT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'WEB', 'PORTAL'] as const
const STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'RECEIVED', 'FAILED', 'NOT_CONFIGURED'] as const
const PAGE_SIZE = 20

function ChannelChip({ name, state }: { name: string; state: string }) {
  const s = (state ?? '').toUpperCase()
  const cls =
    s === 'CONFIGURED'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : s === 'FAILED'
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
  const note =
    s === 'CONFIGURED'
      ? 'Credentials are set — sends go through the real provider.'
      : s === 'FAILED'
        ? 'Provider reported a failure — check error details in the table.'
        : 'Not configured — set env credentials to enable this channel.'
  return (
    <span
      title={note}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${cls}`}
    >
      {s === 'CONFIGURED' ? (
        <CheckCircle2 className="size-3" aria-hidden="true" />
      ) : (
        <AlertTriangle className="size-3" aria-hidden="true" />
      )}
      {prettify(name)}
      <span className="opacity-70">·</span>
      {s === 'CONFIGURED' ? 'Configured' : s === 'FAILED' ? 'Failed' : 'Not Configured'}
    </span>
  )
}

export function CommunicationsView() {
  const [channel, setChannel] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (channel !== 'ALL') p.set('channel', channel)
    if (status !== 'ALL') p.set('status', status)
    p.set('page', String(page))
    return `/api/admin/communications?${p.toString()}`
  }, [channel, status, page])
  const { data, loading, error, refresh } = useApi<CommunicationsResponse>(url)
  const comms = data?.comms ?? []
  const channelsStatus = data?.channelsStatus ?? {}

  // manual send form
  const [client, setClient] = useState<ClientRow | null>(null)
  const [sendChannel, setSendChannel] = useState('WHATSAPP')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendResult, setSendResult] = useState<CommSendResponse | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    setSendResult(null)
    setSendError(null)
  }, [client, sendChannel, subject, body])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (sendBusy) return
    if (!client) {
      toast.error('Select a client first.')
      return
    }
    if (!body.trim()) {
      toast.error('Message body is required.')
      return
    }
    setSendBusy(true)
    setSendResult(null)
    setSendError(null)
    try {
      const res = await api.sendCommunication({
        clientId: client.id,
        channel: sendChannel,
        subject: subject.trim() || undefined,
        body: body.trim(),
      })
      setSendResult(res)
      const st = (res.status ?? '').toUpperCase()
      if (res.ok && (st === 'SENT' || st === 'DELIVERED' || st === 'QUEUED')) toast.success(`Message ${st.toLowerCase()} via ${prettify(sendChannel)}.`)
      else if (st === 'NOT_CONFIGURED') toast.warning(`${prettify(sendChannel)} is not configured — set env credentials.`)
      else toast.error(`Send status: ${st || 'UNKNOWN'}${res.error ? ` — ${res.error}` : ''}`)
      refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed.'
      setSendError(msg)
      toast.error(msg)
    } finally {
      setSendBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Communications"
        description="Every outbound and inbound message across channels. Provider statuses are shown exactly as returned — nothing is assumed sent."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            aria-label="Refresh communications"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {/* channel configuration banner */}
      <SectionCard
        title="Channel Configuration"
        description="Live provider configuration state — channels without credentials cannot send and will report NOT_CONFIGURED."
        className="mb-4"
      >
        {loading && !data ? (
          <div className="flex flex-wrap gap-2">
            {CHANNELS.slice(0, 5).map((c) => (
              <span key={c} className="h-7 w-36 animate-pulse rounded-md bg-slate-800/70" />
            ))}
          </div>
        ) : Object.keys(channelsStatus).length === 0 ? (
          <p className="text-xs text-slate-500">Channel status is reported by the API once available.</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Channel configuration statuses">
            {Object.entries(channelsStatus).map(([name, state]) => (
              <ChannelChip key={name} name={name} state={String(state)} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* filters */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div>
          <label htmlFor="comm-channel" className="sr-only">Filter by channel</label>
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1) }}>
            <SelectTrigger id="comm-channel" className="h-9 w-full border-slate-800 bg-slate-950/60 text-slate-200 sm:w-[170px]">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All channels</SelectItem>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{prettify(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="comm-status" className="sr-only">Filter by status</label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger id="comm-status" className="h-9 w-full border-slate-800 bg-slate-950/60 text-slate-200 sm:w-[170px]">
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
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load communications: {error}
        </div>
      ) : null}

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
            key: 'msg',
            header: 'Message',
            className: 'max-w-[320px]',
            cell: (c) => (
              <div className="min-w-0">
                {c.subject ? <p className="truncate text-xs font-medium text-slate-300">{c.subject}</p> : null}
                <p className="truncate text-xs text-slate-500">{c.body || '—'}</p>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (c) => <StatusBadge status={c.status} title={c.error ?? undefined} />,
          },
          { key: 'provider', header: 'Provider ID', cell: (c) => <span className="font-mono text-[11px] text-slate-600">{c.providerMessageId || '—'}</span> },
          { key: 'error', header: 'Error', cell: (c) => (c.error ? <span className="max-w-[160px] truncate text-xs text-red-400/80" title={c.error}>{c.error}</span> : <span className="text-slate-700">—</span>) },
          { key: 'date', header: 'Date', cell: (c) => <span className="text-xs text-slate-500">{fmtDate(c.sentAt ?? c.createdAt)}</span> },
        ]}
        rows={comms}
        loading={loading}
        rowKey={(c: CommunicationRecord) => c.id}
        empty={<EmptyState icon={MessageSquare} title="No messages found" description="Messages will appear here once any channel sends or receives traffic — adjust filters if needed." />}
        aria-label="Communications table"
      />
      <Pager page={page} total={data?.total ?? comms.length} pageSize={PAGE_SIZE} onPage={setPage} loading={loading} unit="messages" />

      {/* manual send */}
      <SectionCard
        title="Manual Send"
        description="Compose a message to a client — the result below is the provider's real response."
        className="mt-4"
      >
        <form onSubmit={send} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ClientPicker value={client} onChange={setClient} label="Client" />
          <div className="space-y-1.5">
            <label htmlFor="send-channel" className="text-xs font-medium text-slate-400">Channel</label>
            <Select value={sendChannel} onValueChange={setSendChannel}>
              <SelectTrigger id="send-channel" className="h-9 border-slate-800 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{prettify(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="send-subject" className="text-xs text-slate-400">Subject (email only, optional)</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Optional subject line"
              className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="send-body" className="text-xs text-slate-400">Message body</Label>
            <Textarea
              id="send-body"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message…"
              className="border-slate-800 bg-slate-950/60 text-sm text-slate-200"
            />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" disabled={sendBusy || !client} className="font-semibold" style={{ background: ACCENT }}>
              {sendBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              Send Message
            </Button>
          </div>
        </form>

        {sendResult ? (
          <div role="status" className="mt-3">
            <SendResultLine res={sendResult} />
          </div>
        ) : null}
        {sendError ? (
          <div role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {sendError}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

function SendResultLine({ res }: { res: CommSendResponse }) {
  const st = (res.status ?? 'UNKNOWN').toUpperCase()
  const cls =
    st === 'SENT' || st === 'DELIVERED'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : st === 'NOT_CONFIGURED'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-red-500/30 bg-red-500/10 text-red-400'
  return (
    <div className={`rounded-md border p-3 text-sm ${cls}`}>
      <p className="font-medium">
        Send status: {prettify(st)} {res.ok ? '' : '(not sent)'}
      </p>
      {res.error ? <p className="mt-1 text-xs opacity-80">{res.error}</p> : null}
      {st === 'NOT_CONFIGURED' ? (
        <p className="mt-1 text-xs opacity-80">This channel is not configured — set the provider credentials in the server environment.</p>
      ) : null}
      {res.message ? <p className="mt-1 text-xs opacity-80">{res.message}</p> : null}
    </div>
  )
}
