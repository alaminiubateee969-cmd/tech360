import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SERVICES, INDUSTRIES } from '../src/data/site'
import { WORK_EXAMPLES } from '../src/data/work-examples'
import {
  FORBIDDEN_CLAIM_PATTERNS,
  PROJECT_DETAILS,
  PROJECT_DETAIL_NOTICE,
  getProjectDetail,
  isProjectSlug,
  relatedProjects,
} from '../src/data/work-details'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '../src/lib/public-route-catalog'

/**
 * Dedicated project detail pages.
 *
 * Phase 4 requires a page per project with a fixed section set. The pages are
 * real routes now, and these tests keep the two risks in check: a route that
 * resolves without content, and copy that turns a specification into a claim.
 */

describe('project detail pages', () => {
  it('ships one detail record per showcase project', () => {
    assert.equal(WORK_EXAMPLES.length, 12)
    assert.equal(PROJECT_DETAILS.length, 12)
    for (const example of WORK_EXAMPLES) {
      assert.ok(getProjectDetail(example.slug), `missing detail for ${example.slug}`)
      assert.ok(isProjectSlug(example.slug))
    }
  })

  it('has no detail record without a matching showcase', () => {
    for (const detail of PROJECT_DETAILS) {
      assert.ok(
        WORK_EXAMPLES.some((example) => example.slug === detail.slug),
        `${detail.slug} has a detail page but no showcase entry`,
      )
    }
  })

  it('resolves a clean public route and is listed for static generation', () => {
    const paths = new Set(getStaticPublicRoutePaths())
    for (const detail of PROJECT_DETAILS) {
      const path = `/work/projects/${detail.slug}`
      assert.ok(paths.has(path), `${path} missing from the static path list`)
      const route = resolvePublicRoute(path.split('/').filter(Boolean))
      assert.ok(route, `${path} does not resolve`)
      assert.equal(route?.kind, 'project')
      assert.equal(route?.path, path)
      assert.equal(route?.noIndex, undefined)
    }
  })

  it('rejects unknown, malformed and nested project slugs', () => {
    assert.equal(resolvePublicRoute(['work', 'projects', 'not-a-project']), null)
    assert.equal(resolvePublicRoute(['work', 'projects', '../admin']), null)
    assert.equal(resolvePublicRoute(['work', 'projects', 'ecommerce-storefront', 'extra']), null)
  })

  it('covers every required detail section with non-empty content', () => {
    for (const detail of PROJECT_DETAILS) {
      const sections: [string, unknown[]][] = [
        ['users', detail.users],
        ['problem', detail.problem],
        ['objectives', detail.objectives],
        ['platforms', detail.platforms],
        ['journey', detail.journey],
        ['roles', detail.roles],
        ['dataEntities', detail.dataEntities],
        ['apiSurface', detail.apiSurface],
        ['integrations', detail.integrations],
        ['ai', detail.ai],
        ['security', detail.security],
        ['quality', detail.quality],
        ['deployment', detail.deployment],
        ['maintenance', detail.maintenance],
        ['advanced', detail.advanced],
        ['relatedServices', detail.relatedServices],
      ]
      for (const [name, value] of sections) {
        assert.ok(Array.isArray(value) && value.length > 0, `${detail.slug}.${name} is empty`)
      }
    }
  })

  it('links only to services and industries that exist', () => {
    const serviceSlugs = new Set(SERVICES.map((service) => service.slug))
    const industrySlugs = new Set(INDUSTRIES.map((industry) => industry.slug))
    for (const detail of PROJECT_DETAILS) {
      for (const slug of detail.relatedServices) {
        assert.ok(serviceSlugs.has(slug), `${detail.slug} references unknown service ${slug}`)
      }
      if (detail.industrySlug) {
        assert.ok(
          industrySlugs.has(detail.industrySlug),
          `${detail.slug} references unknown industry ${detail.industrySlug}`,
        )
      }
    }
  })

  it('contains no unverifiable outcome claims', () => {
    for (const detail of PROJECT_DETAILS) {
      const text = JSON.stringify(detail)
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        assert.doesNotMatch(text, pattern, `${detail.slug} contains a forbidden claim matching ${pattern}`)
      }
    }
  })

  it('states the honesty notice and excludes the current project from related links', () => {
    assert.match(PROJECT_DETAIL_NOTICE, /not a delivered client project/i)
    for (const detail of PROJECT_DETAILS) {
      const related = relatedProjects(detail.slug)
      assert.ok(!related.includes(detail.slug))
    }
  })
})
