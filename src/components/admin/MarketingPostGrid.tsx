'use client'

// ============================================================
// TECH360 — Marketing post REVIEW GRID
// ============================================================
// Every post the marketing agent drafts lands here as a card: a clear,
// vector-rendered poster, the platform and status the system actually holds,
// and the team's real rating. Layout follows the store-listing pattern the
// team asked for — "Filter by", "Sort by", a rating on every card and an
// "AI Prompts+" tile — but every number on it comes from a stored row.
//
// Truthfulness rules enforced here:
//   * A post with no reviews shows "Not rated yet". No 5.0 is ever invented
//     to make the grid look complete.
//   * The poster is rendered from the post's own copy (SVG), so the image is
//     legible; it is labelled with the post's real status.
//   * Approving only happens through the same reviewed API the queue uses —
//     the grid never publishes anything on its own.
// ============================================================

import { useCallback, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ImageIcon,
  Maximize2,
  MessageSquarePlus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { fetchJson } from '@/lib/admin-client'
import {
  ALL,
  POST_SORTS,
  POST_SORT_LABELS,
  buildImagePrompt,
  excerptOf,
  facetCounts,
  filterPosts,
  headlineOf,
  ratingsByPost,
  sortPosts,
  starDisplay,
  type GridPost,
  type GridReview,
  type PostSort,
  type RatingSummary,
} from '@/lib/social/post-grid'
import { SectionCard } from './shared/cards'
import { INPUT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ReviewGridPost = GridPost
export type ReviewGridReview = GridReview

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  APPROVED: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  DRAFT: 'border-slate-600/60 bg-slate-800/60 text-slate-300',
  FAILED: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  NOT_CONFIGURED: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}
const chipClass = (status: string) =>
  cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT)

function Stars({ summary, size = 'sm' }: { summary?: RatingSummary; size?: 'sm' | 'md' }) {
  const display = starDisplay(summary)
  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const stars: Array<{ key: string; state: 'full' | 'half' | 'empty' }> = []
  for (let i = 0; i < display.filled; i += 1) stars.push({ key: `f${i}`, state: 'full' })
  if (display.half) stars.push({ key: 'half', state: 'half' })
  for (let i = 0; i < display.empty; i += 1) stars.push({ key: `e${i}`, state: 'empty' })

  if (!summary || summary.count === 0) {
    return <span className="text-[11px] text-slate-500">Not rated yet</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${display.label} from ${summary.count} review${summary.count === 1 ? '' : 's'}`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {stars.map((s) => (
          <Star
            key={s.key}
            className={cn(dim, s.state === 'empty' ? 'text-slate-600' : 'text-amber-400', s.state === 'full' && 'fill-amber-400')}
            strokeWidth={1.6}
          />
        ))}
      </span>
      <span className="text-[11px] font-semibold text-amber-300">{summary.average?.toFixed(1)}</span>
      <span className="text-[11px] text-slate-500">({summary.count})</span>
    </span>
  )
}

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/60"
        >
          <Star className={cn('h-6 w-6', n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-600')} strokeWidth={1.6} />
        </button>
      ))}
      <span className="ml-2 text-xs text-slate-400">{value}/5</span>
    </div>
  )
}

export function MarketingPostGrid({
  posts,
  reviews,
  onRefresh,
  onAction,
  busy,
}: {
  posts: ReviewGridPost[]
  reviews: ReviewGridReview[]
  onRefresh: () => Promise<void> | void
  onAction?: (id: string, action: 'approve') => Promise<void> | void
  busy?: string | null
}) {
  const [platform, setPlatform] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [sort, setSort] = useState<PostSort>('NEWEST')
  const [query, setQuery] = useState('')

  const [reviewFor, setReviewFor] = useState<ReviewGridPost | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  const [posterFor, setPosterFor] = useState<ReviewGridPost | null>(null)
  const [posterFormat, setPosterFormat] = useState<'SQUARE' | 'STORY' | 'LANDSCAPE'>('SQUARE')

  const [promptFor, setPromptFor] = useState<ReviewGridPost | null>(null)
  const [promptTopic, setPromptTopic] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  const summaries = useMemo(() => ratingsByPost(reviews), [reviews])
  const facets = useMemo(() => facetCounts(posts), [posts])
  const visible = useMemo(
    () => sortPosts(filterPosts(posts, { platform, status, query }), summaries, sort),
    [posts, platform, status, query, summaries, sort],
  )

  const reviewsFor = useCallback(
    (postId: string) => reviews.filter((r) => r.postId === postId).sort((a, b) => Date.parse(String(b.createdAt ?? 0)) - Date.parse(String(a.createdAt ?? 0))),
    [reviews],
  )

  const openReview = (post: ReviewGridPost) => {
    setReviewFor(post)
    setRating(5)
    setComment('')
  }

  const saveReview = async () => {
    if (!reviewFor) return
    setSavingReview(true)
    try {
      await fetchJson(`/api/admin/marketing/posts/${reviewFor.id}/reviews`, {
        method: 'POST',
        body: { rating, comment },
      })
      toast.success(`Review saved — ${rating}/5 recorded for this ${reviewFor.platform} post`)
      setReviewFor(null)
      await onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the review')
    } finally {
      setSavingReview(false)
    }
  }

  const deleteReview = async (postId: string, reviewId?: string) => {
    if (!reviewId) return
    try {
      await fetchJson(`/api/admin/marketing/posts/${postId}/reviews?reviewId=${encodeURIComponent(reviewId)}`, { method: 'DELETE' })
      toast.success('Review removed')
      await onRefresh()
    } catch {
      toast.error('Could not remove the review')
    }
  }

  const openPrompt = (post: ReviewGridPost | null) => {
    const target = post ?? visible[0] ?? posts[0] ?? null
    setPromptFor(target)
    setPromptTopic(target ? headlineOf(target, 140) : '')
  }

  const composedPrompt = useMemo(
    () => buildImagePrompt({ topic: promptTopic, platform: promptFor?.platform ?? 'LINKEDIN' }),
    [promptTopic, promptFor],
  )

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(composedPrompt)
      toast.success('Image prompt copied')
    } catch {
      toast.error('Clipboard is not available in this browser')
    }
  }

  const savePrompt = async () => {
    if (!promptFor) return
    setSavingPrompt(true)
    try {
      await fetchJson(`/api/admin/marketing/posts/${promptFor.id}`, { method: 'PATCH', body: { action: 'prompt', prompt: composedPrompt } })
      toast.success('Image brief saved to the post')
      setPromptFor(null)
      await onRefresh()
    } catch {
      toast.error('Could not save the image brief')
    } finally {
      setSavingPrompt(false)
    }
  }

  const copyPost = async (post: ReviewGridPost) => {
    try {
      await navigator.clipboard.writeText(post.text)
      toast.success('Post copy copied')
    } catch {
      toast.error('Clipboard is not available in this browser')
    }
  }

  const posterUrl = (post: ReviewGridPost, format: 'SQUARE' | 'STORY' | 'LANDSCAPE' = 'SQUARE') =>
    `/api/admin/marketing/posts/${post.id}/poster?format=${format}`

  return (
    <SectionCard
      title="Post review grid"
      description="Every drafted post as a card with a clear poster and the team's real rating. Filter, sort, review, then approve — nothing publishes from here."
      actions={<span className="text-[11px] text-slate-500">{visible.length} of {posts.length} post{posts.length === 1 ? '' : 's'}</span>}
    >
      {/* Toolbar — "Filter by" / "Sort by", the same controls the team asked for. */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-40 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filter by</span>
          <select className={cn(INPUT, 'h-9')} value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Filter by platform">
            <option value={ALL}>All platforms</option>
            {facets.platforms.map((f) => (
              <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select className={cn(INPUT, 'h-9')} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value={ALL}>All statuses</option>
            {facets.statuses.map((f) => (
              <option key={f.value} value={f.value}>{f.value.replace('_', ' ')} ({f.count})</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-44 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sort by</span>
          <select className={cn(INPUT, 'h-9')} value={sort} onChange={(e) => setSort(e.target.value as PostSort)} aria-label="Sort by">
            {POST_SORTS.map((s) => (
              <option key={s} value={s}>{POST_SORT_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search</span>
          <input
            className={cn(INPUT, 'h-9')}
            placeholder="Search the drafted copy…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search posts"
          />
        </label>
        <Button size="sm" variant="outline" onClick={() => void onRefresh()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {/* AI Prompts+ tile — the prompt composer, sitting inside the grid. */}
        <button
          type="button"
          onClick={() => openPrompt(null)}
          className="group flex min-h-40 flex-col items-start justify-between rounded-xl border border-dashed border-[#009FE3]/50 bg-[#009FE3]/5 p-4 text-left transition hover:border-[#009FE3] hover:bg-[#009FE3]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#7fd4ff]">
            <Sparkles className="h-4 w-4" /> AI Prompts+
          </span>
          <span className="text-xs leading-relaxed text-slate-400">
            Compose a legible, brand-safe image brief from any post, copy it, or save it back to the post as its media brief.
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7fd4ff] group-hover:underline">
            <SlidersHorizontal className="h-3 w-3" /> Open prompt composer
          </span>
        </button>

        {visible.map((post) => {
          const summary = summaries.get(post.id)
          return (
            <article key={post.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
              <button
                type="button"
                onClick={() => { setPosterFor(post); setPosterFormat('SQUARE') }}
                className="group relative block aspect-square w-full overflow-hidden bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/50"
                aria-label={`Open the full poster for this ${post.platform} post`}
              >
                <img
                  src={posterUrl(post)}
                  alt={`Poster for the ${post.platform} ${post.status.toLowerCase()} post: ${headlineOf(post, 70)}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                />
                <span className="absolute right-2 top-2 rounded bg-slate-950/70 p-1 text-slate-200 opacity-0 transition group-hover:opacity-100">
                  <Maximize2 className="h-3.5 w-3.5" />
                </span>
                <span className="absolute left-2 top-2 flex gap-1">
                  <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-200">{post.platform}</span>
                  <span className={chipClass(post.status)}>{post.status.replace('_', ' ')}</span>
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-100">{headlineOf(post, 90)}</p>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">{excerptOf(post, 120)}</p>
                <div className="flex items-center justify-between gap-2">
                  <Stars summary={summary} />
                  <span className="text-[10px] text-slate-600">{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                {summary?.latestComment && (
                  <p className="line-clamp-2 rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-[11px] italic leading-relaxed text-slate-400">
                    “{summary.latestComment}”
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openReview(post)}>
                    <MessageSquarePlus className="mr-1 h-3.5 w-3.5" /> Review
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openPrompt(post)} aria-label="Compose an image prompt for this post">
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> Prompt
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void copyPost(post)} aria-label="Copy the post copy">
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                  {post.status === 'DRAFT' && onAction && (
                    <Button size="sm" variant="ghost" disabled={busy === `approve:${post.id}`} onClick={() => void onAction(post.id, 'approve')}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {visible.length === 0 && posts.length === 0 && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-500">
          No posts yet. Generate a campaign above — each draft will appear here as a card with its own poster.
        </p>
      )}
      {visible.length === 0 && posts.length > 0 && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-500">
          No posts match this filter. Clear the search or choose “All” to see the {posts.length} drafted post{posts.length === 1 ? '' : 's'}.
        </p>
      )}

      {/* ---- Review dialog: records a real rating row ---- */}
      <Dialog open={Boolean(reviewFor)} onOpenChange={(open) => { if (!open) setReviewFor(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review this post</DialogTitle>
            <DialogDescription>
              {reviewFor ? `${reviewFor.platform} · ${headlineOf(reviewFor, 70)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {reviewFor && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{excerptOf(reviewFor, 600)}</p>
              </div>
              <RatingPicker value={rating} onChange={setRating} />
              <textarea
                className={cn(INPUT, 'min-h-20')}
                placeholder="What works, what to fix before approval (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Previous reviews</p>
                {reviewsFor(reviewFor.id).length === 0 && <p className="text-[11px] text-slate-500">This post has not been reviewed yet.</p>}
                {reviewsFor(reviewFor.id).map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/50 p-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-amber-300">
                        {r.rating}/5 <span className="font-normal text-slate-500">— {r.reviewer ?? 'operator'} · {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</span>
                      </p>
                      {r.comment && <p className="text-[11px] leading-relaxed text-slate-400">{r.comment}</p>}
                    </div>
                    <Button size="sm" variant="ghost" aria-label="Delete this review" onClick={() => void deleteReview(reviewFor.id, r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewFor(null)}>Cancel</Button>
            <Button disabled={savingReview} onClick={() => void saveReview()}>
              <Check className="mr-1.5 h-4 w-4" /> {savingReview ? 'Saving…' : 'Save review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Poster preview / download ---- */}
      <Dialog open={Boolean(posterFor)} onOpenChange={(open) => { if (!open) setPosterFor(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Poster preview</DialogTitle>
            <DialogDescription>
              Rendered locally from the post’s own copy — vector text, so it stays legible at any size.
            </DialogDescription>
          </DialogHeader>
          {posterFor && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                <img src={posterUrl(posterFor, posterFormat)} alt={`Full poster for the ${posterFor.platform} post`} className="mx-auto max-h-[60vh] w-auto" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={cn(INPUT, 'h-9 w-40')} value={posterFormat} onChange={(e) => setPosterFormat(e.target.value as typeof posterFormat)} aria-label="Poster format">
                  <option value="SQUARE">Square 1080×1080</option>
                  <option value="STORY">Story 1080×1350</option>
                  <option value="LANDSCAPE">Landscape 1200×675</option>
                </select>
                <a
                  className="inline-flex h-9 items-center rounded-md border border-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800/60"
                  href={`${posterUrl(posterFor, posterFormat)}&download=1`}
                  download
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download SVG
                </a>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Publishing to Instagram still needs a publicly hosted image URL. This poster is a workspace asset; upload it to your own media host before publishing.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- AI prompt composer ---- */}
      <Dialog open={Boolean(promptFor)} onOpenChange={(open) => { if (!open) setPromptFor(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>AI Prompts+</DialogTitle>
            <DialogDescription>Compose a clear image brief for a post. Built locally from the post’s own words — no model call, no invented claims.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Post</span>
              <select
                className={INPUT}
                value={promptFor?.id ?? ''}
                onChange={(e) => {
                  const next = posts.find((p) => p.id === e.target.value) ?? null
                  setPromptFor(next)
                  setPromptTopic(next ? headlineOf(next, 140) : '')
                }}
              >
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>{p.platform} · {headlineOf(p, 60)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Topic</span>
              <input className={INPUT} value={promptTopic} onChange={(e) => setPromptTopic(e.target.value)} placeholder="What should the image show?" />
            </label>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[11px] leading-relaxed text-slate-300">{composedPrompt}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => void copyPrompt()}><Copy className="mr-1.5 h-4 w-4" /> Copy</Button>
            <Button disabled={!promptFor || savingPrompt} onClick={() => void savePrompt()}>
              <Sparkles className="mr-1.5 h-4 w-4" /> {savingPrompt ? 'Saving…' : 'Save to post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
