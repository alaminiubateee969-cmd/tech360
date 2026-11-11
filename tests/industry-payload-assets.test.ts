import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { INDUSTRY_REGISTRY } from '../src/data/industries'
import { committedIndustryHero, committedIndustryUi } from '../src/data/industries/shared'

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')
const PAYLOAD_DIR = join(import.meta.dirname, '..', 'src', 'data', 'industries')

function onDisk(path: string): boolean {
  return path.startsWith('/') && existsSync(join(PUBLIC_DIR, path.slice(1)))
}

/**
 * The 20 industry payloads previously advertised `/images/industries/*-hero.jpg`
 * and `*-ui-0N.jpg` files that were never committed (81 of 81 missing), and one
 * screen carried a hardcoded `/home/user/…-placeholder` path. These tests pin the
 * fix: every advertised asset must be a self-hosted file that really exists.
 */
describe('Global Industries Platform — every advertised asset is a committed file', () => {
  it('ships 20 industries with 81 visual assets that all exist under public/', () => {
    assert.equal(INDUSTRY_REGISTRY.length, 20)
    let total = 0
    for (const entry of INDUSTRY_REGISTRY) {
      for (const asset of entry.visualAssets) {
        total += 1
        assert.ok(asset.path.startsWith('/'), `${entry.slug} asset must be local: ${asset.path}`)
        assert.equal(/^https?:/i.test(asset.path), false, `${entry.slug} must not use a remote asset: ${asset.path}`)
        assert.ok(onDisk(asset.path), `missing file on disk: public${asset.path} (${entry.slug})`)
      }
    }
    assert.equal(total, 81)
  })

  it('resolves the hero image and every UI screen of every payload to a real file', () => {
    for (const entry of INDUSTRY_REGISTRY) {
      assert.ok(onDisk(entry.data.hero.image.path), `${entry.slug}: hero image missing (${entry.data.hero.image.path})`)
      assert.ok(entry.data.uiScreens.length > 0, `${entry.slug}: expected UI screens`)
      for (const screen of entry.data.uiScreens) {
        assert.ok(onDisk(screen.asset.path), `${entry.slug}/${screen.title}: ${screen.asset.path}`)
      }
    }
  })

  it('never emits a development filesystem path from the shared asset resolvers', () => {
    const slugs = INDUSTRY_REGISTRY.map((entry) => entry.slug)
    for (const slug of slugs) {
      for (const path of [committedIndustryHero(slug), committedIndustryUi(slug, 1), committedIndustryUi(slug, 4)]) {
        assert.match(path, /^\/images\/[A-Za-z0-9._/-]+$/)
        assert.equal(/\/(home|Users|tmp)\//.test(path), false, `dev path leaked: ${path}`)
        assert.ok(onDisk(path), `resolver emitted a missing file: ${path}`)
      }
    }
    // Unknown slugs must still resolve to a real file, never to undefined.
    assert.ok(onDisk(committedIndustryHero('not-a-real-industry')))
  })

  it('keeps the payload sources free of hardcoded placeholder or absolute asset paths', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.ts')) files.push(full)
      }
    }
    walk(PAYLOAD_DIR)
    assert.ok(files.length >= 18, 'expected the industry payload sources')
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      // A real placeholder is an asset path containing the word — comments that
      // explain the historical fix are fine.
      assert.equal(
        /path:\s*[`"'][^`"']*placeholder[^`"']*[`"']/i.test(text),
        false,
        `${file} still points an asset at a placeholder path`,
      )
      for (const match of text.matchAll(/path:\s*[`"']([^`"']+)[`"']/g)) {
        const value = match[1]
        if (/\$\{/.test(value)) continue
        if (!/\.(?:jpg|jpeg|png|webp|svg|gif|avif|ico)$/i.test(value) && !value.startsWith('/')) continue
        assert.ok(value.startsWith('/'), `${file}: asset path must be public: ${value}`)
        assert.equal(/^https?:/i.test(value), false, `${file}: remote asset path: ${value}`)
      }
    }
  })
})
