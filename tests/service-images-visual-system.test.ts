import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import { CASE_STUDIES, PRODUCED_SYSTEMS, SERVICES } from '../src/data/site'
import {
  CASE_STUDY_IMAGES,
  DOCUMENTED_SHARED_ASSETS,
  PLATFORM_SHOWCASE_IMAGES,
  PRODUCED_SYSTEM_IMAGES,
  SERVICE_IMAGES,
  getServiceImage,
  serviceHeroImageAlt,
  serviceImageAlt,
  serviceImageSrc,
} from '../src/data/service-images'
import { resolvePublicRoute } from '../src/lib/public-route-catalog'
import { pageGraph, siteGraph } from '../src/lib/structured-data'

const ROOT = process.cwd()

function parseWebpDimensions(absPath: string): { width: number; height: number; bytes: number } {
  const buf = fs.readFileSync(absPath)
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP')
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      bytes: buf.length,
    }
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      bytes: buf.length,
    }
  }
  if (chunk === 'VP8X') {
    return {
      width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
      bytes: buf.length,
    }
  }
  throw new Error(`Unknown WebP chunk ${chunk} in ${absPath}`)
}

describe('TECH360 Visual Service System & Image Asset Integrity', () => {
  it('maps every single one of the 21 SERVICES to its own unique 1600×1000 WebP asset', () => {
    assert.equal(SERVICES.length, 21)
    assert.equal(Object.keys(SERVICE_IMAGES).length, SERVICES.length)

    const seenPaths = new Set<string>()
    const seenAlts = new Set<string>()

    for (const service of SERVICES) {
      const entry = getServiceImage(service.slug)
      assert.ok(entry, `Missing SERVICE_IMAGES entry for ${service.slug}`)
      assert.equal(entry.slug, service.slug)
      assert.equal(entry.src, `/images/services/${service.slug}.webp`)
      assert.equal(entry.aspect, '16/10')
      assert.equal(entry.width, 1600)
      assert.equal(entry.height, 1000)

      assert.equal(seenPaths.has(entry.src), false, `Duplicate service image path: ${entry.src}`)
      seenPaths.add(entry.src)
      assert.equal(seenAlts.has(entry.alt), false, `Duplicate service alt text on ${service.slug}`)
      seenAlts.add(entry.alt)

      assert.ok(entry.alt.trim().length > 40)
      assert.ok(entry.heroAlt.trim().length > 45)
      assert.equal(entry.alt.toLowerCase().includes('placeholder'), false)
      assert.equal(entry.alt.toLowerCase().includes('endorsed by meta'), false)
      assert.equal(entry.alt.toLowerCase().includes('official whatsapp partner'), false)

      const resolved = resolvePublicRoute(entry.href.split('/').filter(Boolean))
      assert.ok(resolved, `Invalid route ${entry.href}`)
      assert.equal(resolved.path, `/services/${service.slug}`)

      const abs = path.join(ROOT, 'public', entry.src.replace(/^\//, ''))
      assert.equal(fs.existsSync(abs), true, `Missing file on disk: ${abs}`)
      const dims = parseWebpDimensions(abs)
      assert.equal(dims.width, 1600)
      assert.equal(dims.height, 1000)
      assert.ok(dims.bytes > 20_000)

      assert.equal(serviceImageSrc(service.slug), entry.src)
      assert.equal(serviceImageAlt(service.slug), entry.alt)
      assert.equal(serviceHeroImageAlt(service.slug), entry.heroAlt)
    }
  })

  it('provides unique 1600×1000 WebP visuals for all 6 platform cards and all 8 case-study blueprints with zero cross-reuse', () => {
    assert.equal(Object.keys(PLATFORM_SHOWCASE_IMAGES).length, 6)
    assert.equal(Object.keys(CASE_STUDY_IMAGES).length, CASE_STUDIES.length)
    assert.equal(Object.keys(PRODUCED_SYSTEM_IMAGES).length, PRODUCED_SYSTEMS.length)

    const globalWebpSet = new Set<string>(Object.values(SERVICE_IMAGES).map((e) => e.src))

    for (const entry of [
      ...Object.values(PLATFORM_SHOWCASE_IMAGES),
      ...Object.values(CASE_STUDY_IMAGES),
    ]) {
      assert.equal(
        globalWebpSet.has(entry.src),
        false,
        `Duplicate WebP path reused across sections: ${entry.src}`,
      )
      globalWebpSet.add(entry.src)

      assert.ok(entry.alt.trim().length > 35)
      const abs = path.join(ROOT, 'public', entry.src.replace(/^\//, ''))
      assert.equal(fs.existsSync(abs), true, `Missing file: ${abs}`)
      const dims = parseWebpDimensions(abs)
      assert.equal(dims.width, 1600)
      assert.equal(dims.height, 1000)
      assert.ok(dims.bytes > 20_000)
    }

    assert.equal(globalWebpSet.size, 35)

    const sectorPaths = new Set<string>()
    for (const sys of PRODUCED_SYSTEMS) {
      const mapped = PRODUCED_SYSTEM_IMAGES[sys.slug]
      assert.ok(mapped, `Missing PRODUCED_SYSTEM_IMAGES for ${sys.slug}`)
      assert.equal(sectorPaths.has(mapped.src), false)
      sectorPaths.add(mapped.src)
      const abs = path.join(ROOT, 'public', mapped.src.replace(/^\//, ''))
      assert.equal(fs.existsSync(abs), true)
    }

    for (const shared of DOCUMENTED_SHARED_ASSETS) {
      assert.equal(
        fs.existsSync(path.join(ROOT, 'public', shared.path.replace(/^\//, ''))),
        true,
      )
      assert.ok(shared.justification.length > 20)
    }
  })

  it('implements the redesigned AI Solutions 3-card section and reusable ServiceCard contract', () => {
    const premiumSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/site/PremiumSections.tsx'),
      'utf8',
    )
    const homeSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/site/HomeView.tsx'),
      'utf8',
    )
    const serviceCardSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/site/ServiceCard.tsx'),
      'utf8',
    )
    const servicesViewSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/site/ServicesView.tsx'),
      'utf8',
    )
    const detailViewSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/site/ServiceDetailView.tsx'),
      'utf8',
    )

    assert.ok(homeSrc.includes('<AiSolutionsSection />'))
    assert.ok(premiumSrc.includes('title="AI Solutions"'))
    assert.ok(
      premiumSrc.includes(
        'AI you control: human-approved assistants and automation that read and write your real systems.',
      ),
    )
    assert.ok(premiumSrc.includes('AI Agent Systems'))
    assert.ok(premiumSrc.includes('/services/ai-agent-systems'))
    assert.ok(
      premiumSrc.includes('Scoped customer & operational assistants with approval guardrails.'),
    )
    assert.ok(premiumSrc.includes('AI Business Automation'))
    assert.ok(premiumSrc.includes('/services/ai-business-automation'))
    assert.ok(
      premiumSrc.includes('Document triage, routing, classification & human-verified actions.'),
    )
    assert.ok(premiumSrc.includes('WhatsApp-First AI Sales CRM'))
    assert.ok(premiumSrc.includes('/services/whatsapp-ai-sales-crm'))
    assert.ok(
      premiumSrc.includes('Shared conversational inbox, qualification & sales pipeline.'),
    )
    assert.ok(premiumSrc.includes('All AI Solutions services'))

    assert.equal(premiumSrc.toLowerCase().includes('factory export'), false)
    assert.equal(homeSrc.toLowerCase().includes('factory export'), false)

    assert.ok(serviceCardSrc.includes('focus-visible:ring-2'))
    assert.ok(serviceCardSrc.includes('motion-reduce:'))
    assert.equal(servicesViewSrc.includes('services-workspace.jpg'), false)
    assert.ok(servicesViewSrc.includes('<ServiceCard'))
    assert.ok(servicesViewSrc.includes('grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'))
    assert.ok(detailViewSrc.includes('serviceHeroImageAlt'))
    assert.ok(detailViewSrc.includes('<ServiceCard'))
  })

  it('emits dedicated service image URLs in Schema.org JSON-LD Service nodes', () => {
    const graph = pageGraph('/services/ai-agent-systems', {
      title: 'AI Agent Systems',
      description: 'Scoped customer & operational assistants with approval guardrails.',
    })
    assert.ok(graph)
    const webPage = graph.find(
      (n): n is Record<string, unknown> =>
        typeof n === 'object' && n !== null && (n as { '@type'?: string })['@type'] === 'WebPage',
    ) as { mainEntity?: { '@id'?: string } } | undefined
    assert.ok(webPage?.mainEntity?.['@id']?.includes('/services/ai-agent-systems#service'))

    const rootNodes = siteGraph()
    const serviceNodes = rootNodes.filter((n) => n['@type'] === 'Service') as Array<{
      image?: string
    }>
    const images = serviceNodes.map((n) => n.image).filter(Boolean)
    assert.equal(images.length, 21)
    assert.equal(new Set(images).size, 21)
  })
})
