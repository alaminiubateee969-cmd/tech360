import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, clientIp, audit, logError } from '@/lib/security'

export const dynamic = 'force-dynamic'

// SECURE SOURCE PACKAGE DOWNLOAD — gated: RELEASED status + full payment verified
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const handover = await db.handoverRecord.findUnique({ where: { packageToken: clean }, include: { project: { include: { payments: true, client: true } } } })
  if (!handover) return Response.json({ error: 'Package not found' }, { status: 404 })

  if (handover.status !== 'RELEASED' && handover.status !== 'DOWNLOADED' && handover.status !== 'CONFIRMED') {
    await logError({ source: 'SECURITY', code: 'HANDOVER_ACCESS_BLOCKED', message: `Download attempt on unreleased package ${clean.slice(0, 8)} from ${clientIp(req)}`, clientId: handover.clientId })
    return Response.json({ error: 'This package is not released. Source code becomes available only after full payment verification and admin release.' }, { status: 403 })
  }

  // Re-verify payment at download time (defense in depth)
  const paid = handover.project.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  if (handover.project.totalAmount > 0 && paid < handover.project.totalAmount) {
    await logError({ source: 'SECURITY', code: 'HANDOVER_PAYMENT_GATE', message: `Download blocked: payment incomplete for ${handover.project.code}`, clientId: handover.clientId })
    return Response.json({ error: 'Payment verification incomplete. Contact info@bdtech360.com.' }, { status: 403 })
  }

  if (handover.expiryAt && handover.expiryAt < new Date()) {
    return Response.json({ error: 'This package link has expired. Contact info@bdtech360.com for renewal.' }, { status: 410 })
  }

  await db.handoverRecord.update({ where: { id: handover.id }, data: { status: 'DOWNLOADED', downloadedAt: new Date() } })
  await audit({ actor: `client:${handover.project.client.clientId}`, action: 'SOURCE_PACKAGE_DOWNLOADED', clientId: handover.project.client.clientId, projectId: handover.projectId, ip: clientIp(req), details: { packageToken: clean.slice(0, 8) } })

  // Build a real manifest-based package (contents recorded at preparation)
  const manifest = {
    package: handover.packageToken.slice(0, 12).toUpperCase(),
    project: { code: handover.project.code, name: handover.project.name },
    client: handover.project.client.clientId,
    releasedAt: handover.releasedAt,
    downloadedAt: new Date().toISOString(),
    type: handover.type,
    contents: handover.contents ?? 'Source package manifest',
    note: 'This manifest confirms your access to the released source package. Full source archives are delivered through your project repository/secure transfer as documented in the handover record.',
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="tech360-${handover.project.code}-handover.json"`,
    },
  })
}
