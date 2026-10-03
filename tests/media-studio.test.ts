/**
 * TECH360 — Media Studio tests.
 * The contract: a plan always covers the full duration, captions are valid SRT
 * and WebVTT, and a job can never report a rendered file without a provider.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aspectDimensions,
  buildScript,
  compositionSpec,
  estimateSpeechSeconds,
  mediaProviderStates,
  nextJobStatus,
  normalizeMediaBrief,
  planShots,
  toSrt,
  toVtt,
  wrapCaption,
} from '../src/lib/media/studio'

const brief = normalizeMediaBrief({
  title: 'Why UK admissions teams choose Tech360',
  topic: 'Student recruitment CRM for UK consultancies',
  kind: 'VIDEO',
  aspect: '16:9',
  durationSec: 60,
  language: 'EN',
  audience: 'Admissions directors in London',
  cta: 'Book a call',
  points: ['the problem we remove', 'how the service works', 'the result the client gets'],
})

describe('media: brief normalisation', () => {
  it('clamps duration and keeps supported kind/aspect', () => {
    const b = normalizeMediaBrief({ durationSec: 9999, kind: 'SHORT', aspect: '9:16' })
    assert.equal(b.durationSec, 600)
    assert.equal(b.kind, 'SHORT')
    assert.equal(b.aspect, '9:16')
  })

  it('defaults shorts to a vertical frame', () => {
    const b = normalizeMediaBrief({ kind: 'SHORT' })
    assert.equal(b.aspect, '9:16')
  })

  it('supplies fallback key points instead of an empty script', () => {
    const b = normalizeMediaBrief({ points: '' })
    assert.ok(b.points.length >= 1)
  })

  it('accepts newline-separated points from a form field', () => {
    const b = normalizeMediaBrief({ points: 'one\ntwo\nthree' })
    assert.deepEqual(b.points, ['one', 'two', 'three'])
  })
})

describe('media: shot planning covers the timeline', () => {
  it('starts at zero, ends at the requested duration and never overlaps', () => {
    const shots = planShots(brief)
    assert.equal(shots[0].startSec, 0)
    assert.equal(shots[shots.length - 1].endSec, brief.durationSec)
    for (let i = 1; i < shots.length; i += 1) {
      assert.equal(shots[i].startSec, shots[i - 1].endSec, `shot ${i} must continue where ${i - 1} ended`)
      assert.ok(shots[i].endSec > shots[i].startSec)
    }
  })

  it('opens with a hook and closes with a CTA', () => {
    const shots = planShots(brief)
    assert.equal(shots[0].kind, 'HOOK')
    assert.equal(shots[shots.length - 1].kind, 'CTA')
  })

  it('produces Bangla narration when the brief is Bangla', () => {
    const bn = normalizeMediaBrief({ ...brief, language: 'BN', title: 'পরীক্ষা', topic: 'CRM' })
    const shots = planShots(bn)
    assert.ok(/[\u0980-\u09FF]/.test(shots[0].narration), 'expected Bengali script in the hook')
  })

  it('models a voiceover as one continuous take', () => {
    const vo = normalizeMediaBrief({ ...brief, kind: 'VOICEOVER', durationSec: 45 })
    const shots = planShots(vo)
    assert.ok(shots.some((s) => s.kind === 'TALKING_HEAD'))
  })
})

describe('media: captions are valid SRT and WebVTT', () => {
  const shots = planShots(brief)
  const srt = toSrt(shots)
  const vtt = toVtt(shots)

  it('emits numbered SRT cues with comma millisecond separators', () => {
    assert.match(srt, /^1\n00:00:00,000 --> 00:00:\d{2},\d{3}\n/)
    assert.equal((srt.match(/-->/g) ?? []).length, shots.length)
  })

  it('emits a WEBVTT header and dot separators', () => {
    assert.ok(vtt.startsWith('WEBVTT'))
    assert.match(vtt, /00:00:00\.000 --> /)
    assert.ok(!/^\d{2}:\d{2}:\d{2},\d{3}/m.test(vtt), 'VTT cue timestamps must not use comma milliseconds')
  })

  it('wraps long narration to two lines of readable length', () => {
    const wrapped = wrapCaption('a'.repeat(10) + ' ' + Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '))
    const lines = wrapped.split('\n')
    assert.ok(lines.length <= 2)
    for (const line of lines) assert.ok(line.length <= 60)
  })

  it('estimates speech duration from the narration text', () => {
    assert.equal(estimateSpeechSeconds('one two three four five', 'EN'), 2)
    assert.ok(estimateSpeechSeconds('এক দুই তিন চার পাঁচ ছয়', 'BN') >= 1)
  })
})

describe('media: composition spec is a data contract', () => {
  const spec = compositionSpec(brief, planShots(brief))

  it('matches the requested frame size and duration', () => {
    const [w, h] = aspectDimensions('16:9')
    assert.equal(spec.width, w)
    assert.equal(spec.height, h)
    assert.equal(spec.durationInFrames, brief.durationSec * spec.fps)
    assert.equal(spec.scenes.length, planShots(brief).length)
  })

  it('is explicitly NOT_RENDERED', () => {
    assert.equal(spec.rendering.status, 'NOT_RENDERED')
  })

  it('hands a vertical spec to a shorts provider', () => {
    const shorts = normalizeMediaBrief({ ...brief, kind: 'SHORT', aspect: '' })
    const s = compositionSpec(shorts, planShots(shorts))
    assert.equal(s.width, 1080)
    assert.equal(s.height, 1920)
  })
})

describe('media: provider honesty', () => {
  it('reports NOT_CONFIGURED with an empty environment', () => {
    const states = mediaProviderStates({})
    assert.equal(states.render.state, 'RENDER_NOT_CONFIGURED')
    assert.equal(states.voice.state, 'NOT_CONFIGURED')
    assert.equal(states.music.state, 'NOT_CONFIGURED')
  })

  it('reports AVAILABLE only when both name and key exist', () => {
    const states = mediaProviderStates({ MEDIA_RENDER_PROVIDER: 'acme' } as NodeJS.ProcessEnv)
    assert.equal(states.render.state, 'RENDER_NOT_CONFIGURED')
    const configured = mediaProviderStates({ MEDIA_RENDER_PROVIDER: 'acme', MEDIA_RENDER_API_KEY: 'k' } as NodeJS.ProcessEnv)
    assert.equal(configured.render.state, 'AVAILABLE')
  })

  it('refuses to reach RENDERED without a provider', () => {
    const states = mediaProviderStates({})
    const queued = nextJobStatus('queue-render', states)
    assert.notEqual(queued.status, 'RENDER_QUEUED')
    assert.match(queued.note, /NOT_CONFIGURED/)
    const voiced = nextJobStatus('voice', states)
    assert.match(voiced.note, /no audio is produced/i)
  })

  it('queues a render when a provider is configured', () => {
    const states = mediaProviderStates({ MEDIA_RENDER_PROVIDER: 'acme', MEDIA_RENDER_API_KEY: 'k' } as NodeJS.ProcessEnv)
    assert.equal(nextJobStatus('queue-render', states).status, 'RENDER_QUEUED')
  })
})

describe('media: script document', () => {
  it('contains every shot with its timing and narration', () => {
    const shots = planShots(brief)
    const script = buildScript(brief, shots)
    assert.ok(script.includes(brief.title))
    for (const s of shots) assert.ok(script.includes(`${s.startSec}s`), `script missing shot ${s.seq}`)
    assert.ok(script.split('\n')[0].includes(brief.title))
  })
})
