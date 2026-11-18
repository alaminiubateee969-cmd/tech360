/**
 * Portfolio media caching + WebP posters.
 *  - Every versioned URL's `?v=` hash matches the bytes on disk (stale hash = fail).
 *  - Immutable caching applies ONLY to `?v=<hash>` requests in the four
 *    portfolio media directories; unversioned requests get a short policy;
 *    no HTML/API/catch-all rule sets Cache-Control.
 *  - Posters are real 1280×720 WebP files, every poster is referenced, and no
 *    JPG poster duplicates remain.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { PORTFOLIO, mediaFilePath, mediaUrl } from '../src/data/portfolio'
import { PORTFOLIO_MEDIA_VERSIONS } from '../src/data/portfolio-media-versions'
import { PORTFOLIO_MEDIA_DIRS, collectVersions } from '../scripts/media/hash-portfolio-media.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const VERSIONED_PREFIXES = (PORTFOLIO_MEDIA_DIRS as string[]).map((d) => `/${d}/`)

function portfolioMediaUrls(): string[] {
  const urls: string[] = []
  for (const entry of PORTFOLIO) {
    urls.push(entry.cover.src)
    if (entry.cover.srcSmall) urls.push(entry.cover.srcSmall)
    for (const image of entry.gallery) urls.push(image.src)
    if (entry.video) urls.push(entry.video.src, entry.video.poster)
  }
  return [...new Set(urls)]
}

/** WebP dimensions from the VP8 / VP8L / VP8X chunk header. */
function webpSize(buffer: Buffer): { width: number; height: number } {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP')
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 }
  throw new Error(`unknown WebP chunk ${chunk}`)
}

describe('portfolio media — content-versioned URLs', () => {
  it('the generated hash table matches the files on disk (regenerate with hash-portfolio-media.mjs)', () => {
    assert.deepEqual({ ...PORTFOLIO_MEDIA_VERSIONS }, collectVersions())
  })

  it('every portfolio media URL in a cached directory carries its current content hash', () => {
    let versioned = 0
    for (const url of portfolioMediaUrls()) {
      const file = mediaFilePath(url)
      assert.ok(existsSync(path.join(PUBLIC, file)), `missing ${file}`)
      if (VERSIONED_PREFIXES.some((p) => file.startsWith(p))) {
        const v = new URL(url, 'https://x').searchParams.get('v')
        assert.equal(v, PORTFOLIO_MEDIA_VERSIONS[file], `${url} has a stale or missing ?v=`)
        assert.match(v!, /^[0-9a-f]{12}$/)
        versioned++
      } else {
        assert.ok(!url.includes('?'), `${url}: only files in the versioned directories may carry ?v=`)
      }
    }
    assert.ok(versioned >= 60, `expected all videos, posters and covers to be versioned, got ${versioned}`)
  })

  it('mediaUrl leaves unknown paths unversioned and mediaFilePath strips the query', () => {
    assert.equal(mediaUrl('/images/not-tracked.webp'), '/images/not-tracked.webp')
    assert.equal(mediaFilePath('/videos/work/a.mp4?v=0123456789ab'), '/videos/work/a.mp4')
  })
})

describe('portfolio media — cache headers (next.config.ts)', async () => {
  const config = (await import('../next.config')) as unknown as {
    default: { headers: () => Promise<Array<{ source: string; has?: unknown[]; missing?: unknown[]; headers: { key: string; value: string }[] }>> }
    PORTFOLIO_MEDIA_SOURCES: string[]
  }
  const rules = await config.default.headers()
  const cacheRules = rules.filter((r) => r.headers.some((h) => h.key.toLowerCase() === 'cache-control'))
  const cacheValue = (r: (typeof rules)[number]) => r.headers.find((h) => h.key.toLowerCase() === 'cache-control')!.value

  it('covers exactly the portfolio media directories', () => {
    assert.deepEqual(
      config.PORTFOLIO_MEDIA_SOURCES.map((s) => s.replace('/:file*', '/')),
      VERSIONED_PREFIXES.filter((p) => p !== '/videos/work/posters/'), // posters are inside /videos/work/
    )
  })

  it('immutable is applied only to ?v=<12 hex> requests in those directories', () => {
    const immutable = cacheRules.filter((r) => cacheValue(r).includes('immutable'))
    assert.equal(immutable.length, config.PORTFOLIO_MEDIA_SOURCES.length)
    for (const rule of immutable) {
      assert.ok(config.PORTFOLIO_MEDIA_SOURCES.includes(rule.source), `immutable on ${rule.source}`)
      assert.deepEqual(rule.has, [{ type: 'query', key: 'v', value: '[0-9a-f]{12}' }])
      assert.equal(cacheValue(rule), 'public, max-age=31536000, immutable')
    }
  })

  it('unversioned media gets a short revalidating policy, never immutable', () => {
    for (const source of config.PORTFOLIO_MEDIA_SOURCES) {
      const rule = cacheRules.find((r) => r.source === source && r.missing)
      assert.ok(rule, `no unversioned rule for ${source}`)
      assert.deepEqual(rule.missing, [{ type: 'query', key: 'v' }])
      assert.equal(cacheValue(rule), 'public, max-age=3600, stale-while-revalidate=86400')
    }
  })

  it('no catch-all, HTML or API rule gets a public cache policy', () => {
    for (const rule of cacheRules) {
      if (config.PORTFOLIO_MEDIA_SOURCES.includes(rule.source)) continue
      assert.match(cacheValue(rule), /no-store/, `${rule.source} must not be publicly cached`)
    }
  })
})

describe('portfolio media — WebP posters', () => {
  const dir = path.join(PUBLIC, 'videos/work/posters')
  const files = readdirSync(dir)

  it('ships 20 WebP posters and no JPG duplicates', () => {
    assert.equal(files.filter((f) => f.endsWith('.webp')).length, 20)
    assert.deepEqual(files.filter((f) => !f.endsWith('.webp')), [])
  })

  it('every poster is a real 1280×720 WebP, smaller than the old JPEG budget', () => {
    let total = 0
    for (const file of files) {
      const buffer = readFileSync(path.join(dir, file))
      assert.deepEqual(webpSize(buffer), { width: 1280, height: 720 }, file)
      total += statSync(path.join(dir, file)).size
    }
    assert.ok(total < 2_000_000, `posters total ${total} bytes (JPEG set was 2.88 MB)`)
  })

  it('every poster is referenced by exactly one video and every video has one', () => {
    const referenced = PORTFOLIO.flatMap((e) => (e.video ? [mediaFilePath(e.video.poster)] : []))
    assert.equal(referenced.length, 20)
    assert.equal(new Set(referenced).size, 20)
    assert.deepEqual([...referenced].sort(), files.map((f) => `/videos/work/posters/${f}`).sort())
  })

  it('the visual asset manifest documents WebP posters', () => {
    const manifest = readFileSync(path.join(ROOT, 'docs/VISUAL_ASSET_MANIFEST.md'), 'utf8')
    assert.match(manifest, /videos\/work\/posters\/<slug>\.webp/)
    assert.doesNotMatch(manifest, /videos\/work\/posters\/<slug>\.jpg/)
  })
})
