/**
 * TECH360 — Marketing post review grid (pure logic + poster renderer).
 *
 * These tests pin the honesty rules the grid depends on:
 *   - an unrated post reports `average: null`, never a fabricated 5.0,
 *   - "highest rated" sinks unrated posts instead of promoting them,
 *   - the poster is deterministic, inert SVG with escaped text.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bodyOf,
  buildImagePrompt,
  excerptOf,
  facetCounts,
  filterPosts,
  hashtagsOf,
  headlineOf,
  isValidRating,
  ratingsByPost,
  sortPosts,
  starDisplay,
  summarizeRatings,
  type GridReview,
  type RatingSummary,
} from '../src/lib/social/post-grid'
import { escapeXml, isPosterFormat, renderPosterSvg, wrapText } from '../src/lib/social/poster'

const post = (id: string, over: Partial<Parameters<typeof headlineOf>[0]> & Record<string, unknown> = {}) => ({
  id,
  platform: 'FACEBOOK',
  text: `Post ${id} body copy`,
  status: 'DRAFT',
  createdAt: `2026-10-0${(Number(id.replace(/\D/g, '')) % 9) + 1}T10:00:00.000Z`,
  ...over,
})

describe('rating aggregation', () => {
  it('reports no rating at all when there are no reviews', () => {
    const summary = summarizeRatings([])
    assert.equal(summary.average, null)
    assert.equal(summary.count, 0)
    assert.equal(summary.latestComment, null)
  })

  it('averages only real reviews and rounds to one decimal', () => {
    const summary = summarizeRatings([{ rating: 5, comment: 'Great hook' }, { rating: 4 }, { rating: 4, comment: '' }])
    assert.equal(summary.average, 4.3)
    assert.equal(summary.count, 3)
    assert.equal(summary.distribution[5], 1)
    assert.equal(summary.distribution[4], 2)
    assert.equal(summary.latestComment, 'Great hook')
  })

  it('ignores out-of-range ratings instead of clamping them', () => {
    const summary = summarizeRatings([{ rating: 9 }, { rating: 0 }, { rating: 3 }])
    assert.equal(summary.average, 3)
    assert.equal(summary.count, 1)
  })

  it('groups by post and keeps the two posts independent', () => {
    const reviews: GridReview[] = [
      { postId: 'a', rating: 5 },
      { postId: 'a', rating: 4 },
      { postId: 'b', rating: 2 },
    ]
    const map = ratingsByPost(reviews)
    assert.equal(map.get('a')?.average, 4.5)
    assert.equal(map.get('b')?.average, 2)
    assert.equal(map.get('c'), undefined)
  })

  it('rejects fractional and out-of-range ratings at the API boundary', () => {
    assert.equal(isValidRating(5), true)
    assert.equal(isValidRating(1), true)
    assert.equal(isValidRating(0), false)
    assert.equal(isValidRating(6), false)
    assert.equal(isValidRating(3.5), false)
    assert.equal(isValidRating('5'), false)
  })

  it('shows an explicit "not rated" star display for an unrated post', () => {
    assert.deepEqual(starDisplay(undefined), { filled: 0, half: 0, empty: 5, label: 'Not rated yet' })
    const rated: RatingSummary = { average: 4.6, count: 3, distribution: { 5: 2, 4: 1 }, latestComment: null }
    assert.equal(starDisplay(rated).label, '4.6 out of 5')
    assert.equal(starDisplay(rated).filled + starDisplay(rated).half, 5)
  })
})

describe('grid copy helpers', () => {
  it('strips hashtags and links out of the headline', () => {
    const headline = headlineOf({ text: 'Automate your follow-ups in one afternoon. https://example.com #CRM #Automation' })
    assert.equal(headline, 'Automate your follow-ups in one afternoon.')
  })

  it('falls back to a neutral label for an empty post', () => {
    assert.equal(headlineOf({ text: '   ' }), 'Untitled post')
  })

  it('uses the supporting sentences as the poster body, never the headline again', () => {
    const body = bodyOf({ text: 'Automate your follow-ups. Built for small teams in Bangladesh. #CRM' })
    assert.equal(body, 'Built for small teams in Bangladesh.')
    assert.equal(bodyOf({ text: 'One line only' }), '')
  })

  it('truncates an excerpt with an ellipsis', () => {
    const long = 'a'.repeat(400)
    const excerpt = excerptOf({ text: long }, 40)
    assert.equal(excerpt.length, 40)
    assert.ok(excerpt.endsWith('…'))
  })

  it('reads hashtags only when they are a real JSON array', () => {
    assert.deepEqual(hashtagsOf({ hashtags: JSON.stringify(['#CRM', '#BD']) }), ['#CRM', '#BD'])
    assert.deepEqual(hashtagsOf({ hashtags: 'not json' }), [])
    assert.deepEqual(hashtagsOf({ hashtags: null }), [])
  })

  it('composes an image prompt from the topic without inventing results', () => {
    const prompt = buildImagePrompt({ topic: 'CRM automation for small businesses', platform: 'LINKEDIN' })
    assert.ok(prompt.includes('CRM automation for small businesses'))
    assert.ok(prompt.includes('LINKEDIN'))
    assert.ok(/no invented statistics/i.test(prompt))
    assert.ok(!/\d+%/.test(prompt))
  })
})

describe('filtering and sorting', () => {
  const posts = [
    post('p1', { platform: 'FACEBOOK', status: 'DRAFT', text: 'CRM automation launch' }),
    post('p2', { platform: 'LINKEDIN', status: 'APPROVED', text: 'Client onboarding checklist' }),
    post('p3', { platform: 'LINKEDIN', status: 'DRAFT', text: 'Weekly reporting walkthrough' }),
  ]

  it('filters by platform, status and free text', () => {
    assert.equal(filterPosts(posts, { platform: 'LINKEDIN' }).length, 2)
    assert.equal(filterPosts(posts, { status: 'DRAFT' }).length, 2)
    assert.equal(filterPosts(posts, { query: 'onboarding' }).length, 1)
    assert.equal(filterPosts(posts, { platform: 'ALL', status: 'ALL' }).length, 3)
  })

  it('counts only the platforms and statuses that exist', () => {
    const facets = facetCounts(posts)
    assert.deepEqual(facets.platforms, [{ value: 'LINKEDIN', count: 2 }, { value: 'FACEBOOK', count: 1 }])
    assert.deepEqual(facets.statuses.map((s) => s.value).sort(), ['APPROVED', 'DRAFT'])
  })

  it('never promotes an unrated post in "highest rated"', () => {
    const summaries = new Map<string, RatingSummary>([
      ['p1', { average: 3, count: 1, distribution: { 3: 1 }, latestComment: null }],
      ['p2', { average: 5, count: 2, distribution: { 5: 2 }, latestComment: null }],
    ])
    const sorted = sortPosts(posts, summaries, 'HIGHEST_RATED')
    assert.deepEqual(sorted.map((p) => p.id), ['p2', 'p1', 'p3'])
  })

  it('breaks ties by review count, then newest first', () => {
    const summaries = new Map<string, RatingSummary>([
      ['p1', { average: 4, count: 1, distribution: { 4: 1 }, latestComment: null }],
      ['p2', { average: 4, count: 3, distribution: { 4: 3 }, latestComment: null }],
    ])
    assert.deepEqual(sortPosts(posts, summaries, 'HIGHEST_RATED').slice(0, 2).map((p) => p.id), ['p2', 'p1'])
    assert.deepEqual(sortPosts(posts, new Map(), 'NEWEST').map((p) => p.id), ['p3', 'p2', 'p1'])
    assert.deepEqual(sortPosts(posts, summaries, 'MOST_REVIEWED')[0].id, 'p2')
  })

  it('does not mutate the input array', () => {
    const original = posts.map((p) => p.id)
    sortPosts(posts, new Map(), 'HIGHEST_RATED')
    assert.deepEqual(posts.map((p) => p.id), original)
  })
})

describe('poster renderer', () => {
  it('escapes every character that could break the SVG', () => {
    assert.equal(escapeXml('<script>alert("x")&</script>'), '&lt;script&gt;alert(&quot;x&quot;)&amp;&lt;/script&gt;')
  })

  it('wraps text within the character budget and says when it truncated', () => {
    const lines = wrapText('one two three four five six seven eight nine ten', 12, 2)
    assert.equal(lines.length, 2)
    for (const line of lines) assert.ok(line.length <= 12, `line too long: ${line}`)
    assert.ok(lines[1].endsWith('…'))
  })

  it('renders a deterministic, inert poster with the real status', () => {
    const input = {
      headline: 'Automate your follow-ups',
      body: 'A short supporting line about the offer.',
      platform: 'LINKEDIN',
      status: 'DRAFT',
      hashtags: ['#CRM'],
      format: 'SQUARE' as const,
    }
    const a = renderPosterSvg(input)
    const b = renderPosterSvg(input)
    assert.equal(a, b)
    assert.ok(a.startsWith('<svg'))
    assert.ok(a.includes('width="1080"') && a.includes('height="1080"'))
    assert.ok(a.includes('DRAFT'))
    assert.ok(a.includes('Automate your follow-ups'))
    assert.ok(!/<script/i.test(a))
    assert.ok(!/onload=/i.test(a))
    // The only URL is the SVG namespace itself: no remote fonts, images or links.
    const remoteRefs = a.match(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/g)
    assert.equal(remoteRefs, null)
    assert.ok(!/href=/i.test(a))
  })

  it('honours the story and landscape canvases', () => {
    const story = renderPosterSvg({ headline: 'x', platform: 'INSTAGRAM', format: 'STORY' })
    assert.ok(story.includes('height="1350"'))
    const landscape = renderPosterSvg({ headline: 'x', platform: 'X', format: 'LANDSCAPE' })
    assert.ok(landscape.includes('width="1200"') && landscape.includes('height="675"'))
  })

  it('neutralises hostile copy inside the poster', () => {
    const svg = renderPosterSvg({ headline: '<script>alert(1)</script>', platform: 'FACEBOOK' })
    assert.ok(!svg.includes('<script>alert(1)</script>'))
    assert.ok(svg.includes('&lt;script&gt;'))
  })

  it('validates the requested format', () => {
    assert.equal(isPosterFormat('STORY'), true)
    assert.equal(isPosterFormat('BANNER'), false)
    assert.equal(isPosterFormat(undefined), false)
  })
})
