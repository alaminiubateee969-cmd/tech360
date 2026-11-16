import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canDecidePreview, forwardPipelineStage } from '@/lib/preview-policy'
import { sanitizeText, readJson, rateLimit, clientIp, audit, logError } from '@/lib/security'
import { recordPreviewDecision } from '@/lib/journey'

export const dynamic = 'force-dynamic'

// Public client decision on an HTML preview: approve or request revision.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rl = rateLimit(`preview-action:${clientIp(req)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429 })
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean }, include: { client: true } })
  if (!preview || !preview.client) return Response.json({ error: 'Preview not found' }, { status: 404 })

  if (preview.status === 'APPROVED' || preview.status === 'REVISION_REQUESTED') {
    return Response.json({ error: `This preview has already been marked ${preview.status}. A new preview version must be issued for further decisions.`, code: 'PREVIEW_ALREADY_DECIDED', status: preview.status }, { status: 409 })
  }
  if ((preview.expiresAt && preview.expiresAt.getTime() <= Date.now()) || !canDecidePreview(preview.status)) {
    return Response.json({ error: 'This preview link has expired. Please contact info@bdtech360.com for a fresh link.' }, { status: 410 })
  }

  const raw = await readJson(req)
  const decision = sanitizeText(raw.decision, 40).toUpperCase()
  const notes = sanitizeText(raw.notes, 4000)
  if (decision !== 'APPROVED' && decision !== 'REVISION_REQUESTED') return Response.json({ error: 'decision must be APPROVED or REVISION_REQUESTED' }, { status: 400 })
  if (decision === 'REVISION_REQUESTED' && notes.length < 5) return Response.json({ error: 'Please describe your change requests' }, { status: 400 })

  try {
    // Claim, event and communication are one transaction. Concurrent decisions
    // cannot both win, and a failure cannot leave a decision without its record.
    const now = new Date()
    const recorded = await db.$transaction(async (tx) => {
      const claim = await tx.preview.updateMany({
        where: { id: preview.id, status: { in: ['GENERATED', 'SENT', 'VIEWED'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        data: decision === 'APPROVED' ? { status: decision, approvedAt: now } : { status: decision, revisionNotes: notes },
      })
      if (claim.count !== 1) return false
      await tx.previewEvent.create({ data: { previewId: preview.id, type: decision, ...(decision === 'REVISION_REQUESTED' ? { meta: JSON.stringify({ notes: notes.slice(0, 500) }) } : {}) } })
      await tx.communication.create({ data: {
        clientId: preview.clientId, channel: 'PORTAL', direction: 'IN', sender: preview.client.name,
        body: decision === 'APPROVED' ? 'HTML preview APPROVED by client' : `Preview revision requested: ${notes}`, status: 'RECEIVED',
      } })
      if (decision === 'APPROVED') {
        const current = await tx.client.findUnique({ where: { id: preview.clientId }, select: { pipelineStage: true } })
        if (current) {
          const next = forwardPipelineStage(current.pipelineStage, 'CLIENT_APPROVAL')
          if (next !== current.pipelineStage) await tx.client.updateMany({ where: { id: preview.clientId, pipelineStage: current.pipelineStage }, data: { pipelineStage: next } })
        }
      }
      return true
    })
    if (!recorded) return Response.json({ error: 'This preview was already decided or expired. Please refresh or contact support.', code: 'PREVIEW_ALREADY_DECIDED' }, { status: 409 })
  } catch (error) {
    await logError({ source: 'API', code: 'PREVIEW_ACTION_FAILED', message: error instanceof Error ? error.message : 'unknown', clientId: preview.client.clientId }).catch(() => null)
    return Response.json({ error: 'Could not record your response. Please contact info@bdtech360.com.' }, { status: 500 })
  }

  if (decision === 'APPROVED') {
    await db.trackingEvent.create({ data: { name: 'approval', clientId: preview.clientId, consent: true, meta: '{"what":"preview"}' } }).catch(() => null)
  }
  // The decision has committed. An ancillary notification failure must not
  // falsely tell the customer that their decision failed or trigger a re-send.
  let followUpStatus = 'COMPLETED'
  let paymentInstruction: string | undefined
  try {
    const outcome = await recordPreviewDecision(preview.clientId, decision, notes)
    if (decision === 'APPROVED') paymentInstruction = outcome.sent.status
  } catch (error) {
    followUpStatus = 'NEEDS_REVIEW'
    await logError({ source: 'API', code: 'PREVIEW_FOLLOWUP_FAILED', message: error instanceof Error ? error.message : 'unknown', clientId: preview.client.clientId }).catch(() => null)
  }
  await audit({ actor: `client:${preview.client.clientId}`, action: decision === 'APPROVED' ? 'PREVIEW_APPROVED' : 'PREVIEW_REVISION_REQUESTED', clientId: preview.client.clientId, details: decision === 'REVISION_REQUESTED' ? { notes: notes.slice(0, 300), followUpStatus } : { followUpStatus }, ip: clientIp(req) }).catch(() => null)
  return Response.json({
    ok: true, followUpStatus, ...(paymentInstruction ? { paymentInstruction } : {}),
    message: followUpStatus === 'NEEDS_REVIEW'
      ? 'Your response was recorded, but follow-up is delayed. Please contact info@bdtech360.com if you do not hear from us.'
      : decision === 'APPROVED' ? 'Approval recorded. Team Tech360 will continue with payment instructions.' : 'Change request recorded. Team Tech360 will review and update the preview.',
  })
}
