import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { EDUCATION_SOLUTIONS } from '../src/data/education-solutions'
import { IMAGES, imageFor } from '../src/data/images'
import { INDUSTRY_IMAGES, industryImage } from '../src/data/industry-images'
import { INDUSTRIES } from '../src/data/site'

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')

describe('self-hosted industry and site photography', () => {
  it('maps every canonical industry slug to an existing self-hosted image under public/', () => {
    assert.equal(INDUSTRIES.length, 20)
    for (const industry of INDUSTRIES) {
      const path = industryImage(industry.slug)
      assert.ok(path, `missing INDUSTRY_IMAGES entry for ${industry.slug}`)
      assert.ok(path.startsWith('/images/'), `industry image for ${industry.slug} must be self-hosted: ${path}`)
      assert.ok(existsSync(join(PUBLIC_DIR, path.slice(1))), `missing file on disk: public${path}`)
    }
    assert.equal(Object.keys(INDUSTRY_IMAGES).length, 20)
  })

  it('serves every general IMAGES key from self-hosted files with zero external z-cdn dependencies', () => {
    for (const [key, paths] of Object.entries(IMAGES)) {
      assert.ok(paths.length >= 1, `IMAGES.${key} must not be empty`)
      for (const path of paths) {
        assert.ok(path.startsWith('/images/'), `IMAGES.${key} must be self-hosted: ${path}`)
        assert.equal(/chatglm|z-cdn|^https?:/i.test(path), false, `IMAGES.${key} must not use external URL ${path}`)
        assert.ok(existsSync(join(PUBLIC_DIR, path.slice(1))), `missing file on disk: public${path}`)
      }
      assert.ok(imageFor(key))
    }
  })

  it('ships valid self-hosted images for every education solution profile', () => {
    assert.equal(EDUCATION_SOLUTIONS.length, 8)
    for (const item of EDUCATION_SOLUTIONS) {
      assert.ok(item.image.startsWith('/images/'))
      assert.ok(existsSync(join(PUBLIC_DIR, item.image.slice(1))), `missing file on disk: public${item.image}`)
    }
  })

  it('marks DesignKit playground previews as illustrative UI only and disables Origin header reflection in official-info', () => {
    const designKit = readFileSync('src/components/site/DesignKitView.tsx', 'utf8')
    assert.match(designKit, /Illustrative UI only/)

    const officialInfo = readFileSync('src/app/api/official-info/route.ts', 'utf8')
    assert.equal(officialInfo.includes('req.nextUrl.origin'), false)
    assert.match(officialInfo, /minRole:\s*'ADMIN'/)
  })
})
