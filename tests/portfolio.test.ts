import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { CASE_STUDIES, INDUSTRIES, SERVICES } from '../src/data/site'
import { WORK_EXAMPLES } from '../src/data/work-examples'
import { FORBIDDEN_CLAIM_PATTERNS } from '../src/data/work-details'
import { BLUEPRINT_DETAILS, BLUEPRINT_DETAIL_NOTICE, getBlueprintDetail } from '../src/data/blueprint-details'
import {
  PORTFOLIO,
  PORTFOLIO_CAPABILITIES,
  PORTFOLIO_INDUSTRIES,
  PROVENANCE,
  adjacentPortfolio,
  featuredPortfolio,
  getPortfolioEntry,
  portfolioStats,
  queryPortfolio,
  relatedPortfolio,
} from '../src/data/portfolio'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '../src/lib/public-route-catalog'
import { pageGraph } from '../src/lib/structured-data'

const ROOT = path.join(import.meta.dirname, '..')
// Media URLs may carry a `?v=<content-hash>` cache-busting query; strip it for the disk path.
const publicFile = (src: string) => path.join(ROOT, 'public', src.split('?')[0].replace(/^\//, ''))

/** Reads width/height from an MP4 `tkhd` box and duration from `mvhd`. */
function mp4Info(file: string) {
  const buf = readFileSync(file)
  const mvhd = buf.indexOf('mvhd')
  const version = buf[mvhd + 4]
  // v0: version/flags(4) creation(4) modification(4) timescale(4) duration(4)
  // v1: version/flags(4) creation(8) modification(8) timescale(4) duration(8)
  const timescale = version === 1 ? buf.readUInt32BE(mvhd + 24) : buf.readUInt32BE(mvhd + 16)
  const duration = version === 1 ? Number(buf.readBigUInt64BE(mvhd + 28)) : buf.readUInt32BE(mvhd + 20)
  const tkhd = buf.lastIndexOf('tkhd')
  const tkVersion = buf[tkhd + 4]
  const dims = tkhd + (tkVersion === 1 ? 88 : 76) + 4
  return {
    seconds: duration / timescale,
    width: buf.readUInt32BE(dims) >> 16,
    height: buf.readUInt32BE(dims + 4) >> 16,
    faststart: buf.indexOf('moov') < buf.indexOf('mdat'),
  }
}

describe('portfolio index', () => {
  it('contains every system scenario and every delivery blueprint exactly once', () => {
    assert.equal(PORTFOLIO.length, WORK_EXAMPLES.length + CASE_STUDIES.length)
    const keys = PORTFOLIO.map((entry) => `${entry.kind}:${entry.slug}`)
    assert.equal(new Set(keys).size, keys.length)
    for (const example of WORK_EXAMPLES) assert.ok(getPortfolioEntry('system', example.slug), example.slug)
    for (const study of CASE_STUDIES) assert.ok(getPortfolioEntry('blueprint', study.slug), study.slug)
  })

  it('uses only the published taxonomy', () => {
    for (const entry of PORTFOLIO) {
      assert.ok((PORTFOLIO_INDUSTRIES as readonly string[]).includes(entry.industry), `${entry.slug}: ${entry.industry}`)
      assert.ok(entry.capabilities.length > 0, `${entry.slug} has no capability`)
      for (const capability of entry.capabilities) {
        assert.ok((PORTFOLIO_CAPABILITIES as readonly string[]).includes(capability), `${entry.slug}: ${capability}`)
      }
      assert.ok(entry.stages.length >= 3, `${entry.slug} needs workflow stages`)
    }
  })

  it('never leaves an industry or capability filter empty', () => {
    for (const industry of PORTFOLIO_INDUSTRIES) {
      assert.ok(queryPortfolio({ industry }).length > 0, `empty industry filter: ${industry}`)
    }
    for (const capability of PORTFOLIO_CAPABILITIES) {
      assert.ok(queryPortfolio({ capability }).length > 0, `empty capability filter: ${capability}`)
    }
  })

  it('filters by kind, combines facets and searches stages and technologies', () => {
    assert.equal(queryPortfolio({ kind: 'system' }).length, WORK_EXAMPLES.length)
    assert.equal(queryPortfolio({ kind: 'blueprint' }).length, CASE_STUDIES.length)
    assert.equal(queryPortfolio({ kind: 'all' }).length, PORTFOLIO.length)
    const healthcare = queryPortfolio({ industry: 'Healthcare', kind: 'blueprint' })
    assert.deepEqual(healthcare.map((entry) => entry.slug), ['clinic-appointment-automation'])
    assert.ok(queryPortfolio({ q: 'whatsapp' }).length >= 2)
    assert.ok(queryPortfolio({ q: 'SMS reminder' }).some((entry) => entry.slug === 'clinic-appointment-automation'))
    assert.equal(queryPortfolio({ q: 'zzzz-no-match' }).length, 0)
  })

  it('ranks related work without returning the current entry, and wraps prev/next within a kind', () => {
    for (const entry of PORTFOLIO) {
      const related = relatedPortfolio(entry, 3)
      assert.equal(related.length, 3)
      assert.ok(!related.includes(entry))
      const { previous, next } = adjacentPortfolio(entry)
      assert.equal(previous.kind, entry.kind)
      assert.equal(next.kind, entry.kind)
      assert.notEqual(next.slug, entry.slug)
    }
  })

  it('exposes only data-derived counts and a resolvable featured set', () => {
    const stats = portfolioStats()
    assert.equal(stats.total, PORTFOLIO.length)
    assert.equal(stats.videos, PORTFOLIO.length)
    const featured = featuredPortfolio()
    assert.ok(featured.length >= 3)
    for (const entry of featured) assert.equal(entry.featured, true)
  })
})

describe('portfolio media', () => {
  it('labels every image and video with a known provenance and never claims client evidence without it', () => {
    for (const entry of PORTFOLIO) {
      for (const image of [entry.cover, ...entry.gallery]) {
        assert.ok(PROVENANCE[image.provenance], `${entry.slug}: unknown provenance`)
        assert.notEqual(image.provenance, 'client-evidence', `${entry.slug}: no authorised client evidence exists yet`)
        assert.ok(image.alt.length >= 40, `${entry.slug}: alt text too short`)
        assert.ok(image.caption.length > 20, `${entry.slug}: caption missing`)
      }
      if (entry.video) assert.equal(entry.video.provenance, 'motion-preview')
    }
  })

  it('ships every cover, small variant, poster and video as a real local file', () => {
    for (const entry of PORTFOLIO) {
      const files = [entry.cover.src, entry.cover.srcSmall, ...entry.gallery.map((image) => image.src)]
      if (entry.video) files.push(entry.video.src, entry.video.poster)
      for (const src of files) {
        if (!src) continue
        assert.ok(src.startsWith('/'), `${src} must be self-hosted`)
        assert.ok(existsSync(publicFile(src)), `missing file ${src}`)
        assert.ok(statSync(publicFile(src)).size > 10_000, `${src} is too small to be real`)
      }
    }
  })

  it('gives every blueprint a unique cover distinct from its architecture diagram', () => {
    const covers = new Set<string>()
    for (const study of CASE_STUDIES) {
      const entry = getPortfolioEntry('blueprint', study.slug)!
      assert.ok(!covers.has(entry.cover.src))
      covers.add(entry.cover.src)
      const diagram = entry.gallery.find((image) => image.provenance === 'architecture-diagram')
      assert.ok(diagram, `${study.slug} lost its architecture diagram`)
      assert.notEqual(diagram!.src, entry.cover.src)
    }
  })

  it('encodes videos as web-safe, fast-start 1280×720 MP4 matching the declared duration', () => {
    for (const entry of PORTFOLIO) {
      if (!entry.video) continue
      const info = mp4Info(publicFile(entry.video.src))
      assert.equal(info.width, entry.video.width, `${entry.slug} width`)
      assert.equal(info.height, entry.video.height, `${entry.slug} height`)
      assert.ok(Math.abs(info.seconds - entry.video.durationSeconds) < 0.6, `${entry.slug} duration ${info.seconds}`)
      assert.ok(info.faststart, `${entry.slug} must have moov before mdat (+faststart)`)
      assert.ok(statSync(publicFile(entry.video.src)).size < 1_200_000, `${entry.slug} video is too heavy`)
      assert.match(entry.video.description, /not (a recording|footage)/i)
    }
  })
})

describe('delivery blueprint pages', () => {
  it('has one detail record per blueprint with valid cross-links', () => {
    assert.equal(BLUEPRINT_DETAILS.length, CASE_STUDIES.length)
    const services = new Set(SERVICES.map((service) => service.slug))
    const industries = new Set(INDUSTRIES.map((industry) => industry.slug))
    const projects = new Set(WORK_EXAMPLES.map((example) => example.slug))
    for (const study of CASE_STUDIES) {
      const detail = getBlueprintDetail(study.slug)
      assert.ok(detail, `missing blueprint detail for ${study.slug}`)
      assert.equal(detail!.stages.length, 4)
      assert.ok(detail!.measurementPlan.length >= 2)
      assert.ok(industries.has(detail!.industrySlug), `${study.slug}: unknown industry ${detail!.industrySlug}`)
      assert.ok(projects.has(detail!.relatedProject), `${study.slug}: unknown project ${detail!.relatedProject}`)
      for (const slug of detail!.relatedServices) assert.ok(services.has(slug), `${study.slug}: unknown service ${slug}`)
    }
  })

  it('contains no unverifiable outcome claims and states the limitation', () => {
    for (const detail of BLUEPRINT_DETAILS) {
      const text = JSON.stringify(detail)
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) assert.doesNotMatch(text, pattern, `${detail.slug} matches ${pattern}`)
      assert.doesNotMatch(text, /\b\d+\s?%/, `${detail.slug} states a percentage`)
    }
    assert.match(BLUEPRINT_DETAIL_NOTICE, /not a named client engagement/i)
    assert.match(BLUEPRINT_DETAIL_NOTICE, /no measured outcome/i)
  })

  it('resolves clean routes, lists them for static generation and rejects unknown slugs', () => {
    const paths = new Set(getStaticPublicRoutePaths())
    for (const study of CASE_STUDIES) {
      const route = resolvePublicRoute(['work', 'case-studies', study.slug])
      assert.equal(route?.kind, 'blueprint')
      assert.equal(route?.path, `/work/case-studies/${study.slug}`)
      assert.ok(paths.has(`/work/case-studies/${study.slug}`))
    }
    assert.equal(resolvePublicRoute(['work', 'case-studies', 'not-real']), null)
    assert.equal(resolvePublicRoute(['work', 'case-studies', '../admin']), null)
    assert.equal(resolvePublicRoute(['work', 'case-studies', 'agency-client-portal', 'x']), null)
  })

  it('emits page, breadcrumb, creative-work and video structured data for every portfolio page', () => {
    for (const entry of PORTFOLIO) {
      const nodes = pageGraph(entry.href, { title: entry.title, description: entry.summary }) as Array<Record<string, unknown>> | null
      assert.ok(nodes, `${entry.href} has no structured data`)
      const types = nodes!.map((node) => node['@type'])
      for (const type of ['WebPage', 'BreadcrumbList', 'CreativeWork', 'VideoObject']) {
        assert.ok(types.includes(type), `${entry.href} missing ${type}`)
      }
      assert.ok(!types.includes('Review') && !types.includes('AggregateRating'), 'no review markup for illustrative work')
      const video = nodes!.find((node) => node['@type'] === 'VideoObject')!
      assert.match(String(video.duration), /^PT\d+S$/)
      assert.ok(String(video.uploadDate).match(/^\d{4}-\d{2}-\d{2}$/))
    }
  })
})
