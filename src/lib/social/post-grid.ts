// ---------------------------------------------------------------------------
// TECH360 — Marketing post review grid (pure logic)
// ---------------------------------------------------------------------------
// The Marketing Dashboard shows every post the marketing agent drafted as a
// review card: a poster image, the platform/status, and the rating the team
// gave it. This module holds the part that must be auditable and testable —
// aggregation, filtering, sorting and prompt composition — so the UI and the
// API share one implementation and nothing is computed twice.
//
// Honesty rules kept here:
//   - A rating is only ever computed from real PostReview rows. A post with
//     no reviews reports `average: null` and `count: 0` — never a fake 5.0.
//   - Sorting never invents a score: unrated posts sink to the bottom of
//     "highest rated" instead of being promoted.
//   - The image prompt is composed locally from the post's own words. It is
//     a brief for an image tool, not a claim that an image was produced.
// ---------------------------------------------------------------------------

export const POST_SORTS = ['HIGHEST_RATED', 'NEWEST', 'MOST_REVIEWED'] as const
export type PostSort = (typeof POST_SORTS)[number]

export const POST_SORT_LABELS: Record<PostSort, string> = {
  HIGHEST_RATED: 'Highest rated',
  NEWEST: 'Newest first',
  MOST_REVIEWED: 'Most reviewed',
}

export const RATING_VALUES = [5, 4, 3, 2, 1] as const
export const MIN_RATING = 1
export const MAX_RATING = 5

export type GridPost = {
  id: string
  platform: string
  text: string
  status: string
  mediaUrl?: string | null
  mediaPrompt?: string | null
  hashtags?: string | null
  createdAt: string | Date
  scheduledAt?: string | Date | null
}

export type GridReview = {
  id?: string
  postId: string
  rating: number
  comment?: string | null
  reviewer?: string | null
  createdAt?: string | Date
}

export type RatingSummary = {
  /** Mean of the real ratings, rounded to one decimal — null when unrated. */
  average: number | null
  count: number
  /** How many reviews gave each star value. */
  distribution: Record<number, number>
  /** Most recent real comment, if any. */
  latestComment: string | null
}

export const EMPTY_SUMMARY: RatingSummary = { average: null, count: 0, distribution: {}, latestComment: null }

function toTime(value: string | Date | null | undefined): number {
  if (!value) return 0
  const t = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(t) ? t : 0
}

/** Round half-up to one decimal without float surprises (4.25 -> 4.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Aggregate a set of ratings. Invalid ratings are ignored, never clamped
 *  into a value they do not have. */
export function summarizeRatings(reviews: Array<Pick<GridReview, 'rating' | 'comment'>>): RatingSummary {
  const valid = reviews.filter((r) => Number.isFinite(r.rating) && r.rating >= MIN_RATING && r.rating <= MAX_RATING)
  if (valid.length === 0) return { ...EMPTY_SUMMARY, distribution: {} }
  const distribution: Record<number, number> = {}
  let total = 0
  for (const r of valid) {
    const stars = Math.round(r.rating)
    distribution[stars] = (distribution[stars] ?? 0) + 1
    total += stars
  }
  const latestComment = valid.map((r) => (r.comment ?? '').trim()).filter(Boolean).pop() ?? null
  return { average: round1(total / valid.length), count: valid.length, distribution, latestComment }
}

/** Group reviews by post id, preserving nothing but the aggregate. */
export function ratingsByPost(reviews: GridReview[]): Map<string, RatingSummary> {
  const grouped = new Map<string, Array<Pick<GridReview, 'rating' | 'comment'>>>()
  for (const r of reviews) {
    const list = grouped.get(r.postId) ?? []
    list.push({ rating: r.rating, comment: r.comment ?? null })
    grouped.set(r.postId, list)
  }
  const out = new Map<string, RatingSummary>()
  for (const [postId, list] of grouped) out.set(postId, summarizeRatings(list))
  return out
}

/** First meaningful line of the post, without hashtags or URLs. */
export function headlineOf(post: Pick<GridPost, 'text'>, max = 90): string {
  const cleaned = (post.text ?? '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[\w\u0980-\u09FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Untitled post'
  const sentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned
  const headline = sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence
  return headline
}

export function excerptOf(post: Pick<GridPost, 'text'>, max = 160): string {
  const cleaned = (post.text ?? '').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1).trimEnd()}…`
}

/**
 * The supporting copy of a post — everything after the sentence already used
 * as the poster headline, without hashtags or links. Returning '' (rather than
 * repeating the headline) keeps the poster readable instead of echoing itself.
 */
export function bodyOf(post: Pick<GridPost, 'text'>, max = 190): string {
  const cleaned = (post.text ?? '').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim()
  const sentences = cleaned.split(/(?<=[.!?])\s+/)
  const rest = sentences.length > 1 ? sentences.slice(1).join(' ') : ''
  const withoutTags = rest.replace(/#[\w\u0980-\u09FF]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!withoutTags) return ''
  return withoutTags.length <= max ? withoutTags : `${withoutTags.slice(0, max - 1).trimEnd()}…`
}

export function hashtagsOf(post: Pick<GridPost, 'hashtags'>): string[] {
  if (!post.hashtags) return []
  try {
    const parsed = JSON.parse(post.hashtags) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((h) => String(h)).filter(Boolean).slice(0, 8)
  } catch {
    return []
  }
}

export type GridFilter = { platform?: string; status?: string; query?: string }

export const ALL = 'ALL'

/** Filter by platform, status and free-text search. `ALL`/empty = no filter. */
export function filterPosts<T extends GridPost>(posts: T[], filter: GridFilter = {}): T[] {
  const platform = (filter.platform ?? ALL).toUpperCase()
  const status = (filter.status ?? ALL).toUpperCase()
  const query = (filter.query ?? '').trim().toLowerCase()
  return posts.filter((post) => {
    if (platform !== ALL && post.platform.toUpperCase() !== platform) return false
    if (status !== ALL && post.status.toUpperCase() !== status) return false
    if (!query) return true
    return `${post.text} ${post.platform} ${post.status}`.toLowerCase().includes(query)
  })
}

/** Sort a copy. Ties fall back to newest-first so the order is deterministic. */
export function sortPosts<T extends GridPost>(
  posts: T[],
  summaries: Map<string, RatingSummary>,
  sort: PostSort = 'NEWEST',
): T[] {
  const byNewest = (a: T, b: T) => toTime(b.createdAt) - toTime(a.createdAt)
  const copy = [...posts]
  switch (sort) {
    case 'HIGHEST_RATED':
      return copy.sort((a, b) => {
        const ra = summaries.get(a.id)?.average ?? null
        const rb = summaries.get(b.id)?.average ?? null
        // Unrated posts are not treated as 0 stars (that would be a judgement
        // we have no evidence for) — they are simply ordered last.
        if (ra === null && rb === null) return byNewest(a, b)
        if (ra === null) return 1
        if (rb === null) return -1
        if (rb !== ra) return rb - ra
        const ca = summaries.get(a.id)?.count ?? 0
        const cb = summaries.get(b.id)?.count ?? 0
        if (cb !== ca) return cb - ca
        return byNewest(a, b)
      })
    case 'MOST_REVIEWED':
      return copy.sort((a, b) => {
        const ca = summaries.get(a.id)?.count ?? 0
        const cb = summaries.get(b.id)?.count ?? 0
        if (cb !== ca) return cb - ca
        return byNewest(a, b)
      })
    case 'NEWEST':
    default:
      return copy.sort(byNewest)
  }
}

/** Counts for the toolbar chips — only values that actually exist. */
export function facetCounts<T extends GridPost>(posts: T[]): { platforms: Array<{ value: string; count: number }>; statuses: Array<{ value: string; count: number }> } {
  const count = (pick: (p: T) => string) => {
    const map = new Map<string, number>()
    for (const post of posts) {
      const key = pick(post).toUpperCase()
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].map(([value, n]) => ({ value, count: n })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  }
  return { platforms: count((p) => p.platform), statuses: count((p) => p.status) }
}

/** Is a rating valid? Used by the API before it writes a row. */
export function isValidRating(rating: unknown): rating is number {
  return typeof rating === 'number' && Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING
}

/**
 * Compose a clear, brand-safe image prompt from a topic.
 *
 * This is a local, deterministic composer — the same wording rules the
 * marketing planner uses. It describes a layout and palette so an image tool
 * produces a legible poster rather than decorative noise; it never claims the
 * image exists.
 */
export function buildImagePrompt(input: { topic: string; platform?: string; tone?: string; palette?: string }): string {
  const topic = input.topic.replace(/\s+/g, ' ').trim().slice(0, 200) || 'the campaign message'
  const platform = (input.platform ?? 'LINKEDIN').toUpperCase()
  const tone = (input.tone ?? 'confident, practical').trim() || 'confident, practical'
  const palette = (input.palette ?? 'deep navy #0B2545, cyan #009FE3, white text').trim() || 'deep navy, cyan, white text'
  return [
    `Clear, readable poster for ${platform}: "${topic}".`,
    `Layout: strong left-aligned headline in a geometric sans-serif, one short supporting line, generous margin, high contrast.`,
    `Palette: ${palette}.`,
    `Tone: ${tone}.`,
    `Include a simple flat icon or geometric motif that relates to the topic; no invented statistics, no fake logos, no text smaller than 24px, no gibberish lettering.`,
    `Output: square 1080×1080, vector-clean edges, legible at thumbnail size.`,
  ].join(' ')
}

export type StarDisplay = { filled: number; half: number; empty: number; label: string }

/** 5-star display model from a real average (never from a count of zero). */
export function starDisplay(summary: RatingSummary | undefined): StarDisplay {
  const average = summary?.average ?? null
  if (average === null) return { filled: 0, half: 0, empty: 5, label: 'Not rated yet' }
  const filled = Math.floor(average)
  const remainder = average - filled
  const half = remainder >= 0.25 && remainder < 0.75 ? 1 : remainder >= 0.75 ? 1 : 0
  const promoted = remainder >= 0.75 ? filled + 1 : filled
  const empty = Math.max(0, 5 - promoted - half)
  return { filled: promoted, half, empty, label: `${average.toFixed(1)} out of 5` }
}
