import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'
import { featureEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/admin/newsletter/draft {topic, audience?}
// Drafts a newsletter campaign subject + body with Muse (CST-020),
// the Copywriting dept Content Agent. The run is a REAL recorded
// AiAgentExecution (id returned so the draft can be traced to it).
// If the agent fails, we return an honest error — content is never
// fabricated locally and passed off as AI.
// The result fills the composer; the admin still reviews and saves.
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  if (!(await featureEnabled('ai_agents'))) {
    return Response.json({ error: 'AI agents are switched OFF by Super Admin — newsletter drafting unavailable.' }, { status: 403 })
  }
  const raw = await readJson(req)
  const topic = sanitizeText(raw.topic, 400).trim()
  const audience = sanitizeText(raw.audience, 200).trim()
  if (topic.length < 3) return Response.json({ error: 'A topic or goal is required to draft with AI.' }, { status: 400 })

  const input = `Draft a TECH360 newsletter email campaign.

Topic / goal: ${topic}${audience ? `\nAudience: ${audience}` : '\nAudience: subscribers to TECH360 engineering insights — business owners, founders and technical decision-makers'}

Requirements:
- Subject line: specific and honest, max 70 characters, no clickbait, no emojis.
- Body: 150-260 words of plain text (paragraphs + short bullets where they help). Warm, professional, engineer-written tone. Concrete and truthful — no invented metrics, no fabricated client names, no fake urgency.
- One clear next step at the end (e.g. reply, book a scope call, read a blog post) — no pressure language.
- Plain text only (it will be sent as email), no markdown headers.
- Sign off as "Team Tech360".

Output STRICT JSON only: {"subject":"...","body":"..."}`

  const run = await runAgent('CST-020', {
    input,
    expectJson: true,
    workflow: 'NEWSLETTER_DRAFT',
    contextNote: 'You are drafting a marketing newsletter email for TECH360 LLC (enterprise software, automation & digital transformation, bdtech360.com). The draft must be publishable as-is and honest — every claim must be verifiable from the topic provided.',
  })

  if (!run.ok) {
    return Response.json({ error: `AI draft failed: ${run.error ?? 'unknown agent error'}` }, { status: 502 })
  }
  if (!run.json || typeof run.json.subject !== 'string' || typeof run.json.body !== 'string' || !run.json.subject || !run.json.body) {
    return Response.json({ error: 'AI draft completed but returned no usable subject/body — nothing was saved. Try again with a more specific topic.' }, { status: 502 })
  }

  // verify the agent actually exists in the registry record (defense in depth)
  const agent = await db.aiAgent.findUnique({ where: { code: 'CST-020' }, select: { code: true, name: true } })

  return Response.json({
    ok: true,
    subject: sanitizeText(run.json.subject, 200),
    body: sanitizeText(run.json.body, 20_000),
    executionId: run.executionId,
    agent: agent ? { code: agent.code, name: agent.name } : { code: 'CST-020', name: 'Muse' },
  })
}
