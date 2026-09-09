import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

const AGENT_BY_TYPE: Record<string, string> = {
  RESEARCH: 'CST-020', HOOK: 'CST-020', SCRIPT: 'CST-020', CAPTIONS: 'CST-020',
  IMAGE_PROMPT: 'DSN-021', THUMBNAIL: 'DSN-021',
  VIDEO_PLAN: 'VID-022', EDIT_PLAN: 'VID-022', MUSIC_BRIEF: 'VID-022',
  VOICEOVER: 'VOX-043',
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const type = sanitizeText(raw.type, 30).toUpperCase()
  const topic = sanitizeText(raw.topic, 300)
  const params = (raw.params ?? {}) as Record<string, unknown>
  if (!type || !AGENT_BY_TYPE[type]) return Response.json({ error: `type must be one of ${Object.keys(AGENT_BY_TYPE).join(', ')}` }, { status: 400 })
  if (topic.length < 3) return Response.json({ error: 'topic required' }, { status: 400 })

  const language = sanitizeText(String(params.language ?? 'EN'), 4).toUpperCase() === 'BN' ? 'BN' : 'EN'
  const aspect = sanitizeText(String(params.aspect ?? '16:9'), 8) || '16:9'
  const durationSec = Math.max(50, Math.min(3600, Number(params.durationSec ?? 60) || 60))

  const prompt = `Topic: ${topic}\nType: ${type}\nLanguage: ${language === 'BN' ? 'Bangla' : 'English'}\nAspect ratio: ${aspect}\nDuration: ${durationSec} seconds (minimum 50s standard, cinematic pacing)\nSafe/family-friendly: MANDATORY\nPlatform goals: high retention, honest value, no engagement-bait.`

  const run = await runAgent(AGENT_BY_TYPE[type], { input: prompt, expectJson: true, workflow: 'CONTENT_STUDIO' })
  if (!run.ok) return Response.json({ ok: false, message: `Generation failed: ${run.error}` }, { status: 500 })

  // persist as a real content asset
  const asset = await db.contentAsset.create({
    data: {
      type, language, aspect, durationSec, title: topic.slice(0, 200),
      content: JSON.stringify(run.json ?? { raw: run.output }),
      status: 'DRAFT', safeContent: true,
    },
  })
  await audit({ actor: g.user.email, action: 'CONTENT_GENERATED', userId: g.user.id, entityId: asset.id, details: { type, topic: topic.slice(0, 100) } })
  return Response.json({ ok: true, asset, output: run.output, message: `${type} generated (${language}, ${aspect}, ${durationSec}s) and saved as draft asset.` })
}
