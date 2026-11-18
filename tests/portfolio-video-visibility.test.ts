/**
 * Featured-video visibility playback: src/lib/portfolio/visibility-playback.ts.
 * Visible, offscreen, back on screen, manual pause respected, reduced motion,
 * tab hidden, unmount, shared-observer cleanup.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  VISIBLE_RATIO,
  createSharedVisibilityObserver,
  createVisibilityPlayback,
  type IntersectionEntryLike,
  type IntersectionObserverFactory,
} from '../src/lib/portfolio/visibility-playback'

class FakeVideo {
  paused = true
  playCalls = 0
  pauseCalls = 0
  rejectPlay = false
  listeners = new Map<string, Set<() => void>>()
  play() {
    this.playCalls++
    if (this.rejectPlay) return Promise.reject(new Error('NotAllowedError'))
    if (this.paused) {
      this.paused = false
      this.emit('play')
    }
    return Promise.resolve()
  }
  pause() {
    this.pauseCalls++
    if (!this.paused) {
      this.paused = true
      this.emit('pause')
    }
  }
  /** A pause that did not come from our code (media key, browser UI). */
  externalPause() {
    this.paused = true
    this.emit('pause')
  }
  addEventListener(type: string, l: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(l)
  }
  removeEventListener(type: string, l: () => void) {
    this.listeners.get(type)?.delete(l)
  }
  emit(type: string) {
    for (const l of [...(this.listeners.get(type) ?? [])]) l()
  }
  count() {
    let n = 0
    for (const set of this.listeners.values()) n += set.size
    return n
  }
}

class FakeDoc {
  hidden = false
  listeners = new Set<() => void>()
  addEventListener(_: 'visibilitychange', l: () => void) {
    this.listeners.add(l)
  }
  removeEventListener(_: 'visibilitychange', l: () => void) {
    this.listeners.delete(l)
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden
    for (const l of [...this.listeners]) l()
  }
}

/** Fake IntersectionObserver factory that records instances. */
function fakeIO() {
  const instances: {
    callback: (entries: IntersectionEntryLike[]) => void
    targets: Set<unknown>
    disconnected: boolean
    options: { threshold: number[] }
  }[] = []
  const factory: IntersectionObserverFactory = (callback, options) => {
    const instance = { callback, targets: new Set<unknown>(), disconnected: false, options }
    instances.push(instance)
    return {
      observe: (t) => instance.targets.add(t),
      unobserve: (t) => instance.targets.delete(t),
      disconnect: () => {
        instance.disconnected = true
        instance.targets.clear()
      },
    }
  }
  const fire = (target: unknown, ratio: number) => {
    for (const i of instances) {
      if (!i.disconnected && i.targets.has(target)) i.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }])
    }
  }
  return { factory, instances, fire }
}

function setup(opts: { autoplayAllowed?: boolean } = {}) {
  const io = fakeIO()
  const registry = createSharedVisibilityObserver(io.factory)
  const video = new FakeVideo()
  const doc = new FakeDoc()
  const element = { id: 'spotlight' }
  const controller = createVisibilityPlayback({
    media: video,
    element,
    autoplayAllowed: opts.autoplayAllowed ?? true,
    observe: registry.observe,
    doc,
  })
  return { io, registry, video, doc, element, controller }
}

describe('featured video — visibility playback', () => {
  it('does not start before the observer reports visibility', () => {
    const { video } = setup()
    assert.equal(video.paused, true)
    assert.equal(video.playCalls, 0)
  })

  it('visible: autoplays when on screen and autoplay is allowed', () => {
    const { io, video, element } = setup()
    io.fire(element, 1)
    assert.equal(video.paused, false)
  })

  it('a sliver below the threshold does not count as visible', () => {
    const { io, video, element } = setup()
    io.fire(element, VISIBLE_RATIO / 2)
    assert.equal(video.paused, true)
  })

  it('offscreen: pauses when scrolled away', () => {
    const { io, video, element, controller } = setup()
    io.fire(element, 1)
    io.fire(element, 0)
    assert.equal(video.paused, true)
    assert.equal(controller.intent, 'auto', 'a system pause is not mistaken for a user pause')
  })

  it('back on screen: resumes autoplay', () => {
    const { io, video, element } = setup()
    io.fire(element, 1)
    io.fire(element, 0)
    io.fire(element, 0.8)
    assert.equal(video.paused, false)
  })

  it('manual pause is respected: never restarted by scrolling back', () => {
    const { io, video, element, controller } = setup()
    io.fire(element, 1)
    controller.toggle() // visitor presses Pause
    assert.equal(video.paused, true)
    assert.equal(controller.intent, 'user-pause')
    io.fire(element, 0)
    io.fire(element, 1)
    assert.equal(video.paused, true)
    assert.equal(video.playCalls, 1, 'no automatic play after the manual pause')
  })

  it('an external pause (media key / browser UI) also counts as manual', () => {
    const { io, video, element, controller } = setup()
    io.fire(element, 1)
    video.externalPause()
    assert.equal(controller.intent, 'user-pause')
    io.fire(element, 0)
    io.fire(element, 1)
    assert.equal(video.paused, true)
  })

  it('manual play still pauses offscreen and resumes when visible again', () => {
    const { io, video, element, controller } = setup({ autoplayAllowed: false })
    io.fire(element, 1)
    assert.equal(video.paused, true)
    controller.toggle() // visitor presses Play
    assert.equal(video.paused, false)
    io.fire(element, 0)
    assert.equal(video.paused, true)
    io.fire(element, 1)
    assert.equal(video.paused, false)
  })

  it('reduced motion: never autoplays, even when visible', () => {
    const { io, video, element } = setup({ autoplayAllowed: false })
    io.fire(element, 1)
    io.fire(element, 0)
    io.fire(element, 1)
    assert.equal(video.playCalls, 0)
  })

  it('reduced motion switched on at runtime pauses an autoplaying video', () => {
    const { io, video, element, controller } = setup()
    io.fire(element, 1)
    controller.setAutoplayAllowed(false)
    assert.equal(video.paused, true)
    controller.setAutoplayAllowed(true) // and switching it off again resumes
    assert.equal(video.paused, false)
  })

  it('pauses while the tab is hidden and resumes when it returns', () => {
    const { io, video, element, doc } = setup()
    io.fire(element, 1)
    doc.setHidden(true)
    assert.equal(video.paused, true)
    doc.setHidden(false)
    assert.equal(video.paused, false)
  })

  it('a refused autoplay (play() rejects) is swallowed', async () => {
    const { io, video, element } = setup()
    video.rejectPlay = true
    assert.doesNotThrow(() => io.fire(element, 1))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(video.paused, true)
  })

  it('unmount: pauses, removes listeners and ignores later events', () => {
    const { io, video, element, doc, controller, registry } = setup()
    io.fire(element, 1)
    controller.destroy()
    assert.equal(video.paused, true)
    assert.equal(video.count(), 0)
    assert.equal(doc.listeners.size, 0)
    assert.equal(registry.size, 0)
    io.fire(element, 1)
    controller.toggle()
    assert.equal(video.paused, true)
    assert.doesNotThrow(() => controller.destroy())
  })
})

describe('featured video — shared observer', () => {
  it('uses ONE IntersectionObserver for every video and disconnects after the last', () => {
    const io = fakeIO()
    const registry = createSharedVisibilityObserver(io.factory)
    const a = {}
    const b = {}
    const seen: string[] = []
    const offA = registry.observe(a, (v) => seen.push(`a:${v}`))
    const offB = registry.observe(b, (v) => seen.push(`b:${v}`))
    assert.equal(io.instances.length, 1)
    assert.deepEqual(io.instances[0].options.threshold, [0, VISIBLE_RATIO])
    io.fire(a, 1)
    io.fire(b, 0)
    assert.deepEqual(seen, ['a:true', 'b:false'])
    offA()
    assert.equal(registry.connected, true)
    offA() // double unsubscribe is harmless
    offB()
    assert.equal(registry.connected, false)
    assert.equal(io.instances[0].disconnected, true)
    // Re-subscribing after full cleanup creates a fresh observer.
    registry.observe(a, () => undefined)
    assert.equal(io.instances.length, 2)
  })

  it('without IntersectionObserver support, treats the element as visible', () => {
    const registry = createSharedVisibilityObserver(null)
    // `null` + no global IntersectionObserver in Node → fallback path
    let visible: boolean | undefined
    registry.observe({}, (v) => (visible = v))
    assert.equal(visible, true)
  })
})

describe('featured video — component wiring', async () => {
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../src/components/site/PortfolioMedia.tsx', import.meta.url), 'utf8')
  const player = source.slice(source.indexOf('export function MotionPreview('), source.indexOf('/* Gallery with lightbox'))

  it('only autoplaying previews register with the shared observer', () => {
    assert.match(player, /if \(!el \|\| !autoPlay\) return;/)
    assert.match(player, /observe: sharedVisibilityObserver\(\)\.observe/)
    assert.match(player, /controller\.destroy\(\)/)
    assert.doesNotMatch(player, /new IntersectionObserver/)
  })

  it('feeds reduced-motion into the controller and routes the button through it', () => {
    assert.match(player, /autoplayAllowed: !reducedRef\.current/)
    assert.match(player, /setAutoplayAllowed\(!reduced\)/)
    assert.match(player, /controllerRef\.current\.toggle\(\)/)
  })

  it('the spotlight is the only autoplaying preview', async () => {
    const { readdirSync } = await import('node:fs')
    const dir = new URL('../src/components/site/', import.meta.url)
    const users = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => /<MotionPreview[^>]*\bautoPlay\b/.test(readFileSync(new URL(f, dir), 'utf8')))
    assert.deepEqual(users, ['PortfolioSpotlight.tsx'])
  })
})
