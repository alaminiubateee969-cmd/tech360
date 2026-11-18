/**
 * Image-viewer accessibility: src/lib/portfolio/focus-trap.ts, exercised
 * against a small in-memory DOM (no jsdom in this repo). Covers open, initial
 * focus, Tab / Shift+Tab wrap, Escape, focus restore, inert background,
 * repeated open/close, missing trigger and unmount-while-open cleanup.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFocusTrap, type TrapDocument, type TrapElement } from '../src/lib/portfolio/focus-trap'

/* ----------------------------------------------------------- fake DOM */

class FakeDocument implements TrapDocument {
  activeElement: unknown = null
  body: FakeElement
  listeners = new Map<string, Set<(event: never) => void>>()
  constructor() {
    this.body = new FakeElement('body', this)
    this.activeElement = this.body
  }
  addEventListener(type: string, listener: (event: never) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }
  removeEventListener(type: string, listener: (event: never) => void) {
    this.listeners.get(type)?.delete(listener)
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0
  }
  /** Dispatch a keydown; if nothing prevents Tab, emulate the browser's default focus move. */
  key(key: string, shiftKey = false) {
    let prevented = false
    const event = { key, shiftKey, preventDefault: () => (prevented = true), stopPropagation: () => undefined }
    for (const listener of [...(this.listeners.get('keydown') ?? [])]) (listener as (e: typeof event) => void)(event)
    if (key === 'Tab' && !prevented) this.defaultTab(shiftKey)
    return prevented
  }
  /** Browser default: move to next/previous tabbable in document order. */
  defaultTab(shiftKey: boolean) {
    const all = this.body.descendants().filter((el) => el.isTabbable() && !el.inInertSubtree())
    const index = all.indexOf(this.activeElement as FakeElement)
    const next = shiftKey ? all[index - 1] ?? all[all.length - 1] : all[index + 1] ?? all[0]
    next?.focus()
  }
}

class FakeElement implements TrapElement {
  parentElement: FakeElement | null = null
  children: FakeElement[] = []
  attributes = new Map<string, string>()
  tabIndex: number
  inert?: boolean
  hidden?: boolean
  constructor(
    public tag: string,
    public doc: FakeDocument,
    opts: { focusable?: boolean; disabled?: boolean } = {},
  ) {
    this.tabIndex = opts.focusable ? 0 : -1
    if (opts.disabled) this.attributes.set('disabled', '')
  }
  append(...kids: FakeElement[]) {
    for (const kid of kids) {
      kid.parentElement = this
      this.children.push(kid)
    }
    return this
  }
  remove() {
    if (!this.parentElement) return
    this.parentElement.children = this.parentElement.children.filter((c) => c !== this)
    this.parentElement = null
  }
  /** This element followed by its ancestors, nearest first. */
  ancestry(): FakeElement[] {
    const chain: FakeElement[] = []
    for (let node: FakeElement | null = this.parentElement; node; node = node.parentElement) chain.push(node)
    return [this as FakeElement, ...chain]
  }
  get isConnected(): boolean {
    return this.ancestry().includes(this.doc.body)
  }
  focus() {
    if (!this.isConnected || this.inInertSubtree()) return
    const previous = this.doc.activeElement
    this.doc.activeElement = this
    if (previous !== this) {
      for (const listener of [...(this.doc.listeners.get('focusin') ?? [])]) (listener as (e: { target: unknown }) => void)({ target: this })
    }
  }
  contains(other: unknown): boolean {
    let node = other as FakeElement | null
    while (node) {
      if (node === this) return true
      node = node.parentElement
    }
    return false
  }
  getAttribute(name: string) {
    return this.attributes.has(name) ? this.attributes.get(name)! : null
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
    if (name === 'tabindex') this.tabIndex = Number(value)
  }
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  hasAttribute(name: string) {
    return this.attributes.has(name)
  }
  descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()])
  }
  isTabbable() {
    return this.tabIndex >= 0 && !this.hasAttribute('disabled') && !this.hidden
  }
  inInertSubtree() {
    return this.ancestry().some((node) => node.hasAttribute('inert'))
  }
  querySelectorAll() {
    return this.descendants().filter((el) => el.isTabbable())
  }
}

function setup() {
  const doc = new FakeDocument()
  const header = new FakeElement('header', doc)
  const navLink = new FakeElement('a', doc, { focusable: true })
  header.append(navLink)
  const main = new FakeElement('main', doc)
  main.setAttribute('tabindex', '-1')
  const thumb = new FakeElement('button', doc, { focusable: true })
  const otherThumb = new FakeElement('button', doc, { focusable: true })
  main.append(thumb, otherThumb)
  const footer = new FakeElement('footer', doc)
  footer.setAttribute('aria-hidden', 'false') // pre-existing value must be restored verbatim
  const toast = new FakeElement('div', doc)
  toast.setAttribute('inert', '') // already inert before the dialog — must stay inert after
  // Portal: the dialog is a direct child of <body>, like createPortal(…, document.body).
  const dialog = new FakeElement('div', doc)
  const close = new FakeElement('button', doc, { focusable: true })
  const prev = new FakeElement('button', doc, { focusable: true })
  const next = new FakeElement('button', doc, { focusable: true })
  dialog.append(close, prev, next)
  doc.body.append(header, main, footer, toast, dialog)
  return { doc, header, navLink, main, thumb, otherThumb, footer, toast, dialog, close, prev, next }
}

function open(t: ReturnType<typeof setup>, onEscape: () => void = () => undefined) {
  t.thumb.focus()
  const trap = createFocusTrap(t.dialog, {
    doc: t.doc,
    initialFocus: () => t.close,
    fallbackFocus: () => t.main,
    onEscape,
  })
  trap.activate()
  return trap
}

/* ----------------------------------------------------------- tests */

describe('portfolio image viewer — focus trap', () => {
  it('open: moves focus to the preferred control (Close)', () => {
    const t = setup()
    const trap = open(t)
    assert.equal(trap.active, true)
    assert.equal(t.doc.activeElement, t.close)
  })

  it('initial focus falls back to the first tabbable, then the dialog itself', () => {
    const t = setup()
    t.thumb.focus()
    const a = createFocusTrap(t.dialog, { doc: t.doc })
    a.activate()
    assert.equal(t.doc.activeElement, t.close, 'first tabbable')
    a.deactivate()

    const empty = new FakeElement('div', t.doc)
    t.doc.body.append(empty)
    const b = createFocusTrap(empty, { doc: t.doc })
    b.activate()
    assert.equal(t.doc.activeElement, empty, 'container when nothing is tabbable')
    assert.equal(empty.getAttribute('tabindex'), '-1', 'container made programmatically focusable')
    b.deactivate()
  })

  it('Tab wraps from the last control to the first', () => {
    const t = setup()
    open(t)
    t.doc.key('Tab') // close → prev (browser default)
    t.doc.key('Tab') // prev → next
    assert.equal(t.doc.activeElement, t.next)
    const prevented = t.doc.key('Tab') // next → wraps to close
    assert.equal(prevented, true)
    assert.equal(t.doc.activeElement, t.close)
  })

  it('Shift+Tab wraps from the first control to the last', () => {
    const t = setup()
    open(t)
    assert.equal(t.doc.activeElement, t.close)
    const prevented = t.doc.key('Tab', true)
    assert.equal(prevented, true)
    assert.equal(t.doc.activeElement, t.next)
  })

  it('Tab never reaches the background, even after many rapid presses', () => {
    const t = setup()
    open(t)
    for (let i = 0; i < 25; i++) {
      t.doc.key('Tab', i % 3 === 0)
      assert.ok(t.dialog.contains(t.doc.activeElement), `press ${i} left the dialog`)
    }
  })

  it('Escape calls onEscape', () => {
    const t = setup()
    let closed = 0
    open(t, () => closed++)
    t.doc.key('Escape')
    assert.equal(closed, 1)
  })

  it('makes the background inert + aria-hidden, preserving prior state', () => {
    const t = setup()
    const trap = open(t)
    for (const el of [t.header, t.main, t.footer, t.toast]) {
      assert.equal(el.hasAttribute('inert'), true)
      assert.equal(el.getAttribute('aria-hidden'), 'true')
    }
    assert.equal(t.dialog.hasAttribute('inert'), false, 'dialog itself is never inert')
    assert.equal(t.dialog.getAttribute('aria-hidden'), null)

    trap.deactivate()
    assert.equal(t.header.hasAttribute('inert'), false)
    assert.equal(t.header.getAttribute('aria-hidden'), null)
    assert.equal(t.main.hasAttribute('inert'), false)
    assert.equal(t.footer.getAttribute('aria-hidden'), 'false', 'previous aria-hidden restored verbatim')
    assert.equal(t.toast.hasAttribute('inert'), true, 'element that was already inert stays inert')
  })

  it('inerts siblings at every ancestor level when not portalled', () => {
    const t = setup()
    const wrapper = new FakeElement('section', t.doc)
    const sibling = new FakeElement('aside', t.doc)
    const nested = new FakeElement('div', t.doc)
    const btn = new FakeElement('button', t.doc, { focusable: true })
    nested.append(btn)
    wrapper.append(sibling, nested)
    t.main.append(wrapper)
    const trap = createFocusTrap(nested, { doc: t.doc })
    trap.activate()
    assert.equal(sibling.hasAttribute('inert'), true)
    assert.equal(t.thumb.hasAttribute('inert'), true)
    assert.equal(t.header.hasAttribute('inert'), true)
    assert.equal(t.main.hasAttribute('inert'), false, 'ancestor of the dialog stays interactive')
    trap.deactivate()
    assert.equal(sibling.hasAttribute('inert'), false)
  })

  it('focus that escapes by other means is pulled back inside', () => {
    const t = setup()
    open(t)
    // Simulate a programmatic focus on a background element (bypasses inert in the fake).
    t.doc.activeElement = t.navLink
    for (const listener of t.doc.listeners.get('focusin') ?? []) (listener as (e: { target: unknown }) => void)({ target: t.navLink })
    assert.equal(t.doc.activeElement, t.close)
  })

  it('close restores focus to the opener and removes every listener', () => {
    const t = setup()
    const trap = open(t)
    assert.equal(t.doc.count('keydown'), 1)
    assert.equal(t.doc.count('focusin'), 1)
    trap.deactivate()
    assert.equal(t.doc.activeElement, t.thumb)
    assert.equal(t.doc.count('keydown'), 0)
    assert.equal(t.doc.count('focusin'), 0)
    assert.equal(trap.active, false)
  })

  it('explicit returnFocus wins over the element focused at open', () => {
    const t = setup()
    t.navLink.focus()
    const trap = createFocusTrap(t.dialog, { doc: t.doc, returnFocus: t.otherThumb })
    trap.activate()
    trap.deactivate()
    assert.equal(t.doc.activeElement, t.otherThumb)
  })

  it('missing trigger: falls back safely when the opener was removed', () => {
    const t = setup()
    const trap = open(t)
    t.thumb.remove()
    trap.deactivate()
    assert.equal(t.doc.activeElement, t.main)
  })

  it('missing trigger and no fallback: does not throw', () => {
    const t = setup()
    t.thumb.focus()
    const trap = createFocusTrap(t.dialog, { doc: t.doc })
    trap.activate()
    t.thumb.remove()
    assert.doesNotThrow(() => trap.deactivate())
  })

  it('repeated open/close and double activate/deactivate are idempotent', () => {
    const t = setup()
    for (let i = 0; i < 5; i++) {
      const trap = open(t)
      trap.activate() // second activate must not double-register or re-snapshot inert state
      assert.equal(t.doc.count('keydown'), 1)
      trap.deactivate()
      trap.deactivate()
      assert.equal(t.doc.count('keydown'), 0)
      assert.equal(t.header.hasAttribute('inert'), false)
      assert.equal(t.doc.activeElement, t.thumb)
    }
  })

  it('unmount while open (deactivate from cleanup) leaves no trace', () => {
    const t = setup()
    const trap = open(t)
    t.dialog.remove() // React removes the portal node, then runs effect cleanup
    trap.deactivate()
    assert.equal(t.doc.count('keydown') + t.doc.count('focusin'), 0)
    for (const el of [t.header, t.main]) {
      assert.equal(el.hasAttribute('inert'), false)
      assert.equal(el.getAttribute('aria-hidden'), null)
    }
    assert.equal(t.doc.activeElement, t.thumb)
    // Keys after unmount are ignored.
    assert.doesNotThrow(() => t.doc.key('Escape'))
  })
})

/* -------------------------------------------- component contract (source) */

describe('portfolio image viewer — component wiring', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../src/components/site/PortfolioMedia.tsx', import.meta.url), 'utf8')
  const lightbox = source.slice(source.indexOf('function Lightbox('), source.indexOf('/* Share bar'))

  it('is a titled modal dialog rendered in a portal', () => {
    assert.match(lightbox, /role="dialog"/)
    assert.match(lightbox, /aria-modal="true"/)
    assert.match(lightbox, /aria-labelledby=\{titleId\}/)
    assert.match(lightbox, /<h2 id=\{titleId\}/)
    assert.match(lightbox, /aria-describedby=\{captionId\}/)
    assert.match(lightbox, /createPortal\(/)
  })

  it('uses the shared focus trap with Close as initial focus and a safe fallback', () => {
    assert.match(lightbox, /createFocusTrap\(/)
    assert.match(lightbox, /initialFocus: \(\) => closeRef\.current/)
    assert.match(lightbox, /fallbackFocus: \(\) => document\.getElementById\("main-content"\)/)
    assert.match(lightbox, /trap\.deactivate\(\)/)
  })

  it('does not re-run focus management when the image index changes', () => {
    const effect = lightbox.slice(lightbox.indexOf('useEffect(() => {'), lightbox.indexOf('const go ='))
    assert.match(effect, /\}, \[\]\);/, 'mount-only effect')
    assert.doesNotMatch(lightbox, /window\.addEventListener\("keydown"/)
  })

  it('names every control for screen readers and shows a visible focus ring', () => {
    assert.match(lightbox, /aria-label="Close image viewer"/)
    assert.match(lightbox, /aria-label=\{`Previous image/)
    assert.match(lightbox, /aria-label=\{`Next image/)
    assert.equal((lightbox.match(/focus-visible:ring-2/g) ?? []).length, 3)
    assert.match(lightbox, /aria-live="polite"/)
  })
})
