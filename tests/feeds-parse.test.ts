/**
 * TECH360 — Feed Hub parser tests.
 * Hostile input is the normal case for a public feed: scripts must be stripped,
 * entities decoded to text, and unparseable bodies reported honestly.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectFeedKind, discoverFeedLinks, ideaFromItem, parseFeed, stripHtml } from '../src/lib/feeds/parse'

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>UK Immigration News</title>
  <item>
    <title>New skilled worker rules &amp; the impact on sponsors</title>
    <link>https://example.com/news/1</link>
    <guid>https://example.com/news/1</guid>
    <pubDate>Tue, 30 Sep 2026 09:00:00 GMT</pubDate>
    <description><![CDATA[<p>The Home Office confirmed <b>changes</b>.</p><script>alert(1)</script>]]></description>
    <category>Immigration</category>
  </item>
  <item>
    <title>Second item</title>
    <link>https://example.com/news/2</link>
    <guid>example-2</guid>
    <description>Plain summary</description>
  </item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Tech360 Insights</title>
  <entry>
    <title>Why CRM implementations fail</title>
    <link rel="alternate" href="https://example.org/a"/>
    <id>tag:example.org,2026:a</id>
    <updated>2026-09-29T10:00:00Z</updated>
    <summary>Partly because nobody owns the data.</summary>
    <category term="CRM"/>
  </entry>
</feed>`

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Market Signals',
  items: [
    { id: '1', url: 'https://example.net/p/1', title: 'Funding round announced', summary: 'Series A closed.', date_published: '2026-09-28T08:00:00Z', tags: ['funding'] },
  ],
})

describe('feeds: kind detection', () => {
  it('detects RSS, Atom and JSON Feeds', () => {
    assert.equal(detectFeedKind(RSS), 'RSS')
    assert.equal(detectFeedKind(ATOM), 'ATOM')
    assert.equal(detectFeedKind(JSON_FEED), 'JSON')
  })

  it('returns null for a non-feed body', () => {
    assert.equal(detectFeedKind('<html><body>Hello</body></html>'), null)
  })
})

describe('feeds: RSS parsing', () => {
  const parsed = parseFeed(RSS)
  it('parses items with guid, title, link and date', () => {
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.kind, 'RSS')
    assert.equal(parsed.title, 'UK Immigration News')
    assert.equal(parsed.items.length, 2)
    assert.equal(parsed.items[0].guid, 'https://example.com/news/1')
    assert.equal(parsed.items[0].link, 'https://example.com/news/1')
    assert.ok(parsed.items[0].publishedAt instanceof Date)
    assert.deepEqual(parsed.items[0].tags, ['Immigration'])
  })

  it('decodes entities and strips markup and scripts from summaries', () => {
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const summary = parsed.items[0].summary ?? ''
    assert.ok(summary.includes('New skilled worker rules & the impact') || summary.includes('Home Office confirmed changes'))
    assert.ok(!summary.includes('<p>'), 'HTML tags must be stripped')
    assert.ok(!/alert\(1\)/.test(summary), 'script content must be stripped')
  })
})

describe('feeds: Atom parsing', () => {
  const parsed = parseFeed(ATOM)
  it('reads the alternate link href, id and updated date', () => {
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.kind, 'ATOM')
    assert.equal(parsed.items[0].link, 'https://example.org/a')
    assert.equal(parsed.items[0].guid, 'tag:example.org,2026:a')
    assert.ok(parsed.items[0].publishedAt instanceof Date)
    assert.deepEqual(parsed.items[0].tags, ['CRM'])
  })
})

describe('feeds: JSON Feed parsing', () => {
  const parsed = parseFeed(JSON_FEED, 'application/json')
  it('maps JSON Feed fields onto the normalised item shape', () => {
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.kind, 'JSON')
    assert.equal(parsed.title, 'Market Signals')
    assert.equal(parsed.items[0].title, 'Funding round announced')
    assert.equal(parsed.items[0].link, 'https://example.net/p/1')
    assert.deepEqual(parsed.items[0].tags, ['funding'])
  })
})

describe('feeds: honest failure reporting', () => {
  it('rejects an empty body', () => {
    const parsed = parseFeed('')
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.match(parsed.reason, /Empty/)
  })

  it('rejects HTML that is not a feed', () => {
    const parsed = parseFeed('<html><body>hi</body></html>')
    assert.equal(parsed.ok, false)
  })

  it('reports a malformed JSON payload', () => {
    const parsed = parseFeed('{"version":"x",}', 'application/json')
    assert.equal(parsed.ok, false)
  })

  it('reports an XML feed with no items', () => {
    const parsed = parseFeed('<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>')
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.match(parsed.reason, /No <item>/)
  })
})

describe('feeds: helpers', () => {
  it('strips tags from arbitrary markup', () => {
    assert.equal(stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world')
  })

  it('discovers feed links from a page head', () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      <link rel="alternate" type="application/atom+xml" href="https://example.com/atom.xml">
      <link rel="stylesheet" href="/style.css">
    </head></html>`
    assert.deepEqual(discoverFeedLinks(html, 'https://example.com/blog/'), [
      'https://example.com/feed.xml',
      'https://example.com/atom.xml',
    ])
  })

  it('turns a signal into an original idea, not a copy', () => {
    const idea = ideaFromItem({ guid: 'g', title: 'New rules', link: 'https://x.example/1', summary: 'Summary', publishedAt: null, tags: [] }, 'UK news')
    assert.match(idea.title, /New rules/)
    assert.match(idea.body, /never republish|original copy/i)
    assert.match(idea.body, /https:\/\/x\.example\/1/)
  })
})
