/**
 * Portfolio filter ⇄ URL history: src/lib/portfolio/explorer-url.ts against a
 * fake window with a real history stack. Select, Back, Forward, reload / deep
 * link, defaults, invalid values, no duplicate entries, no sync loops, both
 * URL forms (clean path and in-app hash route).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PORTFOLIO_CAPABILITIES, PORTFOLIO_INDUSTRIES } from '../src/data/portfolio'
import {
  MAX_QUERY_LENGTH,
  TYPING_BURST_MS,
  buildLocationUrl,
  createExplorerHistory,
  defaultExplorerState,
  parseExplorerState,
  readLocationQuery,
  serializeExplorerState,
  type ExplorerState,
  type HistoryWindow,
} from '../src/lib/portfolio/explorer-url'

const VOCAB = { industries: PORTFOLIO_INDUSTRIES, capabilities: PORTFOLIO_CAPABILITIES }
const IND_A = PORTFOLIO_INDUSTRIES[0]
const IND_B = PORTFOLIO_INDUSTRIES[1]
const CAP = PORTFOLIO_CAPABILITIES[0]

/** Minimal browser: a history stack, location derived from the current URL, popstate on traversal. */
class FakeWindow implements HistoryWindow {
  entries: { url: string; state: unknown }[]
  index = 0
  pushes = 0
  replaces = 0
  listeners = new Map<string, Set<() => void>>()
  constructor(url: string) {
    this.entries = [{ url, state: null }]
  }
  get location() {
    const u = new URL(this.entries[this.index].url, 'https://bdtech360.com')
    return { pathname: u.pathname, search: u.search, hash: u.hash }
  }
  get url() {
    return this.entries[this.index].url
  }
  history = {
    get state() {
      return undefined as unknown
    },
    pushState: (state: unknown, _: string, url?: string | null) => {
      this.entries = this.entries.slice(0, this.index + 1)
      this.entries.push({ url: url ?? this.url, state })
      this.index++
      this.pushes++
    },
    replaceState: (state: unknown, _: string, url?: string | null) => {
      this.entries[this.index] = { url: url ?? this.url, state }
      this.replaces++
    },
  }
  addEventListener(type: string, l: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(l)
  }
  removeEventListener(type: string, l: () => void) {
    this.listeners.get(type)?.delete(l)
  }
  traverse(delta: number) {
    const target = this.index + delta
    if (target < 0 || target >= this.entries.length) return
    const before = this.location.hash
    this.index = target
    for (const l of [...(this.listeners.get('popstate') ?? [])]) l()
    if (this.location.hash !== before) for (const l of [...(this.listeners.get('hashchange') ?? [])]) l()
  }
  back() {
    this.traverse(-1)
  }
  forward() {
    this.traverse(1)
  }
  listenerCount() {
    let n = 0
    for (const s of this.listeners.values()) n += s.size
    return n
  }
}

/**
 * Mirrors PortfolioExplorer's wiring: user changes commit with a mode;
 * popstate hands state to the view, and the view's follow-up commit is
 * skipped (pendingMode = null) — so we also assert that even a stray commit
 * of the navigated state writes nothing.
 */
function mount(url: string, opts: { initialKind?: 'all' | 'blueprint' | 'system'; clock?: { t: number } } = {}) {
  const win = new FakeWindow(url)
  const initialKind = opts.initialKind ?? 'all'
  let view: ExplorerState = defaultExplorerState(initialKind)
  let navigations = 0
  const controller = createExplorerHistory({
    win,
    initialKind,
    vocabulary: VOCAB,
    onNavigate: (next) => {
      navigations++
      view = next
      // A view re-render that (wrongly) re-committed must still be a no-op:
      controller.commit(next, 'push')
    },
    now: opts.clock ? () => opts.clock!.t : undefined,
  })
  view = controller.read()
  const select = (patch: Partial<ExplorerState>, mode: 'push' | 'typing' = 'push') => {
    view = { ...view, ...patch }
    controller.commit(view, mode)
  }
  return {
    win,
    controller,
    select,
    get view() {
      return view
    },
    get navigations() {
      return navigations
    },
  }
}

describe('portfolio filters — pure parse / serialise', () => {
  it('defaults serialise to an empty query (clean URL)', () => {
    assert.equal(serializeExplorerState(defaultExplorerState('all'), 'all'), '')
    assert.equal(serializeExplorerState(defaultExplorerState('blueprint'), 'blueprint'), '')
  })

  it('round-trips every field in canonical order', () => {
    const state: ExplorerState = { kind: 'system', industry: IND_A, capability: CAP, q: 'whatsapp crm', sort: 'az' }
    const qs = serializeExplorerState(state, 'all')
    assert.deepEqual([...new URLSearchParams(qs).keys()], ['type', 'industry', 'capability', 'q', 'sort'])
    assert.deepEqual(parseExplorerState(new URLSearchParams(qs), 'all', VOCAB), state)
  })

  it('invalid values fall back to defaults', () => {
    const params = new URLSearchParams({
      type: 'evil',
      industry: '<script>',
      capability: 'Nope',
      sort: 'random',
      q: 'x'.repeat(500),
    })
    const state = parseExplorerState(params, 'all', VOCAB)
    assert.equal(state.kind, 'all')
    assert.equal(state.industry, '')
    assert.equal(state.capability, '')
    assert.equal(state.sort, 'featured')
    assert.equal(state.q.length, MAX_QUERY_LENGTH)
  })

  it('reads and builds both URL forms', () => {
    assert.equal(readLocationQuery({ pathname: '/work', search: '?industry=A', hash: '' }), 'industry=A')
    assert.equal(readLocationQuery({ pathname: '/', search: '', hash: '#/work?industry=A' }), 'industry=A')
    assert.equal(readLocationQuery({ pathname: '/', search: '', hash: '#main-content' }), '')
    assert.equal(buildLocationUrl({ pathname: '/work', search: '?x=1', hash: '' }, 'q=a'), '/work?q=a')
    assert.equal(buildLocationUrl({ pathname: '/services', search: '', hash: '#/work?q=a' }, ''), '/services#/work')
  })
})

describe('portfolio filters — browser history', () => {
  it('select: a filter change pushes exactly one entry with the filter in the URL', () => {
    const m = mount('/work')
    m.select({ industry: IND_A })
    assert.equal(m.win.pushes, 1)
    assert.equal(m.win.url, `/work?industry=${encodeURIComponent(IND_A).replace(/%20/g, '+')}`)
  })

  it('back: restores the previous filter; forward re-applies it', () => {
    const m = mount('/work')
    m.select({ industry: IND_A })
    m.select({ capability: CAP })
    m.select({ sort: 'az' })
    assert.equal(m.win.entries.length, 4)

    m.win.back()
    assert.deepEqual([m.view.industry, m.view.capability, m.view.sort], [IND_A, CAP, 'featured'])
    m.win.back()
    assert.deepEqual([m.view.industry, m.view.capability], [IND_A, ''])
    m.win.back()
    assert.deepEqual(m.view, defaultExplorerState('all'))

    m.win.forward()
    assert.equal(m.view.industry, IND_A)
    m.win.forward()
    m.win.forward()
    assert.equal(m.view.sort, 'az')
  })

  it('no sync loop: Back/Forward never write history', () => {
    const m = mount('/work')
    m.select({ industry: IND_A })
    m.select({ industry: IND_B })
    const writes = m.win.pushes + m.win.replaces
    m.win.back()
    m.win.back()
    m.win.forward()
    assert.equal(m.win.pushes + m.win.replaces, writes)
    assert.equal(m.win.entries.length, 3, 'forward stack intact')
    assert.equal(m.navigations, 3)
  })

  it('no duplicate entries: re-selecting the current value writes nothing', () => {
    const m = mount('/work')
    m.select({ industry: IND_A })
    m.select({ industry: IND_A })
    m.select({ q: '  ' }) // whitespace-only search serialises to nothing
    assert.equal(m.win.pushes, 1)
    assert.equal(m.win.replaces, 0)
  })

  it('search typing: one entry per burst, replaced while typing', () => {
    const clock = { t: 0 }
    const m = mount('/work', { clock })
    for (const q of ['w', 'wh', 'wha', 'what']) {
      clock.t += 150
      m.select({ q }, 'typing')
    }
    assert.equal(m.win.pushes, 1)
    assert.equal(m.win.replaces, 3)
    assert.equal(new URL(m.win.url, 'https://x').searchParams.get('q'), 'what')
    clock.t += TYPING_BURST_MS + 1
    m.select({ q: 'whatsapp' }, 'typing') // new burst after a pause
    assert.equal(m.win.pushes, 2)
    m.win.back()
    assert.equal(m.view.q, 'what')
  })

  it('reload / deep link: state comes from the URL', () => {
    const m = mount(`/work?industry=${encodeURIComponent(IND_A)}&sort=industry&type=blueprint`)
    assert.equal(m.view.industry, IND_A)
    assert.equal(m.view.sort, 'industry')
    assert.equal(m.view.kind, 'blueprint')
    assert.equal(m.win.pushes, 0, 'loading never adds an entry')
  })

  it('deep link in the in-app hash form keeps the route and updates only its query', () => {
    const m = mount(`/#/work?capability=${encodeURIComponent(CAP)}`)
    assert.equal(m.view.capability, CAP)
    m.select({ capability: '' })
    assert.equal(m.win.url, '/#/work')
    m.win.back()
    assert.equal(m.view.capability, CAP)
  })

  it('default: the unfiltered page keeps a clean URL and initialKind is not serialised', () => {
    const m = mount('/work/case-studies', { initialKind: 'blueprint' })
    assert.equal(m.view.kind, 'blueprint')
    assert.equal(m.win.url, '/work/case-studies')
    m.select({ kind: 'all' })
    assert.equal(m.win.url, '/work/case-studies?type=all')
    m.select({ kind: 'blueprint' })
    assert.equal(m.win.url, '/work/case-studies')
  })

  it('invalid: bad params are dropped from the URL with replaceState (no new entry)', () => {
    const m = mount('/work?industry=Nope&type=bogus&sort=zzz&capability=x')
    assert.deepEqual(m.view, defaultExplorerState('all'))
    assert.equal(m.win.url, '/work')
    assert.equal(m.win.pushes, 0)
    assert.equal(m.win.replaces, 1)
  })

  it('history entries carry only our marker (Next.js adds its own router state)', () => {
    const m = mount('/work')
    m.select({ industry: IND_A })
    assert.deepEqual(Object.keys(m.win.entries[1].state as object), ['t360PortfolioFilter'])
  })

  it('hash-link navigation (hashchange) also restores state', () => {
    const m = mount(`/#/work?industry=${encodeURIComponent(IND_A)}`)
    // A click on the "Work" nav link: new entry, hash changes, popstate may not fire.
    m.win.entries.push({ url: '/#/work', state: null })
    m.win.index++
    for (const l of m.win.listeners.get('hashchange') ?? []) l()
    assert.equal(m.view.industry, '')
  })

  it('destroy removes the popstate and hashchange listeners', () => {
    const m = mount('/work')
    assert.equal(m.win.listenerCount(), 2)
    m.controller.destroy()
    assert.equal(m.win.listenerCount(), 0)
    m.controller.commit({ ...m.view, industry: IND_A }, 'push')
    assert.equal(m.win.pushes, 0)
  })
})

describe('portfolio filters — component and router wiring', async () => {
  const { readFileSync } = await import('node:fs')
  const explorer = readFileSync(new URL('../src/components/site/PortfolioExplorer.tsx', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')

  it('explorer uses the controller: push for discrete changes, typing for search', () => {
    assert.match(explorer, /createExplorerHistory\(/)
    assert.match(explorer, /update\(\{ q: event\.target\.value \}, "typing"\)/)
    assert.match(explorer, /mode: CommitMode = "push"/)
    assert.match(explorer, /pendingMode\.current = null; \/\/ the URL already matches/)
    assert.doesNotMatch(explorer, /history\.replaceState|history\.pushState/)
  })

  it('router ignores query-only hash changes on the same route (no scroll jump / page_view)', () => {
    assert.match(page, /parseHash\(next\)\.full === parseHash\(previous\)\.full\) return/)
  })

  it('in-app links keep their query string (e.g. /work?capability=…)', () => {
    assert.match(page, /const target = `#\$\{cleanPath\}\$\{query \? `\?\$\{query\}` : ''\}`/)
  })

  it('legacy /#/route canonicalisation keeps the query and renders that route', () => {
    assert.match(page, /const canonical = `\$\{legacyPath\}\$\{legacyQuery \? `\?\$\{legacyQuery\}` : ''\}`/)
    assert.match(page, /fallbackHash = `#\$\{canonical\}`/)
  })
})
