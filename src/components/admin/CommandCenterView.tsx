'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, Terminal, Zap } from 'lucide-react'

import { api, num, useApi, type DashboardResponse } from '@/lib/admin-client'
import { Markdownish } from './shared/Markdownish'
import { ACCENT, CARD, SCROLL_THIN } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  action?: string | null
  data?: unknown
}

const QUICK_COMMANDS = [
  "Show today's new leads",
  'Show clients waiting for scope approval',
  'Show unpaid projects',
  'Show failed WhatsApp messages',
  "Prepare today's CEO report",
  'Show pending approvals',
]

function DataTableFromData({ data }: { data: unknown }) {
  const rows = useMemo(() => {
    if (Array.isArray(data)) return data.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Array<Record<string, unknown>>
    return []
  }, [data])
  if (rows.length === 0) return null
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 8)
  return (
    <div className={cn('mt-2 max-h-72 overflow-auto rounded-md border border-slate-800', SCROLL_THIN)} role="table" aria-label="Command result data">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-[#0d1526]">
          <tr>
            {keys.map((k) => (
              <th key={k} className="whitespace-nowrap px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className="border-t border-slate-800/60">
              {keys.map((k) => (
                <td key={k} className="max-w-[180px] truncate whitespace-nowrap px-2.5 py-1.5 text-slate-400">
                  {r[k] === null || r[k] === undefined ? '—' : String(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataPayload({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null
  if (Array.isArray(data)) {
    const objects = data.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) as Array<Record<string, unknown>>
    if (objects.length > 0) return <DataTableFromData data={data} />
    return (
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-400">
        {data.slice(0, 30).map((v, i) => (
          <li key={i}>{String(v)}</li>
        ))}
      </ul>
    )
  }
  if (typeof data === 'object') {
    return (
      <div className="mt-2">
        <MarkdownishTable data={data as Record<string, unknown>} />
      </div>
    )
  }
  return <p className="mt-2 font-mono text-xs text-slate-400">{String(data)}</p>
}

function MarkdownishTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).slice(0, 12)
  return (
    <div className="overflow-hidden rounded-md border border-slate-800" role="table" aria-label="Command result data">
      <table className="w-full text-left text-xs">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-800/60 last:border-0">
              <th className="w-40 bg-[#0d1526] px-2.5 py-1.5 align-top text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {k}
              </th>
              <td className="max-w-[320px] px-2.5 py-1.5 text-slate-400">
                {v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CommandCenterView() {
  const [sessionId] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sess-${Date.now()}`))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seededRef = useRef(false)

  const { data: dash, error: dashError } = useApi<DashboardResponse>('/api/admin/dashboard')

  useEffect(() => {
    if (seededRef.current) return
    if (!dash && !dashError) return
    seededRef.current = true
    const s = dash?.stats
    const text = dash
      ? [
          '**Command Center online.** Ask anything about the platform in plain language — answers and actions are executed against live data.',
          '',
          `Live context: **${num(s?.totalLeads)}** total leads · **${num(s?.activeProjects)}** active projects · **${num(s?.pendingAdminApprovals)}** approvals awaiting you · **${num(s?.unreadCommunications)}** unread messages · **${num(s?.failedAutomations)}** failed automations.`,
        ].join('\n')
      : '**Command Center online**, but live context could not be loaded from the dashboard API. You can still issue commands — results will come from the backend.'
    setMessages([{ role: 'assistant', text }])
  }, [dash, dashError])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setMessages((m) => [...m, { role: 'user', text: message }])
    setInput('')
    setSending(true)
    try {
      const res = await api.command(sessionId, message)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: res.reply ?? '(no reply returned)',
          action: res.action ?? null,
          data: res.data ?? null,
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Command failed: ${err instanceof Error ? err.message : 'unknown error'}` },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[480px] flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-100">
            <Terminal className="size-5 text-[#009FE3]" aria-hidden="true" />
            NL Command Console
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-mono text-[10px] text-slate-600">session {sessionId.slice(0, 8)}…</span>
            The Oracle agent translates your words into real queries and actions.
          </p>
        </div>
      </div>

      {/* messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Command conversation"
        aria-live="polite"
        className={cn('flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-4', SCROLL_THIN)}
      >
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg border px-3.5 py-2.5',
                m.role === 'user'
                  ? 'border-[#009FE3]/40 bg-[#009FE3]/15 text-slate-100'
                  : 'border-slate-800 bg-slate-900/80 text-slate-300',
              )}
            >
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap text-sm">{m.text}</p>
              ) : (
                <>
                  <Markdownish text={m.text} />
                  {m.action ? (
                    <p className="mt-2 inline-flex items-center gap-1 rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[10px] text-[#009FE3]">
                      <Zap className="size-3" aria-hidden="true" /> {m.action}
                    </p>
                  ) : null}
                  <DataPayload data={m.data} />
                </>
              )}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className={cn(CARD, 'flex items-center gap-2 rounded-lg px-3.5 py-2.5')}>
              <Loader2 className="size-4 animate-spin text-[#009FE3]" aria-hidden="true" />
              <span className="text-xs text-slate-500">Oracle is thinking…</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* quick commands */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick commands">
        {QUICK_COMMANDS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending}
            onClick={() => void send(q)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:border-[#009FE3]/50 hover:bg-[#009FE3]/10 hover:text-[#009FE3] disabled:opacity-40"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            {q}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="mt-3 flex items-end gap-2"
      >
        <label htmlFor="command-input" className="sr-only">
          Command input
        </label>
        <textarea
          id="command-input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          placeholder="e.g. show all clients waiting for payment…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
        />
        <Button type="submit" disabled={sending || !input.trim()} className="h-11 px-5 font-semibold" style={{ background: ACCENT }}>
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          <span className="sr-only sm:not-sr-only">Run</span>
        </Button>
      </form>
      <p className="mt-2 text-[10px] text-slate-700">
        Commands are executed server-side against live data. Enter sends · Shift+Enter for a new line.
      </p>
    </div>
  )
}
