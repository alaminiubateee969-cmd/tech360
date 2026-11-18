import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

/**
 * Regression: with no published blog posts the sitemap re-appended `/blog`,
 * which is already a static entry, so crawlers saw the URL twice. The sitemap
 * must list every URL exactly once whether or not posts are published.
 */
let posts: { slug: string; publishedAt: Date; updatedAt: Date }[] = []
mock.module(new URL('../src/lib/public-blog.ts', import.meta.url).href, {
  namedExports: { listPublishedBlogSlugs: async () => posts },
})

// Loaded after the mock is registered (tests compile to CJS: no top-level await).
async function load() {
  const [{ default: sitemap }, { SITE_URL }] = await Promise.all([
    import('../src/app/sitemap'),
    import('../src/lib/site-contact'),
  ])
  return { sitemap, SITE_URL }
}

function duplicates(urls: string[]): string[] {
  const seen = new Set<string>()
  return urls.filter((u) => (seen.has(u) ? true : (seen.add(u), false)))
}

describe('sitemap.xml lists every URL exactly once', () => {
  it('no published posts: /blog appears once and no post URLs are emitted', async () => {
    posts = []
    const { sitemap, SITE_URL } = await load()
    const urls = (await sitemap()).map((e) => e.url)
    assert.deepEqual(duplicates(urls), [])
    assert.equal(urls.filter((u) => u === `${SITE_URL}/blog`).length, 1)
    assert.equal(urls.some((u) => u.startsWith(`${SITE_URL}/blog/`)), false)
  })

  it('published posts: /blog index once plus one entry per post', async () => {
    const at = new Date('2026-11-01T00:00:00Z')
    posts = [
      { slug: 'first-post', publishedAt: at, updatedAt: at },
      { slug: 'second-post', publishedAt: at, updatedAt: at },
    ]
    const { sitemap, SITE_URL } = await load()
    const urls = (await sitemap()).map((e) => e.url)
    assert.deepEqual(duplicates(urls), [])
    assert.equal(urls.filter((u) => u === `${SITE_URL}/blog`).length, 1)
    assert.ok(urls.includes(`${SITE_URL}/blog/first-post`))
    assert.ok(urls.includes(`${SITE_URL}/blog/second-post`))
  })
})
