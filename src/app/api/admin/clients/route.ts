import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/security'
import { PIPELINE_STAGES } from '@/lib/constants'
import { nextClientId } from '@/lib/ids'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const query = sanitizeText(url.searchParams.get('query') ?? '', 100)
  const stage = sanitizeText(url.searchParams.get('stage') ?? '', 40).toUpperCase()
  const status = sanitizeText(url.searchParams.get('status') ?? '', 40).toUpperCase()
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const rawPerPage = Number(url.searchParams.get('perPage') ?? url.searchParams.get('pageSize') ?? 20) || 20
  const perPage = Math.min(100, Math.max(1, rawPerPage))

  const where = {
    deletedAt: null,
    ...(stage && PIPELINE_STAGES.includes(stage as (typeof PIPELINE_STAGES)[number]) ? { pipelineStage: stage } : {}),
    ...(status ? { status } : {}),
    ...(query ? {
      OR: [
        { clientId: { contains: query } }, { name: { contains: query } },
        { businessName: { contains: query } }, { email: { contains: query } },
        { whatsapp: { contains: query } }, { businessType: { contains: query } },
      ],
    } : {}),
  }

  const [clients, total] = await Promise.all([
    db.client.findMany({
      where, orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage, take: perPage,
      select: {
        id: true, clientId: true, name: true, businessName: true, businessType: true,
        email: true, whatsapp: true, country: true, source: true, status: true,
        pipelineStage: true, score: true, createdAt: true, updatedAt: true,
      },
    }),
    db.client.count({ where }),
  ])
  return Response.json({ clients, total, page, perPage })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = await readJson(req)

  // Bulk CSV / JSON import mode
  const importList = Array.isArray(body.records)
    ? body.records
    : Array.isArray(body.rows)
      ? body.rows
      : null
  if (importList) {
    const rawRecords = importList.slice(0, 200)
    if (rawRecords.length === 0) {
      return Response.json({ error: 'No records provided for import.' }, { status: 400 })
    }
    const created: Array<{ id: string; clientId: string; name: string }> = []
    for (const row of rawRecords) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const name = sanitizeText(r.name, 120)
      if (!name) continue
      const businessName = sanitizeText(r.businessName ?? r.business, 160) || null
      const businessType = sanitizeText(r.businessType ?? r.type, 100) || null
      const email = sanitizeEmail(r.email) || null
      const phone = sanitizePhone(r.phone) || null
      const whatsapp = sanitizePhone(r.whatsapp ?? r.phone) || null
      const source = sanitizeText(r.source, 40).toUpperCase() || 'CSV_IMPORT'
      const status = ['LEAD', 'CLIENT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'LOST'].includes(
        sanitizeText(r.status, 20).toUpperCase(),
      )
        ? sanitizeText(r.status, 20).toUpperCase()
        : 'LEAD'
      const stageRaw = sanitizeText(r.pipelineStage ?? r.stage, 40).toUpperCase()
      const pipelineStage = PIPELINE_STAGES.includes(stageRaw as (typeof PIPELINE_STAGES)[number])
        ? stageRaw
        : 'NEW'

      const clientId = await nextClientId()
      const client = await db.client.create({
        data: {
          clientId,
          name,
          businessName,
          businessType,
          email,
          phone,
          whatsapp,
          source,
          status,
          pipelineStage,
          lead: {
            create: {
              sourceDetails: source,
              qualifiedAt: new Date(),
            },
          },
        },
        select: { id: true, clientId: true, name: true },
      })
      created.push(client)
    }

    await audit({
      actor: g.user.email,
      userId: g.user.id,
      action: 'LEADS_IMPORTED',
      entityType: 'Client',
      ip: g.ip,
      details: { importedCount: created.length },
    })

    return Response.json({
      ok: true,
      imported: created.length,
      clients: created,
      message: `Imported ${created.length} lead/client record(s).`,
    })
  }

  // Single Lead / Client creation
  const name = sanitizeText(body.name, 120)
  if (name.length < 2) {
    return Response.json({ error: 'Name must be at least 2 characters.' }, { status: 400 })
  }
  const businessName = sanitizeText(body.businessName, 160) || null
  const businessType = sanitizeText(body.businessType, 100) || null
  const email = sanitizeEmail(body.email) || null
  const phone = sanitizePhone(body.phone) || null
  const whatsapp = sanitizePhone(body.whatsapp ?? body.phone) || null
  const country = sanitizeText(body.country, 80) || null
  const source = sanitizeText(body.source, 40).toUpperCase() || 'MANUAL_CRM'
  const rawStatus = sanitizeText(body.status, 20).toUpperCase()
  const status = ['LEAD', 'CLIENT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'LOST'].includes(rawStatus)
    ? rawStatus
    : 'LEAD'
  const rawStage = sanitizeText(body.pipelineStage, 40).toUpperCase()
  const pipelineStage = PIPELINE_STAGES.includes(rawStage as (typeof PIPELINE_STAGES)[number])
    ? rawStage
    : 'NEW'
  const notes = sanitizeText(body.notes, 4000) || null

  const clientId = await nextClientId()
  const client = await db.client.create({
    data: {
      clientId,
      name,
      businessName,
      businessType,
      email,
      phone,
      whatsapp,
      country,
      source,
      status,
      pipelineStage,
      notes,
      lead: {
        create: {
          requirements: notes,
          sourceDetails: source,
          qualifiedAt: new Date(),
        },
      },
    },
    select: {
      id: true,
      clientId: true,
      name: true,
      businessName: true,
      businessType: true,
      email: true,
      whatsapp: true,
      country: true,
      source: true,
      status: true,
      pipelineStage: true,
      score: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await audit({
    actor: g.user.email,
    userId: g.user.id,
    action: 'CLIENT_CREATED',
    entityType: 'Client',
    entityId: client.id,
    clientId: client.clientId,
    ip: g.ip,
    details: { status: client.status, pipelineStage: client.pipelineStage, source: client.source },
  })

  return Response.json({
    ok: true,
    client,
    message: `Created ${client.status.toLowerCase()} ${client.clientId}.`,
  })
}
