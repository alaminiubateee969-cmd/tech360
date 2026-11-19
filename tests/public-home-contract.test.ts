import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'

const root = resolve(__dirname, '..')
const home = readFileSync(resolve(root, 'src/components/site/HomeView.tsx'), 'utf8')
const buttons = readFileSync(resolve(root, 'src/components/site/buttons.tsx'), 'utf8')
const page = readFileSync(resolve(root, 'src/app/page.tsx'), 'utf8')
const shell = readFileSync(resolve(root, 'src/components/site/PublicSiteApp.tsx'), 'utf8')

describe('public homepage browser-discovered contract regressions', () => {
  it('keeps the Next root entry free of custom page props', () => {
    assert.match(page, /export default function Page\(\)/)
    assert.match(page, /import PublicSiteApp from '@\/components\/site\/PublicSiteApp'/)
    const catchAll = readFileSync(resolve(root, 'src/app/[...path]/page.tsx'), 'utf8')
    assert.match(catchAll, /import PublicSitePage from '@\/components\/site\/PublicSiteApp'/)
    assert.match(catchAll, /<PublicSitePage initialHash=\{route.path\} initialBlogPost=\{initialBlogPost\}/)
  })
  it('only references real versioned hero video assets', () => {
    const videos = [...home.matchAll(/<source\s+src="([^"?]+)"/g)].map((match) => match[1])
    assert.ok(videos.length)
    for (const video of videos) assert.equal(existsSync(resolve(root, `public${video}`)), true, `missing hero asset ${video}`)
  })
  it('uses the implemented approved-review endpoint, not a nonexistent public alias', () => {
    assert.ok(home.includes('"/api/reviews"'))
    assert.ok(!home.includes('"/api/public/reviews"'))
    assert.ok(!home.includes('rev.comment') && !home.includes('rev.authorName'), 'render the actual public review DTO')
  })
  it('uses an AA-safe foreground for shared small inline links on light backgrounds', () => {
    const arrow = buttons.slice(buttons.indexOf('export function LinkArrow'))
    assert.ok(arrow.includes('text-[#0052A5] hover:text-[#063B8F]'))
    assert.ok(!arrow.includes('"text-[#009FE3] hover:text-[#063B8F]"'))
  })
  it('uses an AA-safe solid cookie-consent control instead of white on bright cyan', () => {
    assert.ok(!/bg-\[#009FE3\][^"\n]*text-white[^"\n]*hover:bg-\[#063B8F\]/.test(shell))
  })
})
