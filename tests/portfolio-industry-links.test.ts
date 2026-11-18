/**
 * Regression: portfolio pages must not link to a broken industry page.
 * `/industries/education` used to return HTTP 500 (its registry payload failed
 * validation), so portfolio links were substituted. The payload is repaired, so
 * education links to its own page again. portfolioIndustryLink() keeps the
 * substitution mechanism for any future broken sector.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { BLUEPRINT_DETAILS } from '../src/data/blueprint-details'
import { INDUSTRY_REGISTRY } from '../src/data/industries'
import { validateIndustrySolution } from '../src/data/industries/types'
import { INDUSTRIES } from '../src/data/site'
import { PROJECT_DETAILS } from '../src/data/work-details'
import { INDUSTRY_LINK_REDIRECTS, portfolioIndustryLink } from '../src/lib/portfolio/industry-links'

/** An industry page renders when it has no registry payload, or its payload validates. */
function industryPageIsHealthy(slug: string): boolean {
  const entry = INDUSTRY_REGISTRY.find((e) => e.slug === slug)
  return !entry || validateIndustrySolution(entry).length === 0
}

const portfolioIndustrySlugs = [
  ...BLUEPRINT_DETAILS.map((d) => d.industrySlug),
  ...PROJECT_DETAILS.map((d) => d.industrySlug),
].filter((slug): slug is string => Boolean(slug))

describe('portfolio industry links — no broken education link', () => {
  it('the portfolio really does reference the education industry (test is meaningful)', () => {
    assert.ok(portfolioIndustrySlugs.includes('education'))
  })

  it('every industry link rendered by portfolio pages points at a healthy page', () => {
    for (const slug of portfolioIndustrySlugs) {
      const link = portfolioIndustryLink(slug)
      if (!link) continue
      assert.ok(industryPageIsHealthy(link.slug), `${slug} → ${link.href} is a broken page`)
    }
  })

  it('education payload validates and education links to its own page again', () => {
    assert.equal(industryPageIsHealthy('education'), true, '/industries/education payload must validate')
    const link = portfolioIndustryLink('education')
    assert.ok(link)
    assert.equal(link.href, '/industries/education')
    assert.equal(link.title, 'Education')
    assert.equal(link.sourceTitle, 'Education')
    assert.equal(link.substituted, false)
  })

  it('redirect targets are healthy; sources are still broken (delete the entry once fixed)', () => {
    for (const [source, target] of Object.entries(INDUSTRY_LINK_REDIRECTS)) {
      assert.ok(INDUSTRIES.some((i) => i.slug === target), `${target} is not a known industry`)
      assert.ok(industryPageIsHealthy(target), `${target} must render`)
      assert.equal(
        industryPageIsHealthy(source),
        false,
        `/industries/${source} validates now — remove it from INDUSTRY_LINK_REDIRECTS so links go back to it`,
      )
    }
  })

  it('every other industry keeps its own link, unchanged', () => {
    for (const slug of portfolioIndustrySlugs.filter((s) => !(s in INDUSTRY_LINK_REDIRECTS))) {
      const link = portfolioIndustryLink(slug)
      assert.ok(link, `${slug} lost its link`)
      assert.equal(link.href, `/industries/${slug}`)
      assert.equal(link.substituted, false)
    }
  })

  it('unknown or empty slugs render no link (plain text stays)', () => {
    assert.equal(portfolioIndustryLink(undefined), undefined)
    assert.equal(portfolioIndustryLink(''), undefined)
    assert.equal(portfolioIndustryLink('does-not-exist'), undefined)
  })

  it('portfolio views build industry hrefs only through the helper', () => {
    for (const file of ['BlueprintDetailView.tsx', 'ProjectDetailView.tsx', 'WorkView.tsx', 'PortfolioCard.tsx', 'PortfolioSpotlight.tsx', 'PortfolioExplorer.tsx']) {
      const source = readFileSync(new URL(`../src/components/site/${file}`, import.meta.url), 'utf8')
      assert.doesNotMatch(source, /\/industries\/\$\{/, `${file} builds an industry href directly`)
      assert.doesNotMatch(source, /\/industries\/education\b/, `${file} hard-codes the broken education link`)
    }
  })
})
