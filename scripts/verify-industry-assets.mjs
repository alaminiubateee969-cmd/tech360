#!/usr/bin/env node
/**
 * TECH360 — Global Industries Platform asset gate
 *
 * WHY THIS EXISTS
 * ---------------
 * The 20 industry payloads in `src/data/industries/` advertise `visualAssets`
 * (1 hero + 3 UI screens each = 81 assets). Those payloads originally pointed
 * at `/images/industries/<slug>-hero.jpg` and `<slug>-ui-0N.jpg` files that
 * were never committed, so every one of the 81 references 404'd, and one
 * screen carried a hardcoded development path (`/home/user/…-placeholder`).
 *
 * `src/data/industries/shared.ts` now resolves every slot to a photograph that
 * really exists under `public/`. This script is the guard: it loads the
 * registry and fails loudly if any asset path is absolute-remote, leaves
 * `public/`, or does not exist on disk.
 *
 * Usage: node scripts/verify-industry-assets.mjs
 * Exit 0 = every referenced asset exists. Exit 1 = at least one is broken.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TAILWIND_SAFE_PATH = /^\/(?:images|assets)\/[A-Za-z0-9._/-]+$/

/**
 * The registry is TypeScript. Rather than adding a build step, read the two
 * resolver sources and confirm they only emit committed paths, then check the
 * generated asset paths through the same tables they use.
 */
function read(file) {
  return readFileSync(join(ROOT, file), 'utf8')
}

const problems = []

// 1. No hardcoded development/absolute filesystem paths anywhere in the payloads.
const payloadDir = join(ROOT, 'src', 'data', 'industries')
const payloadFiles = []
for (const entry of readdirSync(payloadDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    for (const nested of readdirSync(join(payloadDir, entry.name))) {
      if (nested.endsWith('.ts')) payloadFiles.push(join('src', 'data', 'industries', entry.name, nested))
    }
  } else if (entry.name.endsWith('.ts')) {
    payloadFiles.push(join('src', 'data', 'industries', entry.name))
  }
}

for (const file of payloadFiles) {
  const text = read(file)
  for (const match of text.matchAll(/path:\s*[`"']([^`"']+)[`"']/g)) {
    const value = match[1]
    if (/\$\{/.test(value)) continue // template paths are covered by the resolver checks below
    // ValidationIssue objects use `path:` for a *field* name, not a file.
    if (!/\.(?:jpg|jpeg|png|webp|svg|gif|avif|ico)$/i.test(value) && !value.startsWith('/')) continue
    if (/^https?:/i.test(value) || /^(?:[A-Za-z]:\\|\/home\/|\/Users\/|\/tmp\/)/.test(value) || !value.startsWith('/')) {
      problems.push(`${file}: non-public or absolute asset path "${value}"`)
    } else if (!TAILWIND_SAFE_PATH.test(value)) {
      problems.push(`${file}: asset path outside /images or /assets "${value}"`)
    }
  }
}

// 2. Every path the shared resolver can emit must exist under public/.
const shared = read('src/data/industries/shared.ts')

/** Parse `KEY: "path"` entries out of a TypeScript object literal. */
function stringMap(source, constName) {
  const start = source.indexOf(`const ${constName}`)
  if (start === -1) return new Map()
  const open = source.indexOf('{', start)
  const close = source.indexOf('\n}', open)
  if (open === -1 || close === -1) return new Map()
  const map = new Map()
  for (const m of source.slice(open, close).matchAll(/(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:\s*['"]([^'"]+)['"]/g)) {
    map.set(m[1] ?? m[2] ?? m[3], m[4])
  }
  return map
}

// The hero source of truth is industry-images.ts (the INDUSTRY_IMAGES map);
// shared.ts imports it. The fallback lives in shared.ts.
const heroMap = stringMap(read('src/data/industry-images.ts'), 'INDUSTRY_IMAGES')
const uiBlock = shared.match(/const COMMITTED_UI_IMAGES\s*=\s*\[([\s\S]*?)\]/)
const uiImages = uiBlock
  ? [...uiBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : []

if (heroMap.size === 0) problems.push('src/data/industry-images.ts: INDUSTRY_IMAGES is empty or unreadable')
if (uiImages.length === 0) problems.push('src/data/industries/shared.ts: COMMITTED_UI_IMAGES is empty or unreadable')
if (!/import\s*\{\s*INDUSTRY_IMAGES\s*\}\s*from\s*"\.\.\/industry-images"/.test(shared)) {
  problems.push('src/data/industries/shared.ts: expected the hero resolver to import INDUSTRY_IMAGES from ../industry-images')
}

const heroFallback = shared.match(/const HERO_FALLBACK_IMAGE\s*=\s*"([^"]+)"/)
if (!heroFallback) problems.push('src/data/industries/shared.ts: HERO_FALLBACK_IMAGE is missing')

const referenced = new Set([...heroMap.values(), ...uiImages, ...(heroFallback ? [heroFallback[1]] : [])])
for (const path of referenced) {
  if (!existsSync(join(ROOT, 'public', path.slice(1)))) {
    problems.push(`missing file on disk: public${path}`)
  }
}

// 3. Every slug the registry pins must be able to resolve a hero image.
const indexSource = read('src/data/industries/index.ts')
const pinnedBlock = indexSource.match(/PINNED_SLUG_ORDER\s*=\s*\[([\s\S]*?)\]/)
const pinnedSlugs = pinnedBlock ? [...pinnedBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []
if (pinnedSlugs.length !== 20) {
  problems.push(`src/data/industries/index.ts: expected 20 pinned slugs, found ${pinnedSlugs.length}`)
}
for (const slug of pinnedSlugs) {
  if (!heroMap.has(slug)) {
    problems.push(`slug "${slug}" has no committed hero image (falls back to ${heroFallback?.[1] ?? 'unknown'})`)
  }
}

if (problems.length > 0) {
  console.error(`✗ industry assets: ${problems.length} problem(s)`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const publicFiles = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else publicFiles.push(full)
  }
}
walk(join(ROOT, 'public'))

console.log(
  `✓ industry assets: ${pinnedSlugs.length} industry slugs, ${heroMap.size} hero photographs, ` +
    `${uiImages.length} UI screens — every referenced path exists under public/ ` +
    `(${publicFiles.length} public files, ${Math.round(statSync(join(ROOT, 'public')).size / 1024)} entries) ` +
    `[${relative(ROOT, join(ROOT, 'public'))}]`,
)
