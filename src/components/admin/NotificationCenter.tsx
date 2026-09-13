'use client'

// ============================================================
// NOTIFICATION CENTER — the real, DB-backed alert feed.
// Every item here was written by the platform itself: journey
// events, the autonomous AI-Ops loop (scoring, follow-ups,
// error triage, preview expiry), approvals and payments.
// No fabricated rows — an empty feed is an honest empty feed.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CircleAlert,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Paperclip,
  ShieldCheck,
  Star,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react'
import { api, type NotificationItem } from '@/lib/admin-client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type NotificationViewLink =
  | 'dashboard' | 'leads' | 'clients' | 'approvals' | 'communications' | 'payments'
  | 'projects' | 'reviews' | 'logs' | 'agents' | 'knowledge' | 'settings'

const TYPE_ICON: Record<string, typeof Bell> = {
  APPROVAL: ShieldCheck,
  ERROR: CircleAlert,
  LEAD: UserPlus,
  PAYMENT: Wallet,
  DELIVERY: FileText,
  SYSTEM: AlertTriangle,
  REVIEW: Star,
  REFERRAL: UserPlus,
  PREVIEW_REFRESH: FileText,
  REVIEW_PUBLISHED: Star,
  CLIENT_DOC: Paperclip,
}

const TYPE_LINK: Record<string, NotificationViewLink> = {
  APPROVAL: 'approvals',
  ERROR: 'logs',
  LEAD: 'leads',
  PAYMENT: 'payments',
  DELIVERY: 'projects',
  SYSTEM: 'dashboard',
  REVIEW: 'reviews',
  REFERRAL: 'reviews',
  PREVIEW_REFRESH: 'clients',
  REVIEW_PUBLISHED: 'reviews',
  CLIENT_DOC: 'clients',
}

const SEVERITY_DOT: Record<string, string> = {
  INFO: 'bg-[#009FE3]',
  WARNING: 'bg-amber-400',
  CRITICAL: 'bg-red-500',
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function NotificationCenter({
  onNavigate,
  className,
}: {
  onNavigate: (view: NotificationViewLink) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const everLoaded = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.notifications({ take: 20 })
      setItems(res.notifications ?? [])
      setUnread(res.unread ?? 0)
      setDismissedIds(new Set())
      everLoaded.current = true
    } catch {
      // honest failure: keep previous state, badge falls back silently
    } finally {
      setLoading(false)
    }
  }, [])

  // poll the feed every 60s while the console is open (live signals)
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 60_000)
    return () => clearInterval(t)
  }, [load])

  // reload when the panel opens so the operator always sees fresh rows
  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const visible = items.filter((n) => !dismissedIds.has(n.id))
  const critical = visible.filter((n) => n.severity === 'CRITICAL' && !n.read).length

  const handleItemClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.read) {
        try {
          await api.markNotificationRead(n.id)
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
          setUnread((u) => Math.max(0, u - 1))
        } catch {
          // non-fatal — still navigate
        }
      }
      const target = (n.link && (n.link as NotificationViewLink)) || TYPE_LINK[n.type] || 'dashboard'
      setOpen(false)
      onNavigate(target)
    },
    [onNavigate],
  )

  const handleDismiss = useCallback(
    async (e: React.MouseEvent, n: NotificationItem) => {
      e.stopPropagation()
      setDismissedIds((prev) => new Set(prev).add(n.id))
      if (!n.read) {
        try {
          await api.markNotificationRead(n.id)
          setUnread((u) => Math.max(0, u - 1))
        } catch {
          // dismissed locally regardless
        }
      }
    },
    [],
  )

  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true)
    try {
      const res = await api.markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, read: true })))
      setUnread(0)
      toast.success(`Marked ${res.updated ?? 0} notification${(res.updated ?? 0) === 1 ? '' : 's'} as read`)
    } catch {
      toast.error('Could not mark notifications as read')
    } finally {
      setMarkingAll(false)
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('relative text-slate-400 hover:text-slate-100', className)}
          aria-label={`Notifications — ${unread} unread`}
        >
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white tabular-nums"
              style={{ background: critical > 0 ? '#E11D48' : '#EF4444' }}
              aria-hidden="true"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
          {critical > 0 ? (
            <span
              className="pointer-events-none absolute inset-0 rounded-md animate-pulse"
              style={{ boxShadow: '0 0 0 2px rgba(225,29,72,0.35)' }}
              aria-hidden="true"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[340px] rounded-xl border-slate-800 bg-slate-900 p-0 text-slate-300 shadow-2xl shadow-black/40 sm:w-[380px]"
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <span className="text-[13px] font-semibold text-slate-100">Notifications</span>
          {unread > 0 ? (
            <span className="rounded-full bg-[#009FE3]/15 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#009FE3]">
              {unread} new
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkAll()}
              disabled={markingAll || unread === 0}
              className="h-7 gap-1.5 px-2 text-[11px] text-slate-400 hover:text-slate-100"
              aria-label="Mark all notifications as read"
            >
              {markingAll ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <CheckCheck className="size-3.5" aria-hidden="true" />}
              Mark all read
            </Button>
          </div>
        </div>

        {/* feed */}
        <div className="max-h-[420px] overflow-y-auto overscroll-contain [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
          {loading && !everLoaded.current ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading feed…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-800/60">
                <Info className="size-5 text-slate-500" aria-hidden="true" />
              </span>
              <p className="text-[13px] font-medium text-slate-300">No notifications</p>
              <p className="text-[11.5px] leading-relaxed text-slate-500">
                Alerts appear here when the AI workforce scores leads, retries messages, escalates approvals or detects issues.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/70" role="list">
              {visible.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                const dot = SEVERITY_DOT[n.severity] ?? SEVERITY_DOT.INFO
                return (
                  <li key={n.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => void handleItemClick(n)}
                      className={cn(
                        'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/40 focus-visible:bg-slate-800/40 focus-visible:outline-none',
                        !n.read && 'bg-[#009FE3]/[0.045]',
                      )}
                      aria-label={`${n.severity.toLowerCase()} notification: ${n.title}`}
                    >
                      {/* unread rail */}
                      {!n.read ? <span className={cn('absolute left-0 top-0 h-full w-[3px]', dot)} aria-hidden="true" /> : null}
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                          n.severity === 'CRITICAL'
                            ? 'border-red-500/25 bg-red-500/10 text-red-400'
                            : n.severity === 'WARNING'
                              ? 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                              : 'border-[#009FE3]/20 bg-[#009FE3]/10 text-[#009FE3]',
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={cn('truncate text-[12.5px] font-medium', n.read ? 'text-slate-400' : 'text-slate-100')}>
                            {n.title}
                          </span>
                          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] tabular-nums text-slate-600">{timeAgo(n.createdAt)}</span>
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">{n.body}</span>
                        ) : null}
                        <span className="mt-1 flex items-center gap-1.5">
                          <span className="rounded-sm border border-slate-700/70 bg-slate-800/60 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                            {n.type}
                          </span>
                          {!n.read ? <span className={cn('size-1.5 rounded-full', dot)} aria-label="unread" /> : null}
                        </span>
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => void handleDismiss(e, n)}
                        className="absolute right-2 top-2 hidden size-6 items-center justify-center rounded-md text-slate-600 hover:bg-slate-700/60 hover:text-slate-300 group-hover:flex"
                        aria-hidden="true"
                        title="Dismiss"
                      >
                        <X className="size-3.5" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5">
          <span className="text-[10.5px] text-slate-600">Live feed · refreshed every 60s</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              onNavigate('dashboard')
            }}
            className="h-7 px-2 text-[11px] text-[#009FE3] hover:text-[#33B8F0]"
          >
            <MessageSquare className="mr-1 size-3" aria-hidden="true" /> Open dashboard
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
