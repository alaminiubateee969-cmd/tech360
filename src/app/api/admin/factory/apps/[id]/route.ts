import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { normalizeBrief, buildPlan, buildFiles, summarizeFiles, assertNoSecrets } from '@/lib/factory/blueprint'

export const dynamic = 'force-dynamic'

type Stage = 'BRIEF' | 'PLAN' | 'SCAFFOLD' | 'PREVIEW' | 'DELIVERY' | 'HANDOVER'
type Status = 'DRAFT' | 'PLANNED' | 'BUILT' | 'PREVIEW' | 'APPROVED' | 'DELIVERED' | 'FAILED'

const TRANSITIONS: Record<string, { stage: Stage; status: Status; note: string; requiresAdmin?: boolean }> = {
  plan: { stage: 'PLAN', status: 'PLANNED', note: 'Blueprint (re)generated from the brief.' },
  build: { stage: 'SCAFFOLD', status: 'BUILT', note: 'Source tree written and stored — ready for review.' },
  preview: { stage: 'PREVIEW', status: 'PREVIEW', note: 'Preview stage: client-facing walkthrough prepared.' },
  approve: { stage: 'DELIVERY', status: 'APPROVED', note: 'Client approval recorded; delivery package may be prepared.', requiresAdmin: true },
  deliver: { stage: 'DELIVERY', status: 'DELIVERED', note: 'Delivery package handed to the client.', requiresAdmin: true },
  handover: { stage: 'HANDOVER', status: 'DELIVERED', note: 'Source, credentials list and runbook handed over.', requiresAdmin: true },
  fail: { stage: 'PLAN', status: 'FAILED', note: 'Generation or review failed.' },
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params

  const app = await db.generatedApp.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!app) return Response.json({ error: 'Generated app not found.' }, { status: 404 })

  const [files, events] = await Promise.all([
    db.generatedAppFile.findMany({ where: { appId: app.id }, select: { id: true, path: true, language: true, bytes: true }, orderBy: { path: 'asc' } }),
    db.generatedAppEvent.findMany({ where: { appId: app.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  return Response.json({
    app,
    plan: safeParse(app.plan),
    brief: safeParse(app.brief),
    files,
    events,
    exportUrl: `/api/admin/factory/apps/${app.id}/export`,
  })
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = sanitizeText(body.action ?? '', 20).toLowerCase()
  const note = sanitizeText(body.note ?? '', 500)
  const transition = TRANSITIONS[action]
  if (!transition) return Response.json({ error: `Unknown action “${action}”.` }, { status: 400 })
  if (transition.requiresAdmin && !['ADMIN', 'SUPER_ADMIN'].includes(String(g.user.role))) {
    return Response.json({ error: 'Approval, delivery and handover are admin actions.' }, { status: 403 })
  }

  const app = await db.generatedApp.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!app) return Response.json({ error: 'Generated app not found.' }, { status: 404 })
  if (app.status === 'DELIVERED' && action !== 'handover') {
    return Response.json({ error: 'This app is already delivered. Handover is the only remaining transition.' }, { status: 409 })
  }

  // `plan` regenerates the blueprint and the source tree from the stored brief.
  if (action === 'plan') {
    const brief = normalizeBrief(JSON.parse(app.brief) as Record<string, unknown>)
    const plan = buildPlan(brief)
    const files = buildFiles(brief, plan)
    const secrets = assertNoSecrets(files)
    if (!secrets.ok) return Response.json({ error: `Regeneration refused: ${secrets.path} contains secret-like content.` }, { status: 500 })
    const { fileCount, totalBytes } = summarizeFiles(files)
    await db.generatedAppFile.deleteMany({ where: { appId: app.id } })
    await db.generatedAppFile.createMany({
      data: files.map((f) => ({ appId: app.id, path: f.path, language: f.language, bytes: Buffer.byteLength(f.content, 'utf8'), content: f.content })),
    })
    await db.generatedApp.update({ where: { id: app.id }, data: { plan: JSON.stringify(plan), brief: JSON.stringify(brief), fileCount, totalBytes } })
  }

  const updated = await db.generatedApp.update({
    where: { id: app.id },
    data: {
      stage: transition.stage,
      status: transition.status,
      ...(action === 'deliver' || action === 'handover' ? { deliveredAt: new Date() } : {}),
    },
  })

  await db.generatedAppEvent.create({
    data: { appId: app.id, stage: transition.stage, status: transition.status, note: note || transition.note, actor: g.user.email },
  })
  await audit({ actor: g.user.email, action: `FACTORY_APP_${action.toUpperCase()}`, userId: g.user.id, details: `${app.code} → ${transition.status}` })

  return Response.json({ app: updated, transition: { action, ...transition } })
}
