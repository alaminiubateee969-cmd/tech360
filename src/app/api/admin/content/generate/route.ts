import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

const AGENT_BY_TYPE: Record<string, string> = {
  RESEARCH: 'CST-020', HOOK: 'CST-020', SCRIPT: 'CST-020', CAPTIONS: 'CST-020',
  MARKETING_KIT: 'CST-020', SEO_BRIEF: 'CST-020',
  IMAGE_PROMPT: 'DSN-021', THUMBNAIL: 'DSN-021',
  VIDEO_PLAN: 'VID-022', EDIT_PLAN: 'VID-022', MUSIC_BRIEF: 'VID-022',
  VOICEOVER: 'VOX-043',
}

const TYPE_INSTRUCTIONS: Record<string, string> = {
  MARKETING_KIT: `Return one implementation-ready marketing kit as strict JSON with these keys:
brand_positioning (promise, proof_points, differentiators, tone, words_to_use, words_to_avoid),
audiences (three ICPs with pains, desired_outcomes and objections),
messaging (tagline, elevator_pitch, headline_options, CTA_options),
channel_plan (website, email, LinkedIn, Facebook, Instagram and short_video; for each include objective, format, cadence and KPI),
launch_campaign (goal, offer, funnel stages, 4-week calendar and budget_split_percent),
asset_pack (landing_page_outline, five social posts, three ad variants, five-email sequence, press_blurb, sales_one_pager),
measurement (north_star_metric, leading_indicators, UTM_naming and weekly_review_checklist),
compliance_checklist. Be concrete, internally consistent, and ready to copy into production. Never invent customer results or testimonials.`,
  SEO_BRIEF: `Return an implementation-ready SEO brief as strict JSON with keys: search_intent, primary_keyword,
secondary_keywords, audience_questions, title_options, meta_description, slug, outline, internal_links,
schema_recommendations, E_E_A_T_evidence_needed, conversion_path and measurement_plan. Do not invent search volume.`,
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

  const prompt = `Topic or offer: ${topic}\nType: ${type}\nLanguage: ${language === 'BN' ? 'Bangla' : 'English'}\nAspect ratio: ${aspect}\nDuration: ${durationSec} seconds (when applicable)\nSafe/family-friendly: MANDATORY\nPlatform goals: useful, specific, conversion-aware, honest value, no engagement-bait or unsupported claims.\n${TYPE_INSTRUCTIONS[type] ?? 'Return structured JSON appropriate to this asset type.'}`

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
