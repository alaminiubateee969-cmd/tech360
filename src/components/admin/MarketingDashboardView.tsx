'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, KeyRound, Megaphone, RefreshCw, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fetchJson } from '@/lib/admin-client'
import { PageHeader, SectionCard } from './shared/cards'
import { INPUT } from './shared/styles'
import { MarketingPostGrid, type ReviewGridReview } from './MarketingPostGrid'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Marketing Dashboard (Super Admin / Admin): type an idea ->
// platform drafts + image prompt + video plan -> approve ->
// publish through official APIs. Accounts connect with OAuth/API
// tokens on the host — never passwords — so posting survives
// password changes. Nothing publishes without approval, and a
// post is only "PUBLISHED" when the platform returns an ID.

interface PlatformStatus {
  platform: string; label: string; state: string; missingEnv: string[]; developerPortal: string
  permissions: string[]; setupSteps: string[]; postingNotes: string; lastVerifiedAt: string | null; lastError: string | null
}
interface SocialPost {
  id: string; platform: string; text: string; status: string; mediaUrl: string | null
  mediaPrompt: string | null; externalUrl: string | null; error: string | null; createdAt: string
}
interface Overview { platforms: PlatformStatus[]; posts: SocialPost[]; reviews?: ReviewGridReview[]; oauthNote: string }
interface GenerateResponse { ok: boolean; enhanced: boolean; plan: { headline: string; imagePrompt: string; videoPlan: { hook: string; shots: string[] } }; posts: SocialPost[] }

const ALL_PLATFORMS = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'YOUTUBE', 'TIKTOK']
const STATUS_STYLE: Record<string, string> = {
  CONNECTED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  PARTIAL: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  NOT_CONFIGURED: 'border-slate-700 bg-slate-800/40 text-slate-400',
  ERROR: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  PUBLISHED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  APPROVED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  DRAFT: 'border-slate-700 bg-slate-800/40 text-slate-300',
  FAILED: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
}
const chip = (s: string) => cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[s] ?? STATUS_STYLE.DRAFT)

export function MarketingDashboardView() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [idea, setIdea] = useState('')
  const [offer, setOffer] = useState('')
  const [audience, setAudience] = useState('')
  const [language, setLanguage] = useState<'EN' | 'BN' | 'BOTH'>('BOTH')
  const [selected, setSelected] = useState<string[]>(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'])
  const [busy, setBusy] = useState<string | null>(null)
  const [lastPlan, setLastPlan] = useState<GenerateResponse | null>(null)
  const [openSetup, setOpenSetup] = useState<string | null>(null)
  const [mediaDraft, setMediaDraft] = useState<Record<string, string>>({})
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try { setOverview(await fetchJson<Overview>('/api/admin/marketing')) }
    catch { toast.error('Could not load the marketing dashboard') }
  }, [])
  useEffect(() => { void load() }, [load])

  const generate = async () => {
    if (idea.trim().length < 3) { toast.error('Write the campaign idea first'); return }
    setBusy('generate')
    try {
      const res = await fetchJson<GenerateResponse>('/api/admin/marketing/generate', {
        method: 'POST',
        body: { idea, offer, audience, language, platforms: selected },
      })
      setLastPlan(res)
      toast.success(res.enhanced ? 'Campaign drafts created (agent-enhanced copy)' : 'Campaign drafts created (local draft — approve after editing)')
      await load()
    } catch { toast.error('Generation failed — drafts were not created') } finally { setBusy(null) }
  }

  const act = async (id: string, action: 'approve' | 'reject' | 'publish' | 'media' | 'schedule') => {
    setBusy(`${action}:${id}`)
    try {
      const res = await fetchJson<{ ok: boolean; result?: { status: string; error?: string } }>(`/api/admin/marketing/posts/${id}`, {
        method: 'PATCH',
        body: action === 'media' ? { action, mediaUrl: mediaDraft[id] ?? '' } : action === 'schedule' ? { action, scheduledAt: scheduleDraft[id] ?? '' } : { action },
      })
      if (action === 'publish') {
        if (res.ok) toast.success('Published — platform confirmed the post')
        else toast.error(`Not published: ${res.result?.error ?? res.result?.status ?? 'platform not configured'}`)
      } else toast.success(`Post ${action}d`)
      await load()
    } catch { toast.error(`Could not ${action} the post`) } finally { setBusy(null) }
  }

  const verify = async (platform: string) => {
    setBusy(`verify:${platform}`)
    try {
      const res = await fetchJson<{ ok: boolean; detail: string }>(`/api/admin/marketing/accounts/${platform}/verify`, { method: 'POST', body: {} })
      if (res.ok) toast.success(`${platform} connected: ${res.detail}`)
      else toast.error(`${platform} not connected: ${res.detail}`)
      await load()
    } catch { toast.error('Verification failed') } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Dashboard"
        description="One idea in — prompts, image briefs, a video plan and per-platform drafts out. Review, approve, then publish through the official platform APIs. Managed only from this Super Admin dashboard."
      />

      <SectionCard title="Social accounts — OAuth connection (no passwords)">
        <p className="mb-3 flex gap-2 text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{overview?.oauthNote ?? 'Accounts connect with official OAuth/API tokens stored on the host. Changing a password never breaks posting; only revoking the app does. Never paste passwords or tokens into chat or this page — set them in the host environment, then Verify.'}</span>
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(overview?.platforms ?? []).map((p) => (
            <div key={p.platform} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{p.label}</span>
                <span className={chip(p.state)}>{p.state.replace('_', ' ')}</span>
              </div>
              {p.missingEnv.length > 0 && (
                <p className="mt-2 flex gap-1.5 text-[11px] text-amber-300/90"><KeyRound className="h-3.5 w-3.5 shrink-0" /> Missing on host: {p.missingEnv.join(', ')}</p>
              )}
              {p.lastError && <p className="mt-1 text-[11px] text-rose-300">{p.lastError}</p>}
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{p.postingNotes}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" disabled={busy === `verify:${p.platform}`} onClick={() => void verify(p.platform)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Verify
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenSetup(openSetup === p.platform ? null : p.platform)}>
                  Setup steps
                </Button>
                <a className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-sky-300 hover:underline" href={p.developerPortal} target="_blank" rel="noreferrer">
                  Developer portal <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {openSetup === p.platform && (
                <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-400">
                  {p.setupSteps.map((s) => <li key={s}>{s}</li>)}
                  <li>Required permissions: {p.permissions.join('; ')}</li>
                </ol>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="New campaign — start from an idea">
        <div className="grid gap-3">
          <textarea className={cn(INPUT, 'min-h-20')} placeholder="Idea — e.g. Create 7 posts for CRM automation for small businesses" value={idea} onChange={(e) => setIdea(e.target.value)} />
          <div className="grid gap-3 md:grid-cols-2">
            <input className={INPUT} placeholder="Offer (optional) — e.g. Free setup this month" value={offer} onChange={(e) => setOffer(e.target.value)} />
            <input className={INPUT} placeholder="Audience (optional) — e.g. Small business owners in Bangladesh" value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_PLATFORMS.map((p) => (
              <button key={p} onClick={() => setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))}
                className={cn('min-h-9 rounded-full border px-3 text-xs font-medium', selected.includes(p) ? 'border-[#009FE3] bg-[#009FE3]/15 text-[#7fd4ff]' : 'border-slate-800 text-slate-400')}>
                {p}
              </button>
            ))}
            <select className={cn(INPUT, 'ml-auto w-36')} value={language} onChange={(e) => setLanguage(e.target.value as 'EN' | 'BN' | 'BOTH')}>
              <option value="EN">English</option>
              <option value="BN">Bangla</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          <div>
            <Button disabled={busy === 'generate'} onClick={() => void generate()}>
              <Sparkles className="mr-1.5 h-4 w-4" /> {busy === 'generate' ? 'Generating…' : 'Generate prompts, image brief, video plan & drafts'}
            </Button>
            <span className="ml-3 text-[11px] text-slate-500">Drafts only — nothing publishes without your approval below.</span>
          </div>
          {lastPlan && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-300">
              <p><span className="font-semibold text-slate-100">Headline:</span> {lastPlan.plan.headline} {lastPlan.enhanced ? '(copy agent-enhanced)' : '(local draft — edit freely)'}</p>
              <p className="mt-2"><span className="font-semibold text-slate-100">Image prompt:</span> {lastPlan.plan.imagePrompt}</p>
              <p className="mt-2"><span className="font-semibold text-slate-100">Video hook:</span> {lastPlan.plan.videoPlan.hook}</p>
              <ul className="mt-1 list-disc pl-4 text-slate-400">{lastPlan.plan.videoPlan.shots.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="mt-2 text-slate-500">Use Media Studio to produce the video, paste its public URL into a post below, then approve & publish.</p>
            </div>
          )}
        </div>
      </SectionCard>

      <MarketingPostGrid
        posts={(overview?.posts ?? []).map((p) => ({
          id: p.id,
          platform: p.platform,
          text: p.text,
          status: p.status,
          mediaUrl: p.mediaUrl,
          mediaPrompt: p.mediaPrompt,
          createdAt: p.createdAt,
        }))}
        reviews={overview?.reviews ?? []}
        onRefresh={load}
        onAction={(id, action) => act(id, action)}
        busy={busy}
      />

      <SectionCard title="Post queue — review, approve, publish">
        <div className="mb-3">
          <Button size="sm" variant="outline" disabled={busy === 'due'} onClick={async () => { setBusy('due'); try { const r = await fetchJson<{ processed: number }>('/api/admin/marketing/publish-due', { method: 'POST', body: {} }); toast.success(`Processed ${r.processed} due scheduled post(s)`); await load() } catch { toast.error('Publish-due run failed') } finally { setBusy(null) } }}>
            Publish due scheduled posts
          </Button>
          <span className="ml-2 text-[11px] text-slate-500">Idempotent — already-published posts are never re-sent.</span>
        </div>
        <div className="space-y-3">
          {(overview?.posts ?? []).length === 0 && <p className="text-xs text-slate-500">No posts yet. Generate a campaign above.</p>}
          {(overview?.posts ?? []).map((post) => (
            <div key={post.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-200">{post.platform}</span>
                <span className={chip(post.status)}>{post.status.replace('_', ' ')}</span>
                <span className="text-[11px] text-slate-500">{new Date(post.createdAt).toLocaleString()}</span>
                {post.externalUrl && <a className="ml-auto inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline" href={post.externalUrl} target="_blank" rel="noreferrer">View post <ExternalLink className="h-3 w-3" /></a>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{post.text}</p>
              {post.mediaPrompt && <p className="mt-1 text-[11px] text-slate-500">Media brief: {post.mediaPrompt}</p>}
              {post.error && <p className="mt-1 text-[11px] text-rose-300">{post.error}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <input className={cn(INPUT, 'min-h-8 flex-1 text-[11px]')} placeholder="Public media URL (https://…) — required for Instagram, optional photo for Facebook"
                  value={mediaDraft[post.id] ?? post.mediaUrl ?? ''} onChange={(e) => setMediaDraft((m) => ({ ...m, [post.id]: e.target.value }))} />
                <Button size="sm" variant="outline" disabled={busy === `media:${post.id}`} onClick={() => void act(post.id, 'media')}>Save media</Button>
                {post.status === 'DRAFT' && <Button size="sm" disabled={busy === `approve:${post.id}`} onClick={() => void act(post.id, 'approve')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve</Button>}
                {post.status === 'APPROVED' && <Button size="sm" variant="outline" disabled={busy === `reject:${post.id}`} onClick={() => void act(post.id, 'reject')}><XCircle className="mr-1 h-3.5 w-3.5" /> Back to draft</Button>}
                {post.status === 'APPROVED' && <Button size="sm" disabled={busy === `publish:${post.id}`} onClick={() => void act(post.id, 'publish')}><Send className="mr-1 h-3.5 w-3.5" /> Publish now</Button>}
                {post.status === 'APPROVED' && (
                  <>
                    <input type="datetime-local" aria-label="Schedule publish time" className={cn(INPUT, 'min-h-8 w-52 text-[11px]')} value={scheduleDraft[post.id] ?? ''} onChange={(e) => setScheduleDraft((m) => ({ ...m, [post.id]: e.target.value }))} />
                    <Button size="sm" variant="outline" disabled={busy === `schedule:${post.id}`} onClick={() => void act(post.id, 'schedule')}>Schedule</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Megaphone className="h-3.5 w-3.5" /> Publishing uses the connected platform APIs only. If an account is not connected, the post is marked NOT CONFIGURED — never fake-published.</p>
      </SectionCard>
    </div>
  )
}
