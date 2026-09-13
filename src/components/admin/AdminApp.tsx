'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Bot,
  BookOpen,
  Building2,
  Clapperboard,
  ExternalLink,
  FileBarChart,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Newspaper,
  Radar,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Terminal,
  UserPlus,
  Wallet,
  Workflow,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { api, num, useApi, type AdminUser, type DashboardResponse } from '@/lib/admin-client'
import { ChangePasswordScreen } from './ChangePasswordScreen'
import { LoginScreen } from './LoginScreen'
import { NotificationCenter } from './NotificationCenter'
import { AgentsView } from './AgentsView'
import { AnalyticsView } from './AnalyticsView'
import { ApprovalsView } from './ApprovalsView'
import { BlogStudioView } from './BlogStudioView'
import { ClientDetailView } from './ClientDetailView'
import { CommandCenterView } from './CommandCenterView'
import { CommunicationsView } from './CommunicationsView'
import { ContentStudioView } from './ContentStudioView'
import { DashboardView } from './DashboardView'
import { KnowledgeView } from './KnowledgeView'
import { LeadsView } from './LeadsView'
import { LogsView } from './LogsView'
import { MemoryView } from './MemoryView'
import { N8nView } from './N8nView'
import { OpsView } from './OpsView'
import { PaymentsView } from './PaymentsView'
import { ProjectDetailView, ProjectsView } from './ProjectsView'
import { ReportsView } from './ReportsView'
import { ReviewsView } from './ReviewsView'
import { SettingsView } from './SettingsView'
import { ACCENT } from './shared/styles'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ViewId =
  | 'dashboard' | 'ops' | 'leads' | 'clients' | 'approvals' | 'communications'
  | 'payments' | 'projects' | 'reviews' | 'agents' | 'command' | 'memory'
  | 'knowledge' | 'content' | 'blog' | 'analytics' | 'logs' | 'n8n' | 'reports' | 'settings'

interface NavItem {
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'ops', label: 'Ops Monitor', icon: Radar },
    ],
  },
  {
    section: 'CRM',
    items: [
      { id: 'leads', label: 'Leads', icon: UserPlus },
      { id: 'clients', label: 'Clients', icon: Building2 },
      { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
      { id: 'communications', label: 'Communications', icon: MessageSquare },
    ],
  },
  {
    section: 'Finance & Delivery',
    items: [
      { id: 'payments', label: 'Payments', icon: Wallet },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    section: 'Growth',
    items: [
      { id: 'reviews', label: 'Reviews & Referrals', icon: Star },
      { id: 'blog', label: 'Blog Studio', icon: Newspaper },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { id: 'agents', label: 'AI Workforce', icon: Bot },
      { id: 'command', label: 'Command Center', icon: Terminal },
      { id: 'memory', label: 'AI Memory', icon: BookOpen },
      { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
      { id: 'content', label: 'Content Studio', icon: Clapperboard },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'logs', label: 'Logs', icon: ScrollText },
      { id: 'n8n', label: 'n8n Workflows', icon: Workflow },
      { id: 'reports', label: 'Reports', icon: FileBarChart },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const VIEW_TITLES: Record<ViewId, string> = {
  dashboard: 'Dashboard',
  ops: 'Ops Monitor',
  leads: 'Leads',
  clients: 'Clients',
  approvals: 'Approvals',
  communications: 'Communications',
  payments: 'Payments',
  projects: 'Projects',
  reviews: 'Reviews & Referrals',
  agents: 'AI Workforce',
  command: 'Command Center',
  memory: 'AI Memory',
  knowledge: 'Knowledge Base',
  content: 'Content Studio',
  blog: 'Blog Studio',
  analytics: 'Analytics',
  logs: 'Logs',
  n8n: 'n8n Workflows',
  reports: 'Reports',
  settings: 'Settings',
}

export default function AdminApp({ onExit }: { onExit: () => void }) {
  const [me, setMe] = useState<AdminUser | null | undefined>(undefined) // undefined = checking
  const [meTick, setMeTick] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

  const [view, setView] = useState<ViewId>('dashboard')
  const [clientId, setClientId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  const viewTitleRef = useRef<HTMLDivElement>(null)

  // force dark palette for the console subtree (including portaled dialogs)
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    if (!hadDark) root.classList.add('dark')
    return () => {
      if (!hadDark) root.classList.remove('dark')
    }
  }, [])

  // auth bootstrap
  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((r) => {
        if (!cancelled) setMe(r.user ?? null)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [meTick])

  const refreshMe = useCallback(() => setMeTick((t) => t + 1), [])

  // topbar live counters (bell)
  const authed = me != null && me.mustChangePassword !== true
  const { data: dash } = useApi<DashboardResponse>(authed ? '/api/admin/dashboard' : null)
  const unread = num(dash?.stats?.unreadCommunications)
  const pendingApprovals = num(dash?.stats?.pendingAdminApprovals)
  const failedAutomations = num(dash?.stats?.failedAutomations)

  const navigate = useCallback((v: ViewId) => {
    setView(v)
    setClientId(null)
    setProjectId(null)
    setNavOpen(false)
    viewTitleRef.current?.focus()
  }, [])

  const openClient = useCallback((id: string) => {
    setClientId(id)
    setProjectId(null)
  }, [])

  const openProject = useCallback((id: string) => {
    setProjectId(id)
  }, [])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchInput)
    setView('clients')
    setClientId(null)
    setProjectId(null)
  }

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await api.logout()
      toast.success('Signed out.')
    } catch {
      toast.error('Logout request failed — session may still be active.')
    } finally {
      setLoggingOut(false)
      setMe(null)
      setView('dashboard')
      setClientId(null)
      setProjectId(null)
    }
  }

  const viewKey = useMemo(() => `${view}:${clientId ?? ''}:${projectId ?? ''}`, [view, clientId, projectId])

  // ---------------- auth states ----------------
  if (me === undefined) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center" style={{ background: '#0B1220' }} role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-[#009FE3]" aria-hidden="true" />
          <p className="text-sm text-slate-500">Verifying session…</p>
        </div>
      </div>
    )
  }

  if (me === null) {
    return (
      <LoginScreen
        onExit={onExit}
        onLoggedIn={() => {
          setMe(undefined)
          refreshMe()
        }}
      />
    )
  }

  if (me.mustChangePassword) {
    return <ChangePasswordScreen email={me.email} onDone={() => { setMe(undefined); refreshMe() }} onExit={onExit} />
  }

  // ---------------- console ----------------
  const navContent = (
    <nav aria-label="Admin navigation" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{group.section}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = view === item.id && !clientId && !projectId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/50',
                      active
                        ? 'bg-[#009FE3]/15 text-[#009FE3]'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {item.label}
                    {item.id === 'approvals' && pendingApprovals > 0 ? (
                      <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                        {pendingApprovals}
                      </span>
                    ) : item.id === 'communications' && unread > 0 ? (
                      <span className="ml-auto rounded-full bg-[#009FE3]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#009FE3]">
                        {unread}
                      </span>
                    ) : item.id === 'logs' && failedAutomations > 0 ? (
                      <span className="ml-auto rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        {failedAutomations}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const brandHeader = (
    <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3.5">
      <img src="/images/tech360-logo-web.png" alt="Tech360 LLC logo" className="h-7 w-auto" width={70} height={28} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-bold text-slate-100">Command Center</p>
        <p className="text-[10px] text-slate-500">Super Admin Console</p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen w-full" style={{ background: '#0B1220' }}>
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800 bg-[#0d1526] lg:flex">
        {brandHeader}
        {navContent}
        <div className="border-t border-slate-800 px-4 py-3">
          <p className="truncate text-[11px] text-slate-500">{me.email}</p>
          <p className="text-[10px] text-slate-500">{me.role ?? 'ADMIN'} · bdtech360.com</p>
        </div>
      </aside>

      {/* mobile sidebar */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 border-slate-800 bg-[#0d1526] p-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex h-full flex-col">
            {brandHeader}
            {navContent}
            <div className="border-t border-slate-800 px-4 py-3">
              <p className="truncate text-[11px] text-slate-500">{me.email}</p>
              <p className="text-[10px] text-slate-500">{me.role ?? 'ADMIN'} · bdtech360.com</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* main column */}
      <div className="flex min-h-screen w-full flex-col lg:pl-60">
        {/* topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-800 bg-[#0d1526]/95 px-3 backdrop-blur sm:px-4" role="banner">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNavOpen(true)}
            className="text-slate-400 hover:text-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>

          <div ref={viewTitleRef} tabIndex={-1} className="min-w-0 outline-none" aria-label={VIEW_TITLES[view]}>
            <AnimatePresence mode="wait">
              <motion.p
                key={view}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="truncate text-sm font-semibold text-slate-200"
              >
                {clientId ? 'Client Detail' : projectId ? 'Project Detail' : VIEW_TITLES[view]}
              </motion.p>
            </AnimatePresence>
          </div>

          <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 flex-1 max-w-xs items-center md:flex" role="search" aria-label="Search clients">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search clients… (Enter)"
                aria-label="Search clients"
                className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <NotificationCenter onNavigate={navigate} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2 text-slate-300 hover:text-slate-100" aria-label="User menu">
                  <span
                    className="flex size-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-bold text-[#009FE3]"
                    aria-hidden="true"
                  >
                    {(me.name ?? me.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[140px] truncate text-[13px] font-medium sm:inline">{me.name ?? me.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-slate-800 bg-slate-900 text-slate-300">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-[13px] text-slate-200">{me.name ?? 'Administrator'}</p>
                  <p className="truncate text-[11px] text-slate-500">{me.email}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-600">{me.role ?? 'ADMIN'}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem onClick={onExit} className="gap-2 text-[13px]">
                  <ExternalLink className="size-3.5" aria-hidden="true" /> Back to website
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  className="gap-2 text-[13px] text-red-400 focus:text-red-300"
                >
                  {loggingOut ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="size-3.5" aria-hidden="true" />}
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* content */}
        <main className="flex-1 px-3 py-4 sm:px-4 lg:px-6 lg:py-6" role="main">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {clientId ? (
                <ClientDetailView
                  clientId={clientId}
                  onBack={() => setClientId(null)}
                  onOpenProject={openProject}
                />
              ) : projectId ? (
                <ProjectDetailView projectId={projectId} onBack={() => setProjectId(null)} />
              ) : view === 'dashboard' ? (
                <DashboardView onOpenClient={openClient} />
              ) : view === 'ops' ? (
                <OpsView />
              ) : view === 'leads' ? (
                <LeadsView mode="leads" onOpenClient={openClient} />
              ) : view === 'clients' ? (
                <LeadsView key={searchQuery} mode="clients" onOpenClient={openClient} initialQuery={searchQuery} />
              ) : view === 'approvals' ? (
                <ApprovalsView />
              ) : view === 'communications' ? (
                <CommunicationsView />
              ) : view === 'payments' ? (
                <PaymentsView onOpenClient={openClient} />
              ) : view === 'projects' ? (
                <ProjectsView onOpenProject={openProject} />
              ) : view === 'reviews' ? (
                <ReviewsView />
              ) : view === 'agents' ? (
                <AgentsView />
              ) : view === 'command' ? (
                <CommandCenterView />
              ) : view === 'memory' ? (
                <MemoryView />
              ) : view === 'knowledge' ? (
                <KnowledgeView />
              ) : view === 'content' ? (
                <ContentStudioView />
              ) : view === 'blog' ? (
                <BlogStudioView />
              ) : view === 'analytics' ? (
                <AnalyticsView />
              ) : view === 'logs' ? (
                <LogsView />
              ) : view === 'n8n' ? (
                <N8nView />
              ) : view === 'reports' ? (
                <ReportsView />
              ) : (
                <SettingsView />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-slate-800/60 px-4 py-3">
          <p className="text-center text-[10px] text-slate-500">
            TECH360 LLC · Super Admin Command Center · authorized personnel only · all actions are audited
          </p>
        </footer>
      </div>
    </div>
  )
}