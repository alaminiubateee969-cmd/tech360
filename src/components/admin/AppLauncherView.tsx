'use client'

/**
 * TECH360 — Private Super Admin App Launcher.
 *
 * Odoo-inspired application grid inside the Super Admin console. Every
 * application shows its real implementation status (`live` only when a
 * backend route or admin view is wired; otherwise `planned` /
 * `in-development` / `not-configured`). Nothing is a decorative stub:
 * live applications open a real console view; everything else reports
 * its honest status.
 *
 * Access: SUPER_ADMIN only (enforced by the view policy and every API).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Star,
  Star as StarFill,
  Clock,
  LayoutGrid,
  ChevronRight,
  Building2,
  Wallet,
  CreditCard,
  ShoppingCart,
  Repeat,
  Users,
  FolderKanban,
  ListChecks,
  MapPin,
  Box,
  Factory,
  MessagesSquare,
  Mail,
  Bell,
  Smartphone,
  FileText,
  Signature,
  BookOpen,
  ShoppingBag,
  Globe,
  User,
  Bot,
  Network,
  Workflow,
  Layers,
  Building,
  Copy,
  Rocket,
  Activity,
  DatabaseBackup,
  Settings,
  Package,
} from 'lucide-react'
import { fetchJson } from '@/lib/admin-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { AdminViewId } from '@/lib/admin-view-policy'

type App = {
  id: string
  label: string
  category: string
  description: string
  icon: string
  navigateTo: string | null
  status: 'live' | 'in-development' | 'planned' | 'not-configured'
  access: string
}

type CategoryColor = {
  bg: string
  text: string
  border: string
}

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  Business: { bg: 'bg-[#009FE3]/10', text: 'text-[#009FE3]', border: 'border-[#009FE3]/20' },
  Operations: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  Communication: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  Documents: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  Commerce: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  People: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  Intelligence: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
  Factory: { bg: 'bg-[#009FE3]/10', text: 'text-[#009FE3]', border: 'border-[#009FE3]/20' },
}

const STATUS_CONFIG: Record<string, { label: string; tone: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  live: { label: 'Live', tone: 'success' },
  'in-development': { label: 'In development', tone: 'warning' },
  planned: { label: 'Planned', tone: 'secondary' },
  'not-configured': { label: 'Not configured', tone: 'destructive' },
}

type LauncherMode = 'all' | 'categories' | 'recent' | 'favorites'

const MODES: Array<[LauncherMode, string]> = [
  ['all', 'All applications'],
  ['categories', 'By category'],
  ['recent', 'Recently used'],
  ['favorites', 'Favorites'],
]

function badgeVariant(statusTone: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (statusTone === 'success') return 'default'
  if (statusTone === 'destructive') return 'destructive'
  return 'secondary'
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid, Building2, Wallet, CreditCard, ShoppingCart, Repeat, Users,
  FolderKanban, ListChecks, Clock, MapPin, Box, Factory, MessagesSquare,
  Mail, Bell, Smartphone, FileText, Signature, BookOpen, ShoppingBag,
  Globe, User, Bot, Network, Workflow, Settings, Layers, Building, Copy,
  Package, Rocket, Activity, DatabaseBackup, ChevronRight, Star, StarFill,
  Search,
}

function IconByName(props: { name: string; className?: string }) {
  const Icon = ICONS[props.name]
  return Icon ? <Icon className={props.className} /> : <LayoutGrid className={props.className} />
}

export interface AppLauncherViewProps {
  onNavigate: (viewId: AdminViewId) => void
}

export function AppLauncherView({ onNavigate }: AppLauncherViewProps) {
  const [apps, setApps] = useState<App[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recent, setRecent] = useState<Array<{ appId: string; at: string }>>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [mode, setMode] = useState<'all' | 'categories' | 'recent' | 'favorites'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const categoriesRef = useRef<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catalog, fav, rec] = await Promise.all([
        fetchJson<{ apps: App[]; categories: string[] }>('/api/admin/app-launcher/catalog'),
        fetchJson<{ favorites: string[] }>('/api/admin/app-launcher/favorites'),
        fetchJson<{ recent: Array<{ appId: string; at: string }> }>('/api/admin/app-launcher/recent'),
      ])
      setApps(catalog.apps)
      categoriesRef.current = catalog.categories
      setFavorites(new Set(fav.favorites))
      setRecent(rec.recent)
      setError(null)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load the app catalog'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleFavorite = useCallback(async (appId: string, currently: boolean) => {
    try {
      const updated = await fetchJson<{ favorites: string[] }>(
        '/api/admin/app-launcher/favorites',
        { method: 'POST', body: { appId, add: !currently } },
      )
      setFavorites(new Set(updated.favorites))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not update favorite')
    }
  }, [])

  const launch = useCallback(async (app: App) => {
    try {
      await fetchJson('/api/admin/app-launcher/recent', {
        method: 'POST',
        body: { appId: app.id },
      })
    } catch {
      // Best-effort telemetry: a failed recent entry must never block launch.
    }
    if (!app.navigateTo) {
      toast.error(`"${app.label}" is not yet connected to a live implementation (${STATUS_CONFIG[app.status].label}).`)
      return
    }
    onNavigate(app.navigateTo as AdminViewId)
  }, [onNavigate])

  const allCategories = useMemo(() => ['All', ...categoriesRef.current], [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    const byCategory = category === 'All' ? apps : apps.filter((a) => a.category === category)
    const byQuery = byCategory.filter((a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    if (mode === 'favorites') return byQuery.filter((a) => favorites.has(a.id))
    if (mode === 'recent') {
      const recentIds = new Set(recent.map((r) => r.appId))
      return byQuery.filter((a) => recentIds.has(a.id)).sort(
        (a, b) => recent.findIndex((r) => r.appId === b.id) - recent.findIndex((r) => r.appId === a.id),
      )
    }
    return byQuery
  }, [apps, query, category, mode, favorites, recent])

  const recentApps = useMemo(() => {
    const recentIds = recent.map((r) => r.appId)
    const seen = new Set<string>()
    const ordered: App[] = []
    for (const id of recentIds) {
      const app = apps.find((a) => a.id === id)
      if (app && !seen.has(id)) { seen.add(id); ordered.push(app) }
    }
    return ordered
  }, [apps, recent])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2"><LayoutGrid className="size-6 animate-spin text-slate-400" /><p className="text-xs text-slate-500">Loading app catalog…</p></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">App Launcher</h2>
          <p className="text-xs text-slate-400">Company OS &amp; Software Factory — private Super Admin workspace. Application status reflects real implementation state.</p>
        </div>
        <div className="flex items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search applications…"
              className="h-9 pl-9 text-sm"
            />
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <p className="font-semibold">Catalog unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Category navigation */}
        <nav aria-label="Application categories" className="hidden lg:flex lg:w-64 lg:flex-col lg:gap-1">
          {[{ id: 'all', label: 'All' }, ...allCategories.map((c) => ({ id: c, label: c }))].map((c) => {
            const active = category === c.id
            return (
              <button
                key={c.id}
                onClick={() => { setMode('all'); setCategory(c.id) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors border',
                  active ? 'bg-[#009FE3]/10 border-[#009FE3]/40 text-[#009FE3]' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                )}
              >
                <span className={cn(CATEGORY_COLORS[c.id]?.bg ?? 'bg-slate-800/50', CATEGORY_COLORS[c.id]?.text ?? 'text-slate-300', 'rounded px-1.5 py-0.5 text-[10px]')}>{c.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {/* Modes */}
          <div className="flex flex-wrap items-center gap-2 mb-3 border-b border-slate-800/60 pb-2">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setCategory('All') }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors border',
                  mode === m ? 'bg-[#009FE3]/10 border-[#009FE3]/40 text-[#009FE3]' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'categories' ? (
            <div className="space-y-4">
              {allCategories.map((cat) => {
                const catApps = filtered.filter((a) => a.category === cat)
                if (!catApps.length) return null
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{cat}</h3>
                      <span className="ml-auto text-[10px] text-slate-500">{catApps.length}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {catApps.map((app) => <AppCard key={app.id} app={app} favorites={favorites} onToggleFavorite={toggleFavorite} onLaunch={launch} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className={cn(
              'grid gap-3',
              filtered.length === 0 ? '' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            )}>
              {filtered.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
                  <Clock className="size-8 mx-auto text-slate-600" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-medium text-slate-200">No applications found</h3>
                  <p className="mt-1 text-xs text-slate-500">Try a different search or category.</p>
                </div>
              ) : (
                filtered.map((app) => <AppCard key={app.id} app={app} favorites={favorites} onToggleFavorite={toggleFavorite} onLaunch={launch} />)
              )}
            </div>
          )}

          {mode === 'all' && recentApps.length > 0 && filtered.length > 0 && (
            <section className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recently used</h3>
                <Button variant="ghost" size="sm" onClick={() => setMode('recent')}>
                  View all <ChevronRight className="size-3 ml-1" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex gap-3 overflow-x-auto px-1 -mx-1 scrollbar-hide sm:overflow-visible sm:px-0 sm:mx-0">
                {recentApps.slice(0, 6).map((app) => {
                  const ring = favorites.has(app.id) ? 'border-[#009FE3]/40' : ''
                  return (
                    <button
                      key={app.id}
                      onClick={() => launch(app)}
                      className={cn('flex shrink-0 flex-col items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left', ring)}
                    >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/60">
                      <IconByName name={app.icon} className="size-4 text-slate-300" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-200 truncate max-w-[100px]">{app.label}</span>
                    <Badge variant={badgeVariant(STATUS_CONFIG[app.status].tone)} className="text-[10px]">
                      {STATUS_CONFIG[app.status].label}
                    </Badge>
                  </button>
                );
              })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

interface AppCardProps {
  app: App
  favorites: Set<string>
  onToggleFavorite: (appId: string, currently: boolean) => void
  onLaunch: (app: App) => void
}

function AppCard({ app, favorites, onToggleFavorite, onLaunch }: AppCardProps) {
  const color = CATEGORY_COLORS[app.category] ?? CATEGORY_COLORS.Intelligence
  const status = STATUS_CONFIG[app.status]
  const isFavorite = favorites.has(app.id)
  const live = app.status === 'live'

  return (
    <Card className="rounded-xl border border-slate-800 bg-slate-900/70 hover:border-[#009FE3]/40 hover:bg-slate-900/90 transition-colors group">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color.bg)}>
          <IconByName name={app.icon} className="size-4" />
        </div>
        <button
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(app.id, isFavorite) }}
          className={cn('rounded-md p-1 text-slate-500 hover:text-[#009FE3] transition-colors', isFavorite ? 'text-[#009FE3]' : '')}
        >
          {isFavorite ? <StarFill className="size-4 text-[#009FE3]" /> : <Star className="size-4" />}
        </button>
      </CardHeader>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{app.category}</span>
          <Badge variant={badgeVariant(status.tone)} className="text-[10px]">
            {status.label}
          </Badge>
        </div>
        <CardTitle className="text-sm font-medium text-slate-100 leading-tight">{app.label}</CardTitle>
        <CardDescription className="text-[11px] text-slate-500">{app.description}</CardDescription>
      </CardContent>
      <CardFooter className="p-3 border-t border-slate-800/50">
        <Button
          onClick={(e) => { e.stopPropagation(); onLaunch(app) }}
          disabled={!live}
          className="w-full text-xs"
          variant={live ? 'default' : 'ghost'}
        >
          {live ? 'Open' : 'Status'}
        </Button>
      </CardFooter>
    </Card>
  )
}
