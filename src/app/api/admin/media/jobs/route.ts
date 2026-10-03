import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import {
  normalizeMediaBrief,
  planShots,
  buildScript,
  toSrt,
  compositionSpec,
  mediaProviderStates,
} from '@/lib/media/studio'

export const dynamic = 'force-dynamic'

// Media Studio — brief → shot plan → narration → captions → render spec.
// Nothing here fabricates a rendered file: render/voice states are computed
// from real configuration and reported honestly.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 24).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)

  const jobs = await db.mediaJob.findMany({
    where: { ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const providers = mediaProviderStates()
  return Response.json({ jobs, providers })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const brief = normalizeMediaBrief(body)
  const shots = planShots(brief)
  const script = buildScript(brief, shots)
  const captions = toSrt(shots)
  const spec = compositionSpec(brief, shots)
  const providers = mediaProviderStates()

  const count = await db.mediaJob.count()
  const code = `MS-${String(count + 1).padStart(4, '0')}`

  const job = await db.mediaJob.create({
    data: {
      code,
      title: brief.title,
      kind: brief.kind,
      language: brief.language,
      aspect: brief.aspect,
      durationSec: brief.durationSec,
      script,
      plan: JSON.stringify(spec),
      captions,
      status: 'PLANNED',
      renderState: providers.render.state,
      voiceState: providers.voice.state,
      provider: providers.render.state === 'AVAILABLE' ? 'CONFIGURED' : null,
      clientId: sanitizeText(body.clientId ?? '', 40).trim() || null,
      projectId: sanitizeText(body.projectId ?? '', 40).trim() || null,
      createdBy: g.user.email,
      shots: {
        create: shots.map((s) => ({
          seq: s.seq,
          startSec: s.startSec,
          endSec: s.endSec,
          kind: s.kind,
          visual: s.visual,
          narration: s.narration,
          overlay: s.overlay,
        })),
      },
    },
  })

  await audit({ actor: g.user.email, action: 'MEDIA_JOB_CREATED', userId: g.user.id, entityId: job.id, details: { code, kind: brief.kind, shots: shots.length } })

  return Response.json({ job, shots, providers, script }, { status: 201 })
}
