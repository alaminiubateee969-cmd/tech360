/**
 * TECH360 — Media Studio engine (video · shorts · voiceover · captions)
 * ====================================================================
 * Converts a creative brief into a reviewed production plan:
 *   brief → script → timed shots → narration → captions (SRT/VTT) → render spec
 *
 * What this module REALLY produces (no provider required):
 *   - a scene-by-scene shot plan with start/end seconds,
 *   - the narration line for each shot in English or Bangla,
 *   - valid SRT and WebVTT caption files,
 *   - a Remotion-shaped composition specification (`fps`, `durationInFrames`,
 *     scene array) that a licensed renderer can consume.
 *
 * What it deliberately does NOT do: fabricate a rendered media file. Render and
 * voice states are computed from real configuration; with no provider they
 * report `RENDER_NOT_CONFIGURED` / `NOT_CONFIGURED` and the UI says so.
 */

export const MEDIA_KINDS = ['VIDEO', 'SHORT', 'AUDIO', 'VOICEOVER'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const
export type MediaAspect = (typeof MEDIA_ASPECTS)[number]

export const SHOT_KINDS = ['HOOK', 'TALKING_HEAD', 'B_ROLL', 'TEXT_CARD', 'CTA'] as const
export type ShotKind = (typeof SHOT_KINDS)[number]

export type PlannedShot = {
  seq: number
  startSec: number
  endSec: number
  kind: ShotKind
  visual: string
  narration: string
  overlay: string | null
}

export type MediaBrief = {
  title: string
  topic: string
  kind: MediaKind
  aspect: MediaAspect
  durationSec: number
  language: 'EN' | 'BN'
  audience: string
  cta: string
  points: string[]
  clientName: string
  brandTone: string
}

export type MediaProviderStates = {
  render: { state: 'AVAILABLE' | 'RENDER_NOT_CONFIGURED'; detail: string }
  voice: { state: 'AVAILABLE' | 'NOT_CONFIGURED'; detail: string }
  music: { state: 'AVAILABLE' | 'NOT_CONFIGURED'; detail: string }
}

const ASPECT_SHAPE: Record<MediaAspect, string> = {
  '16:9': '1920×1080 landscape',
  '9:16': '1080×1920 vertical',
  '1:1': '1080×1080 square',
  '4:5': '1080×1350 portrait feed',
}

export function normalizeMediaBrief(input: Record<string, unknown>): MediaBrief {
  const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const kind = (MEDIA_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as MediaKind) : 'VIDEO'
  const aspect = (MEDIA_ASPECTS as readonly string[]).includes(String(input.aspect)) ? (input.aspect as MediaAspect) : kind === 'SHORT' ? '9:16' : '16:9'
  const language = String(input.language).toUpperCase() === 'BN' ? 'BN' : 'EN'
  const durationRaw = Number(input.durationSec)
  const durationSec = Number.isFinite(durationRaw) ? Math.min(600, Math.max(10, Math.round(durationRaw))) : 60
  const points = Array.isArray(input.points)
    ? (input.points as unknown[]).map((p) => str(p, 160)).filter(Boolean).slice(0, 6)
    : String(input.points ?? '')
        .split('\n')
        .map((p) => str(p, 160))
        .filter(Boolean)
        .slice(0, 6)
  return {
    title: str(input.title, 120) || 'Untitled media job',
    topic: str(input.topic, 300) || 'the client’s offer',
    kind,
    aspect,
    durationSec,
    language,
    audience: str(input.audience, 160) || 'the target customer',
    cta: str(input.cta, 120) || 'Book a call',
    points: points.length ? points : ['the problem we remove', 'how the service works', 'the result the client gets'],
    clientName: str(input.clientName, 120),
    brandTone: str(input.brandTone, 80) || 'clear, confident, no hype',
  }
}

/** Rough speech duration: ~2.5 words/second in English, ~2.2 in Bangla. */
export function estimateSpeechSeconds(text: string, language: 'EN' | 'BN' = 'EN'): number {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length
  const rate = language === 'BN' ? 2.2 : 2.5
  return Math.max(1, Math.round(words / rate))
}

function narrationFor(kind: ShotKind, point: string, brief: MediaBrief, index: number): string {
  const bn = brief.language === 'BN'
  switch (kind) {
    case 'HOOK':
      return bn
        ? `${brief.topic} — যদি এটাই আপনার সমস্যা হয়, এই ৩টি বিষয় জানা দরকার।`
        : `${brief.topic} — if that is your problem, here are three things worth knowing.`
    case 'CTA':
      return bn ? `${brief.cta} — এখনই যোগাযোগ করুন।` : `${brief.cta} — get in touch today.`
    case 'TEXT_CARD':
      return bn ? `মূল কথা: ${point}` : `Key point: ${point}`
    case 'TALKING_HEAD':
      return bn ? `${index}. ${point}` : `${index}. ${point}`
    default:
      return bn ? `${point} — বাস্তবে এটা যেভাবে কাজ করে।` : `${point} — here is how that actually works.`
  }
}

function visualFor(kind: ShotKind, brief: MediaBrief, point: string): string {
  const shape = ASPECT_SHAPE[brief.aspect]
  switch (kind) {
    case 'HOOK':
      return `Punch-in on the presenter, bold 3-word title over frame, ${shape}, brand primary in the lower third.`
    case 'TALKING_HEAD':
      return `Presenting to camera on a clean background, screen-record inset showing “${point}”, ${shape}.`
    case 'B_ROLL':
      return `Screen capture / workplace b-roll illustrating “${point}” with a caption bar, ${shape}.`
    case 'TEXT_CARD':
      return `Typographic card: “${point}” as the headline, brand palette, subtle motion, ${shape}.`
    case 'CTA':
      return `End card: service name, one clear action, contact route, ${shape}.`
    default:
      return shape
  }
}

/**
 * Split the requested duration across beats: one hook, one shot per talking
 * point, and a closing CTA. Deterministic — the same brief always yields the
 * same timings.
 */
export function planShots(brief: MediaBrief): PlannedShot[] {
  const dur = brief.durationSec
  const hookSec = Math.max(3, Math.min(8, Math.round(dur * 0.12)))
  const ctaSec = Math.max(4, Math.min(12, Math.round(dur * 0.15)))
  const bodyTotal = Math.max(3, dur - hookSec - ctaSec)
  const points = brief.points.slice(0, 6)
  const bodyCount = Math.max(1, points.length)
  const base = Math.floor(bodyTotal / bodyCount)
  const remainder = bodyTotal - base * bodyCount

  const shots: PlannedShot[] = []
  let cursor = 0
  const push = (kind: ShotKind, seconds: number, index = 0, point = '') => {
    const start = cursor
    const end = Math.min(dur, cursor + seconds)
    cursor = end
    shots.push({
      seq: shots.length + 1,
      startSec: start,
      endSec: end,
      kind,
      visual: visualFor(kind, brief, point),
      narration: narrationFor(kind, point, brief, index),
      overlay: kind === 'TEXT_CARD' ? point.slice(0, 60) : null,
    })
  }

  push('HOOK', hookSec)
  if (brief.kind === 'VOICEOVER') {
    push('TALKING_HEAD', bodyTotal, 1, points[0] ?? brief.topic)
  } else if (brief.kind === 'AUDIO') {
    points.forEach((p, i) => push('TALKING_HEAD', base + (i < remainder ? 1 : 0), i + 1, p))
  } else {
    points.forEach((p, i) => {
      const seconds = base + (i < remainder ? 1 : 0)
      push(i % 2 === 0 ? 'TALKING_HEAD' : 'B_ROLL', seconds, i + 1, p)
      if (i === 0 && brief.kind === 'VIDEO' && seconds >= 8) {
        // A single key-point card keeps retention on longer cutdowns.
        const card = Math.min(4, Math.max(2, Math.floor(seconds / 3)))
        shots[shots.length - 1].endSec = Math.max(shots[shots.length - 1].startSec + 2, shots[shots.length - 1].endSec - card)
        cursor = shots[shots.length - 1].endSec
        push('TEXT_CARD', card, i + 1, p)
      }
    })
  }
  if (cursor < dur) push('CTA', Math.max(ctaSec, dur - cursor))
  return shots
}

export function buildScript(brief: MediaBrief, shots: PlannedShot[]): string {
  const header = `${brief.title}\n${'='.repeat(brief.title.length)}\nTopic: ${brief.topic}\nFormat: ${brief.kind} · ${brief.aspect} · ${Math.round(brief.durationSec)}s · ${brief.language}\nAudience: ${brief.audience}\nTone: ${brief.brandTone}${brief.clientName ? `\nClient: ${brief.clientName}` : ''}\n`
  const body = shots
    .map((s) => `\n[${s.seq}] ${String(s.startSec).padStart(3, '0')}s–${String(s.endSec).padStart(3, '0')}s · ${s.kind}\nVISUAL: ${s.visual}\nVO: ${s.narration}${s.overlay ? `\nON-SCREEN: ${s.overlay}` : ''}`)
    .join('\n')
  return `${header}${body}\n`
}

function srtTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.round((s - Math.floor(s)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function vttTime(seconds: number): string {
  return srtTime(seconds).replace(',', '.')
}

/** Wrap narration for readability: max chars per line, max two lines. */
export function wrapCaption(text: string, maxChars = 42, maxLines = 2): string {
  const words = String(text).trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line.trim())
      line = w
      if (lines.length === maxLines) break
    } else {
      line = `${line} ${w}`.trim()
    }
  }
  if (lines.length < maxLines && line) lines.push(line.trim())
  return lines.join('\n')
}

export function toSrt(shots: PlannedShot[]): string {
  return `${shots
    .map((s, i) => `${i + 1}\n${srtTime(s.startSec)} --> ${srtTime(s.endSec)}\n${wrapCaption(s.narration)}\n`)
    .join('\n')}\n`
}

export function toVtt(shots: PlannedShot[]): string {
  const cues = shots
    .map((s, i) => `cue-${i + 1}\n${vttTime(s.startSec)} --> ${vttTime(s.endSec)}\n${wrapCaption(s.narration)}\n`)
    .join('\n')
  return `WEBVTT\n\n${cues}`
}

/**
 * Remotion-shaped composition specification. This is a data contract, not a
 * renderer: a licensed render pipeline (or the client's own Remotion project)
 * consumes it. `fps` defaults to 30.
 */
export function compositionSpec(brief: MediaBrief, shots: PlannedShot[], fps = 30) {
  const [w, h] = aspectDimensions(brief.aspect)
  return {
    id: `t360-${brief.kind.toLowerCase()}-${brief.aspect.replace(':', 'x')}`,
    fps,
    width: w,
    height: h,
    durationInFrames: Math.round(brief.durationSec * fps),
    language: brief.language,
    scenes: shots.map((s) => ({
      id: `shot-${s.seq}`,
      kind: s.kind,
      from: s.startSec * fps,
      durationInFrames: Math.max(1, (s.endSec - s.startSec) * fps),
      overlay: s.overlay,
      narration: s.narration,
      visual: s.visual,
    })),
    rendering: {
      status: 'NOT_RENDERED',
      note: 'Provide this spec to a configured render provider. Tech360 does not fabricate output files.',
    },
  }
}

export function aspectDimensions(aspect: MediaAspect): [number, number] {
  switch (aspect) {
    case '9:16':
      return [1080, 1920]
    case '1:1':
      return [1080, 1080]
    case '4:5':
      return [1080, 1350]
    default:
      return [1920, 1080]
  }
}

/** Compute honest provider states from the environment (never from the DB). */
export function mediaProviderStates(env: NodeJS.ProcessEnv = process.env): MediaProviderStates {
  const renderProvider = String(env.MEDIA_RENDER_PROVIDER ?? '').trim()
  const renderKey = String(env.MEDIA_RENDER_API_KEY ?? '').trim()
  const voiceUrl = String(env.TTS_PROVIDER_URL ?? '').trim()
  const voiceKey = String(env.TTS_API_KEY ?? '').trim()
  const musicUrl = String(env.MUSIC_PROVIDER_URL ?? '').trim()
  return {
    render:
      renderProvider && renderKey
        ? { state: 'AVAILABLE', detail: `Render provider “${renderProvider}” is configured. Queueing a job calls it.` }
        : {
            state: 'RENDER_NOT_CONFIGURED',
            detail: 'No render provider is configured (MEDIA_RENDER_PROVIDER + MEDIA_RENDER_API_KEY). The plan, script and captions are still produced and downloadable.',
          },
    voice:
      voiceUrl && voiceKey
        ? { state: 'AVAILABLE', detail: 'Text-to-speech endpoint is configured; narration can be synthesised per shot.' }
        : { state: 'NOT_CONFIGURED', detail: 'No TTS endpoint is configured (TTS_PROVIDER_URL + TTS_API_KEY). Narration text is produced; audio is not faked.' },
    music:
      musicUrl
        ? { state: 'AVAILABLE', detail: 'Music provider is configured.' }
        : { state: 'NOT_CONFIGURED', detail: 'No music provider is configured (MUSIC_PROVIDER_URL). A music brief is recorded instead of generated audio.' },
  }
}

/** Next status for a job when an action is taken — keeps the state machine honest. */
export function nextJobStatus(action: 'plan' | 'voice' | 'captions' | 'queue-render', providers: MediaProviderStates): { status: string; note: string } {
  switch (action) {
    case 'plan':
      return { status: 'PLANNED', note: 'Shot plan and script generated from the brief.' }
    case 'captions':
      return { status: 'CAPTIONS_READY', note: 'SRT and WebVTT captions generated from the shot narration.' }
    case 'voice':
      return providers.voice.state === 'AVAILABLE'
        ? { status: 'VOICE_READY', note: 'Narration sent to the configured TTS endpoint.' }
        : { status: 'PLANNED', note: 'Voice provider NOT_CONFIGURED — narration text stays available, no audio is produced.' }
    case 'queue-render':
      return providers.render.state === 'AVAILABLE'
        ? { status: 'RENDER_QUEUED', note: 'Composition specification submitted to the configured render provider.' }
        : { status: 'CAPTIONS_READY', note: 'Render provider NOT_CONFIGURED — nothing was queued and no file was produced.' }
  }
}
