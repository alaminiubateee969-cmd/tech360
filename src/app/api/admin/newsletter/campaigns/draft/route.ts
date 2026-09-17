import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { runAgent } from '@/lib/agents/engine'
import { featureEnabled } from '@/lib/features'
import { sanitizeCampaignHtml } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/admin/newsletter/campaigns/draft
// AI-draft a campaign via the CST-020 (Muse) content agent.
// Honest failure: when the agent run fails (provider quota,
// network, bad output) the real error is returned with 502 and
// NO campaign row is created.
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  if (!(await featureEnabled('ai_agents'))) {
    return Response.json({ error: 'AI agents are switched off by Super Admin — campaign drafting needs the ai_agents feature.' }, { status: 403 })
  }

  const raw = await readJson(req)
  const topic = sanitizeText(raw.topic, 300).trim()

  const input = [
    'Draft one TECH360 newsletter campaign.',
    topic ? `Topic hint from the editor: "${topic}".` : 'Topic: your choice — pick a practical engineering theme that fits recent platform work (previews before payment, honest delivery, automation discipline, AI agents that execute).',
    '',
    'TECH360 voice: practical engineering insight, no fluff, one clear takeaway.',
    '',
    'Return STRICT JSON only (no markdown fences, no commentary) with exactly these keys:',
    '{',
    '  "name": "short internal campaign name (3-7 words)",',
    '  "subject": "email subject line that promises one concrete insight, under 70 chars",',
    '  "body": "HTML-ish simple paragraphs — one <p> per thought, no images, no links, 3-5 paragraphs, plain and useful"',
    '}',
  ].join('\n')

  const run = await runAgent('CST-020', { input, expectJson: true, workflow: 'NEWSLETTER_DRAFT' })

  if (!run.ok) {
    // honest failure — the engine already recorded the failed execution
    return Response.json(
      { error: `AI draft failed — ${run.error ?? 'unknown provider error'}`, executionId: run.executionId, correlationId: run.correlationId },
      { status: 502 },
    )
  }

  const json = run.json
  if (!json || typeof json.name !== 'string' || typeof json.subject !== 'string' || typeof json.body !== 'string') {
    return Response.json(
      { error: 'AI draft completed but did not return the required {name, subject, body} JSON structure — nothing was saved.', executionId: run.executionId },
      { status: 502 },
    )
  }

  const name = sanitizeText(json.name, 120).trim() || 'Untitled campaign'
  const subject = sanitizeText(json.subject, 200).trim() || 'TECH360 engineering insights'
  const body = sanitizeCampaignHtml(json.body)

  const campaign = await db.emailCampaign.create({
    data: {
      name,
      subject,
      body,
      status: 'DRAFT',
      agentExecId: run.executionId,
      createdBy: g.user.email,
    },
  })

  await audit({
    actor: g.user.email,
    action: 'NEWSLETTER_DRAFTED',
    userId: g.user.id,
    entityType: 'EMAIL_CAMPAIGN',
    entityId: campaign.id,
    details: { topic: topic || '(agent-chosen)', agentExecId: run.executionId, subject },
  })

  return Response.json({ ok: true, campaign, agent: { executionId: run.executionId, status: run.status } })
}
