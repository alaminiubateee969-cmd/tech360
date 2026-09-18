import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const ACTIONS = ['RELEASE', 'REJECT'] as const

// ------------------------------------------------------------
// POST /api/admin/documents/[id]/status — moderation for the
// documents hub. RELEASE: a QUARANTINED client upload passes
// human review → becomes downloadable. REJECT: the file is
// removed from the client's view (hidden, record retained for
// accountability). Every action is audited and notifies.
// ------------------------------------------------------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const { id } = await params
  const raw = await readJson(req)
  const action = sanitizeText(String(raw.action ?? ''), 20).toUpperCase()

  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return Response.json({ error: 'action must be RELEASE or REJECT.' }, { status: 400 })
  }

  const doc = await db.fileRecord.findFirst({
    where: { id, relatedType: 'CLIENT_UPLOAD' },
    select: { id: true, originalName: true, scanStatus: true, scanResult: true, client: { select: { clientId: true, name: true } } },
  })
  if (!doc) return Response.json({ error: 'Client upload not found (team-shared files do not require moderation).' }, { status: 404 })

  if (action === 'RELEASE') {
    if (doc.scanStatus !== 'QUARANTINED') {
      return Response.json({ error: `Only QUARANTINED files can be released (current: ${doc.scanStatus}).` }, { status: 409 })
    }
    await db.fileRecord.update({
      where: { id: doc.id },
      data: {
        scanStatus: 'CLEAN',
        scanResult: JSON.stringify({
          ...(safeParse(doc.scanResult) as Record<string, unknown>),
          releasedBy: g.user.email,
          releasedAt: new Date().toISOString(),
        }),
      },
    })
    await audit({
      actor: `user:${g.user.email}`,
      action: 'DOC_RELEASED',
      clientId: doc.client?.clientId,
      details: { docId: doc.id, filename: doc.originalName, reviewer: g.user.email },
    })
    return Response.json({ ok: true, status: 'CLEAN', message: `"${doc.originalName}" was released — it is now downloadable by the client.` })
  }

  // REJECT
  if (doc.scanStatus === 'REJECTED') {
    return Response.json({ error: 'This file is already rejected.' }, { status: 409 })
  }
  await db.fileRecord.update({
    where: { id: doc.id },
    data: {
      scanStatus: 'REJECTED',
      content: null, // bytes dropped — the record + verdict stay for accountability
      scanResult: JSON.stringify({
        ...(safeParse(doc.scanResult) as Record<string, unknown>),
        rejectedBy: g.user.email,
        rejectedAt: new Date().toISOString(),
      }),
    },
  })
  await audit({
    actor: `user:${g.user.email}`,
    action: 'DOC_REJECTED',
    clientId: doc.client?.clientId,
    details: { docId: doc.id, filename: doc.originalName },
  })
  await createNotification({
    type: 'CLIENT_DOC',
    severity: 'INFO',
    title: 'Client document rejected',
    body: `"${doc.originalName}" from ${doc.client?.clientId ?? 'client'} was rejected after review — hidden from the portal, content removed, record retained.`,
    link: 'clients',
  })
  return Response.json({ ok: true, status: 'REJECTED', message: `"${doc.originalName}" is rejected and hidden from the client portal.` })
}

function safeParse(s: string | null): unknown {
  if (!s) return {}
  try { return JSON.parse(s) } catch { return {} }
}
