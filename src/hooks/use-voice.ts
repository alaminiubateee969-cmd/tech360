'use client'

/**
 * TECH360 — voice control for the admin console
 * ==============================================
 * "Reverse-engineer it by voice, then read me the teardown."
 *
 * Both halves use the browser's own Web Speech platform:
 *   - dictation  → SpeechRecognition (mic → text)
 *   - read-aloud → speechSynthesis (text → speech)
 *
 * No third-party transcription or TTS service is called, so this works with no
 * API key, sends no audio to anyone, and cannot leak a teardown outside the
 * operator's own browser. That is a deliberate choice: a teardown contains
 * competitive analysis of a third party, and shipping it to a speech vendor to
 * be read aloud would be an outbound disclosure nobody approved.
 *
 * THE HONESTY RULE
 * ----------------
 * Support is genuinely patchy — Firefox has no SpeechRecognition, Safari
 * prefixes it, mic permission can be denied, and a language may have no voice
 * installed. Every one of those is reported as a distinct state rather than
 * failing silently or pretending to work. `capabilities` tells the UI exactly
 * what to offer, and the UI must degrade to a text field, not hide the feature.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

// The Web Speech types are not in every TS lib target, so the minimum surface
// actually used is declared here rather than pulling in a @types package.
type SpeechRecognitionAlternative = { transcript: string; confidence: number }
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number }
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type SpeechSynthesisVoiceLike = { name: string; lang: string; default: boolean }

export type VoiceErrorCode =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NETWORK'
  | 'NO_SPEECH'
  | 'ABORTED'
  | 'LANGUAGE_UNAVAILABLE'
  | 'NO_VOICE'
  | 'ALREADY_STARTED'
  | 'UNKNOWN'

export type VoiceCapabilities = {
  /** True when the browser exposes SpeechRecognition at all. */
  dictation: boolean
  /** True when the browser exposes speechSynthesis. */
  speech: boolean
  /** Voices installed for the requested language, once loaded. */
  voiceCount: number
  /** What the operator should be told when a capability is missing. */
  detail: string
}

export type DictationState = 'idle' | 'listening' | 'denied' | 'error' | 'unsupported'

export function useVoiceDictation(options?: { lang?: string; continuous?: boolean }) {
  const lang = options?.lang ?? 'en-US'
  const continuous = options?.continuous ?? false
  const [state, setState] = useState<DictationState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<{ code: VoiceErrorCode; message: string } | null>(null)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
    setSupported(Boolean(ctor))
    if (!ctor) {
      setState('unsupported')
      return
    }
    const recognition = new ctor()
    recognition.lang = lang
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setState('listening')
    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += text
        else interimText += text
      }
      setInterim(interimText)
      if (finalText) setTranscript((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${finalText.trim()}`.trim())
    }
    recognition.onerror = (event) => {
      const mapped = mapRecognitionError(event.error)
      setError(mapped)
      setState(mapped.code === 'PERMISSION_DENIED' ? 'denied' : 'error')
    }
    recognition.onend = () => {
      setInterim('')
      setState((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.onstart = null
      try { recognition.abort() } catch { /* already stopped */ }
      recognitionRef.current = null
    }
  }, [lang, continuous])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setError({ code: 'UNSUPPORTED', message: 'This browser has no speech recognition. Type the target instead — the analysis is identical.' })
      setState('unsupported')
      return false
    }
    setError(null)
    try {
      recognition.start()
      return true
    } catch {
      // start() throws when a session is already running; that is not a failure.
      setError({ code: 'ALREADY_STARTED', message: 'Dictation is already running.' })
      return false
    }
  }, [])

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop() } catch { /* already stopped */ }
    setState('idle')
  }, [])

  const reset = useCallback(() => { setTranscript(''); setInterim(''); setError(null) }, [])

  return { state, transcript, interim, error, supported, start, stop, reset, setTranscript }
}

function mapRecognitionError(code: string): { code: VoiceErrorCode; message: string } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { code: 'PERMISSION_DENIED', message: 'Microphone permission was denied. Allow it in the browser, or type the target instead.' }
    case 'no-speech':
      return { code: 'NO_SPEECH', message: 'No speech was detected. Try again, or type the target.' }
    case 'network':
      return { code: 'NETWORK', message: 'The browser\u2019s own speech service was unreachable. Dictation needs the browser vendor\u2019s service; typing does not.' }
    case 'aborted':
      return { code: 'ABORTED', message: 'Dictation was stopped.' }
    case 'language-not-supported':
      return { code: 'LANGUAGE_UNAVAILABLE', message: 'This browser has no recognition model for the selected language.' }
    default:
      return { code: 'UNKNOWN', message: `Speech recognition failed (${code}).` }
  }
}

export type SpeechState = 'idle' | 'speaking' | 'paused' | 'error' | 'unsupported'

/**
 * Read-aloud. Chunks long text at sentence boundaries because browsers stop
 * mid-utterance on very long strings, and a teardown that cuts off halfway is
 * worse than one read in parts.
 */
export function useVoiceSpeech(options?: { lang?: string; rate?: number }) {
  const lang = options?.lang ?? 'en-US'
  const rate = options?.rate ?? 1
  const [state, setState] = useState<SpeechState>('idle')
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoiceLike[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [progress, setProgress] = useState({ spoken: 0, total: 0 })
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    setSupported(Boolean(synth))
    if (!synth) { setState('unsupported'); return }

    const load = () => {
      const all = synth.getVoices() as SpeechSynthesisVoiceLike[]
      setVoices(all)
      const matching = all.filter((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
      if (matching.length && !selectedVoice) setSelectedVoice(matching.find((v) => v.default)?.name ?? matching[0].name)
    }
    load()
    synth.addEventListener?.('voiceschanged', load)
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      try { synth.cancel() } catch { /* nothing to cancel */ }
    }
  }, [lang, selectedVoice])

  const speak = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return false
    const synth = window.speechSynthesis
    if (!synth) { setState('unsupported'); return false }
    const clean = (text ?? '').replace(/\s+/g, ' ').trim()
    if (!clean) return false

    synth.cancel()
    cancelledRef.current = false
    const chunks = chunkForSpeech(clean)
    setProgress({ spoken: 0, total: chunks.length })
    setState('speaking')

    const voice = voices.find((v) => v.name === selectedVoice) ?? (synth.getVoices() as SpeechSynthesisVoiceLike[]).find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ?? null

    for (let i = 0; i < chunks.length; i += 1) {
      if (cancelledRef.current) break
      await speakChunk(synth, chunks[i], { lang, rate, voice: voice?.name ?? null })
      setProgress({ spoken: i + 1, total: chunks.length })
    }

    setState(cancelledRef.current ? 'idle' : 'idle')
    return !cancelledRef.current
  }, [lang, rate, selectedVoice, voices])

  const stop = useCallback(() => {
    cancelledRef.current = true
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis.cancel() } catch { /* nothing to cancel */ }
    }
    setState('idle')
    setProgress({ spoken: 0, total: 0 })
  }, [])

  return { state, supported, voices, selectedVoice, setSelectedVoice, progress, speak, stop }
}

function speakChunk(
  synth: SpeechSynthesis,
  text: string,
  options: { lang: string; rate: number; voice: string | null },
): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = options.lang
    utterance.rate = options.rate
    if (options.voice) {
      const match = (synth.getVoices() as SpeechSynthesisVoiceLike[]).find((v) => v.name === options.voice)
      if (match) utterance.voice = match as unknown as SpeechSynthesisVoice
    }
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    utterance.onend = done
    utterance.onerror = done
    // Some browsers never fire onend for a cancelled utterance; a watchdog
    // bounded by the text length keeps the queue from hanging forever.
    const watchdog = setTimeout(done, Math.min(120_000, 4000 + text.length * 90))
    utterance.onend = () => { clearTimeout(watchdog); done() }
    utterance.onerror = () => { clearTimeout(watchdog); done() }
    try { synth.speak(utterance) } catch { clearTimeout(watchdog); done() }
  })
}

/** Splits on sentence boundaries, keeping chunks a browser can speak in one go. */
export function chunkForSpeech(text: string, maxChars = 220): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g) ?? [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    if ((current + trimmed).length > maxChars && current) {
      chunks.push(current.trim())
      current = trimmed
    } else {
      current = `${current} ${trimmed}`.trim()
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length ? chunks : [text.slice(0, maxChars)]
}

/** The capability statement both voice surfaces show, so nothing is implied. */
export function voiceCapabilities(dictationSupported: boolean, speechSupported: boolean, voiceCount: number): VoiceCapabilities {
  return {
    dictation: dictationSupported,
    speech: speechSupported,
    voiceCount,
    detail: !dictationSupported && !speechSupported
      ? 'This browser supports neither speech recognition nor speech synthesis. Both voice controls are disabled and the text path is used instead. No feature is lost — only the hands-free part.'
      : !dictationSupported
        ? 'This browser has no speech recognition, so dictation is disabled. Read-aloud still works, and typing a target produces an identical teardown.'
        : !speechSupported
          ? 'This browser has no speech synthesis, so read-aloud is disabled. Dictation still works.'
          : voiceCount === 0
            ? 'Speech is available but no voice is installed for this language yet. The browser may still speak with its default voice.'
            : 'Dictation and read-aloud both run in your browser. No audio is sent to TECH360 or to any third party.',
  }
}
