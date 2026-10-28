import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { mediaProviderStates, nextJobStatus, toSrt, toVtt, type PlannedShot } from '@/lib/media/studio'

export const dynamic = 'force-dynamic'

const TEXT_FORMATS = ['srt', 'vtt', 'script', 'composition'] as const
type TextFormat = (typeof TEXT_FORMATS)[number]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params

  const job = await db.mediaJob.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!job) return Response.json({ error: 'Media job not found.' }, { status: 404 })

  const shots = await db.mediaShot.findMany({ where: { jobId: job.id }, orderBy: { seq: 'asc' } })
  const url = new URL(req.url)
  const format = sanitizeText(url.searchParams.get('format') ?? '', 16).toLowerCase() as TextFormat | ''

  if (format && (TEXT_FORMATS as readonly string[]).includes(format)) {
    const planned: PlannedShot[] = shots.map((s) => ({
      seq: s.seq,
      startSec: s.startSec,
      endSec: s.endSec,
      kind: s.kind as PlannedShot['kind'],
      visual: s.visual,
      narration: s.narration,
      overlay: s.overlay,
    }))
    const payload =
      format === 'srt' ? toSrt(planned)
      : format === 'vtt' ? toVtt(planned)
      : format === 'script' ? job.script
      : job.plan
    const ext = format === 'composition' ? 'json' : format === 'script' ? 'txt' : format
    const contentType = format === 'composition' ? 'application/json' : format === 'script' ? 'text/plain' : 'text/vtt'
    return new Response(payload, {
      status: 200,
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${job.code.toLowerCase()}-${format}.${ext}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  }

  return Response.json({ job, shots, providers: mediaProviderStates() })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = sanitizeText(body.action ?? '', 20).toLowerCase()
  if (!['plan', 'voice', 'captions', 'queue-render', 'fail'].includes(action)) {
    return Response.json({ error: `Unknown action “${action}”.` }, { status: 400 })
  }

  const job = await db.mediaJob.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!job) return Response.json({ error: 'Media job not found.' }, { status: 404 })

  const providers = mediaProviderStates()
  const next = action === 'fail'
    ? { status: 'FAILED', note: sanitizeText(body.note ?? '', 300) || 'Marked failed by an operator.' }
    : nextJobStatus(action as 'plan' | 'voice' | 'captions' | 'queue-render', providers)

  const updated = await db.mediaJob.update({
    where: { id: job.id },
    data: {
      status: next.status,
      renderState: providers.render.state,
      voiceState: providers.voice.state,
      ...(action === 'queue-render' && providers.render.state === 'AVAILABLE' ? { provider: 'CONFIGURED' } : {}),
    },
  })

  // Only a provider-backed action is a "production" event worth auditing as such.
  await audit({
    actor: g.user.email,
    action: `MEDIA_JOB_${action.toUpperCase().replace('-', '_')}`,
    userId: g.user.id,
    entityId: job.id,
    details: { code: job.code, from: job.status, to: next.status, note: next.note, renderState: providers.render.state },
  })

  return Response.json({ job: updated, note: next.note, providers })
}
