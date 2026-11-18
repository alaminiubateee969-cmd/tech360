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
  const sortFieldRaw = sanitizeText(url.searchParams.get('sortBy') ?? 'updatedAt', 30)
  const sortDir: 'asc' | 'desc' = url.searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
  const allowedSortFields = new Set(['updatedAt', 'createdAt', 'score', 'name', 'clientId'])
  const sortBy = allowedSortFields.has(sortFieldRaw) ? sortFieldRaw : 'updatedAt'

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
      where, orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * perPage, take: perPage,
      select: {
        id: true, clientId: true, name: true, businessName: true, businessType: true,
        email: true, whatsapp: true, country: true, source: true, status: true,
        pipelineStage: true, score: true, createdAt: true, updatedAt: true,
      },
    }),
    db.client.count({ where }),
  ])
  return Response.json({ clients, total, page, perPage, sortBy, sortDir })
}

const UNGATED_BULK_STAGES = new Set([
  'NEW',
  'BUSINESS_TYPE_DETECTED',
  'PLAN_RECOMMENDED',
  'SCOPE_COLLECTION',
  'SCOPE_RECEIVED',
])

const inFlightClientKeys = new Set<string>()

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const body = await readJson(req)
  const action = sanitizeText(body.action, 40).toLowerCase()

  // Bulk status / early-stage update
  if (action === 'bulk_update') {
    const rawIds = Array.isArray(body.ids) ? body.ids : Array.isArray(body.clientIds) ? body.clientIds : []
    const ids = rawIds.map((id) => sanitizeText(id, 40)).filter(Boolean).slice(0, 100)
    if (ids.length === 0) {
      return Response.json({ error: 'Select at least one record for bulk update.' }, { status: 400 })
    }
    const nextStatusRaw = sanitizeText(body.status, 20).toUpperCase()
    const nextStageRaw = sanitizeText(body.pipelineStage, 40).toUpperCase()
    const updateData: { status?: string; pipelineStage?: string } = {}
    if (['LEAD', 'CLIENT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'LOST'].includes(nextStatusRaw)) {
      updateData.status = nextStatusRaw
    }
    if (nextStageRaw) {
      if (!UNGATED_BULK_STAGES.has(nextStageRaw)) {
        return Response.json(
          { error: `Stage ${nextStageRaw} requires governed approval/payment verification and cannot be bulk-assigned.` },
          { status: 400 },
        )
      }
      updateData.pipelineStage = nextStageRaw
    }
    if (!updateData.status && !updateData.pipelineStage) {
      return Response.json({ error: 'Provide a valid status or ungated pipelineStage to bulk update.' }, { status: 400 })
    }
    const res = await db.client.updateMany({
      where: { OR: [{ id: { in: ids } }, { clientId: { in: ids } }], deletedAt: null },
      data: updateData,
    })
    await audit({
      actor: g.user.email,
      userId: g.user.id,
      action: 'CLIENTS_BULK_UPDATED',
      entityType: 'Client',
      ip: g.ip,
      details: { updatedCount: res.count, ...updateData },
    })
    return Response.json({
      ok: true,
      updated: res.count,
      message: `Updated ${res.count} record(s).`,
    })
  }

  // Bulk CSV / JSON import mode with duplicate detection
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
    const skipDuplicates = body.skipDuplicates !== false
    const created: Array<{ id: string; clientId: string; name: string }> = []
    const duplicates: Array<{ name: string; existingClientId: string }> = []
    const seenEmails = new Set<string>()
    const seenPhones = new Set<string>()

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

      if (skipDuplicates && (email || phone)) {
        if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) {
          duplicates.push({ name, existingClientId: 'IN_BATCH_DUPLICATE' })
          continue
        }
        const existing = await db.client.findFirst({
          where: {
            deletedAt: null,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }, { whatsapp: phone }] : []),
            ],
          },
          select: { clientId: true },
        })
        if (existing) {
          duplicates.push({ name, existingClientId: existing.clientId })
          continue
        }
      }
      if (email) seenEmails.add(email)
      if (phone) seenPhones.add(phone)

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
      details: { importedCount: created.length, skippedDuplicates: duplicates.length },
    })

    return Response.json({
      ok: true,
      imported: created.length,
      skippedDuplicates: duplicates.length,
      duplicates,
      clients: created,
      message: `Imported ${created.length} lead/client record(s)${duplicates.length > 0 ? ` (${duplicates.length} duplicate(s) skipped)` : ''}.`,
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
  const allowDuplicate = body.allowDuplicate === true

  const dedupeKeys = [
    ...(email ? [`email:${email.toLowerCase()}`] : []),
    ...(phone ? [`phone:${phone}`] : []),
    ...(whatsapp && whatsapp !== phone ? [`phone:${whatsapp}`] : []),
  ]

  if (!allowDuplicate && dedupeKeys.length > 0) {
    if (dedupeKeys.some((k) => inFlightClientKeys.has(k))) {
      return Response.json(
        { error: 'A concurrent creation request for this email or phone is already in progress.', code: 'DUPLICATE_IN_FLIGHT' },
        { status: 409 },
      )
    }
    for (const k of dedupeKeys) inFlightClientKeys.add(k)
  }

  try {
    if (!allowDuplicate && (email || phone || whatsapp)) {
      const existing = await db.client.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }, { whatsapp: phone }] : []),
            ...(whatsapp && whatsapp !== phone ? [{ phone: whatsapp }, { whatsapp }] : []),
          ],
        },
        select: { id: true, clientId: true, name: true },
      })
      if (existing) {
        return Response.json(
          {
            error: `A client/lead with this email or phone already exists (${existing.clientId} — ${existing.name}).`,
            code: 'DUPLICATE_CLIENT',
            existingClientId: existing.clientId,
          },
          { status: 409 },
        )
      }
    }

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
    // Bulk imports deliberately do not emit LEAD_CREATED: imported contacts did not
    // start a conversation, so rule-driven outreach to them would bypass consent.
    const { emitLeadCreated } = await import('@/lib/automation/domain-events')
    await emitLeadCreated({ clientRowId: client.id, clientId: client.clientId, leadSource: client.source ?? null, channelSource: 'ADMIN', businessType: client.businessType ?? null, createdBy: g.user.email })

    return Response.json({
      ok: true,
      client,
      message: `Created ${client.status.toLowerCase()} ${client.clientId}.`,
    })
  } finally {
    if (!allowDuplicate) {
      for (const k of dedupeKeys) inFlightClientKeys.delete(k)
    }
  }
}
