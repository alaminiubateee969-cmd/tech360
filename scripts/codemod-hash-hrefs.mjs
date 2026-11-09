#!/usr/bin/env node
/**
 * One-off, reviewable codemod: turn hash-only public routes into real crawlable
 * paths.
 *
 *   href="#/services/whatsapp-automation"  →  href="/services/whatsapp-automation"
 *   href: "#/contact"                      →  href: "/contact"
 *
 * Why this is safe here: the public site keeps its hash-based navigation for
 * in-page interactions, but every public page ALSO exists as a server-rendered
 * document under src/app/[...path]. Linking to the path form means:
 *   • crawlers see real anchors to real documents,
 *   • a user without JavaScript still reaches the page,
 *   • the SPA still handles the click (see the delegated handler in page.tsx),
 *   • old "#/..." bookmarks keep working through the redirect in page.tsx.
 *
 * NOT converted: "#main-content" (skip link), any "#anchor" used for in-page
 * scrolling, and "#!/" style fragments. Only strings that begin with "#/"
 * and contain no additional "#" are rewritten.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname
const HASH_ROUTE = /(["'`])#(\/[A-Za-z0-9\-/]*[A-Za-z0-9\-])\1/g

let changed = 0
const touched = []

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(path)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    const before = await readFile(path, 'utf8')
    const after = before.replace(HASH_ROUTE, (_m, quote, route) => `${quote}${route}${quote}`)
    if (after !== before) {
      await writeFile(path, after)
      const replacements = (before.match(HASH_ROUTE) ?? []).length
      changed += replacements
      touched.push(`${path.replace(ROOT, 'src')} (${replacements})`)
    }
  }
}

await walk(ROOT)
console.log(`rewrote ${changed} hash route(s) in ${touched.length} file(s)`)
for (const line of touched) console.log('  ' + line)
