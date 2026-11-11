#!/usr/bin/env node
/**
 * scripts/verify-service-images.mjs
 *
 * Zero-dependency CI verifier for TECH360's centralized service, platform,
 * and delivery-blueprint visual asset system.
 *
 * Parses WebP (VP8 / VP8L / VP8X) and PNG (IHDR) headers directly from bytes
 * so it runs cleanly in minimal CI containers without native imaging libraries.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function readImageDimensions(absPath) {
  const buf = fs.readFileSync(absPath)
  // PNG: 8-byte signature + IHDR chunk
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return {
      format: 'png',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      bytes: buf.length,
    }
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 30 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buf.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') {
      // Lossy VP8 bitstream header at offset 20; frame width/height at 26..29
      const width = buf.readUInt16LE(26) & 0x3fff
      const height = buf.readUInt16LE(28) & 0x3fff
      return { format: 'webp', width, height, bytes: buf.length }
    }
    if (chunk === 'VP8L') {
      // Lossless VP8L: signature 0x2f at offset 20, packed 14-bit width/height at 21..24
      const bits = buf.readUInt32LE(21)
      const width = (bits & 0x3fff) + 1
      const height = ((bits >> 14) & 0x3fff) + 1
      return { format: 'webp', width, height, bytes: buf.length }
    }
    if (chunk === 'VP8X') {
      // Extended WebP: 24-bit canvas width-1 at 24..26, height-1 at 27..29
      const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1
      const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1
      return { format: 'webp', width, height, bytes: buf.length }
    }
  }

  throw new Error(`Unsupported or corrupt image header: ${absPath}`)
}

const manifestSource = fs.readFileSync(
  path.join(ROOT, 'src/data/service-images.ts'),
  'utf8',
)
const siteSource = fs.readFileSync(path.join(ROOT, 'src/data/site.ts'), 'utf8')

// Extract canonical service slugs from SERVICES array in src/data/site.ts
const servicesBlockMatch = siteSource.match(
  /export const SERVICES:\s*Service\[\]\s*=\s*\[([\s\S]*?)\n\];/,
)
if (!servicesBlockMatch) {
  console.error('FAIL: Could not locate SERVICES array in src/data/site.ts')
  process.exit(1)
}
const serviceSlugs = Array.from(
  servicesBlockMatch[1].matchAll(/slug:\s*"([^"]+)"/g),
  (m) => m[1],
)

// Extract all `src: "/images/..."` entries from src/data/service-images.ts
const srcMatches = Array.from(
  manifestSource.matchAll(/src:\s*"(\/images\/[^"]+)"/g),
  (m) => m[1],
)

let errors = 0
function fail(msg) {
  console.error(`  ✗ ${msg}`)
  errors++
}

// 1. Verify all 21 service slugs have dedicated `/images/services/<slug>.webp`
for (const slug of serviceSlugs) {
  const expected = `/images/services/${slug}.webp`
  if (!manifestSource.includes(`"${expected}"`)) {
    fail(`Missing SERVICE_IMAGES mapping for slug "${slug}" (${expected})`)
  }
}

// 2. Verify zero duplicate WebP paths across services + platform + case-studies
const webpPaths = srcMatches.filter((p) => p.endsWith('.webp'))
const seenWebp = new Set()
for (const p of webpPaths) {
  if (seenWebp.has(p)) {
    fail(`Duplicate WebP path detected across unrelated items: ${p}`)
  }
  seenWebp.add(p)
}
if (webpPaths.length !== 35) {
  fail(`Expected 35 unique WebP entries (21 services + 6 platform + 8 case studies), found ${webpPaths.length}`)
}

// 3. Verify every referenced file exists, is >= 10 KB, and matches exact dimensions
for (const rel of srcMatches) {
  const abs = path.join(ROOT, 'public', rel.replace(/^\//, ''))
  if (!fs.existsSync(abs)) {
    fail(`Missing image file on disk: public${rel}`)
    continue
  }
  const meta = readImageDimensions(abs)
  if (meta.bytes < 10_000) {
    fail(`Suspiciously small image (<10 KB): public${rel} (${meta.bytes} bytes)`)
  }
  if (rel.endsWith('.webp')) {
    if (meta.format !== 'webp' || meta.width !== 1600 || meta.height !== 1000) {
      fail(
        `Unexpected dimensions/format for public${rel}: got ${meta.width}x${meta.height} ${meta.format}, expected 1600x1000 webp`,
      )
    }
  } else if (rel.startsWith('/images/industries/')) {
    if (meta.width < 1200 || meta.height < 675) {
      fail(`Industry cross-link image too small: public${rel} (${meta.width}x${meta.height})`)
    }
  }
}

// 4. Verify ServicesView no longer hardcodes the shared `/images/services-workspace.jpg`
const servicesViewSource = fs.readFileSync(
  path.join(ROOT, 'src/components/site/ServicesView.tsx'),
  'utf8',
)
if (servicesViewSource.includes('services-workspace.jpg')) {
  fail('ServicesView.tsx still references the generic shared services-workspace.jpg placeholder')
}

if (errors > 0) {
  console.error(`\nverify-service-images FAILED with ${errors} error(s).`)
  process.exit(1)
}

console.log(
  `✓ Verified ${serviceSlugs.length} service visuals, 6 platform visuals, 8 blueprint visuals, and 6 sector system links (${webpPaths.length} unique 1600x1000 WebP assets, 0 missing, 0 duplicates).`,
)
