import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, readJson, sanitizeText } from '@/lib/security'
import {
  buildChangeRequestScopeContent,
  canEditScopeInPlace,
  nextScopeVersionNumber,
  normalizeTo21PointScope,
  SCOPE_21_SECTIONS,
  validate21PointScope,
  type ScopeSectionKey,
} from '@/lib/scope-validator'
import { finalizeScopeAndSend } from '@/lib/journey'

export const dynamic = 'force-dynamic'

function parseJsonSafe(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// GET /api/admin/scopes?clientId=... — list versioned scopes + 21-section validation status
export async function GET(req: NextRequest) {
  const g = await guard(req, { capability: 'crm.read', capabilityOnly: true })
  if (isResponse(g)) return g

  const clientRef = sanitizeText(req.nextUrl.searchParams.get('clientId') ?? '', 40)
  let clientFilter: { clientId?: string } = {}
  if (clientRef) {
    const client = await db.client.findFirst({
      where: { OR: [{ id: clientRef }, { clientId: clientRef }] },
      select: { id: true },
    })
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })
    clientFilter = { clientId: client.id }
  }

  const scopes = await db.scopeOfWork.findMany({
    where: clientFilter,
    include: {
      client: { select: { id: true, clientId: true, name: true, businessName: true } },
      project: { select: { id: true, code: true, name: true } },
      approvals: { orderBy: { decidedAt: 'desc' } },
    },
    orderBy: [{ updatedAt: 'desc' }, { version: 'desc' }],
    take: 100,
  })

  return Response.json({
    ok: true,
    scopes: scopes.map((s) => {
      const parsed = parseJsonSafe(s.content)
      const validation = validate21PointScope(parsed)
      return {
        ...s,
        parsedContent: parsed,
        validation,
        immutable: !canEditScopeInPlace(s.status),
      }
    }),
  })
}

// POST /api/admin/scopes — create a new 21-point SOW draft OR a versioned Change Request superseding an approved SOW
export async function POST(req: NextRequest) {
  const g = await guard(req, { capability: 'scope.write', capabilityOnly: true })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  if (!clientRef) {
    return Response.json({ ok: false, code: 'CLIENT_REQUIRED', error: 'clientId is required.' }, { status: 400 })
  }

  const client = await db.client.findFirst({
    where: { OR: [{ id: clientRef }, { clientId: clientRef }], deletedAt: null },
    include: { lead: true },
  })
  if (!client) {
    return Response.json({ ok: false, code: 'CLIENT_NOT_FOUND', error: 'Active client not found.' }, { status: 404 })
  }

  let projectId: string | null = null
  if (raw.projectId) {
    const pRef = sanitizeText(raw.projectId, 40)
    const proj = await db.project.findFirst({
      where: { clientId: client.id, OR: [{ id: pRef }, { code: pRef }] },
      select: { id: true },
    })
    if (!proj) {
      return Response.json({ ok: false, code: 'PROJECT_NOT_FOUND', error: 'Project not found for this client.' }, { status: 404 })
    }
    projectId = proj.id
  }

  const existingScopes = await db.scopeOfWork.findMany({
    where: { clientId: client.id },
    orderBy: { version: 'desc' },
  })
  const nextVersion = nextScopeVersionNumber(existingScopes.map((s) => s.version))
  const latestApproved = existingScopes.find((s) => s.status === 'FINAL' || s.status === 'APPROVED') ?? null

  const mode = sanitizeText(raw.mode, 32).toLowerCase() // 'change_request' | 'draft'
  const summary = sanitizeText(raw.summary, 1000)

  // Post-approval rule: if an APPROVED/FINAL scope already exists, creating a new version requires Change Request metadata
  if (latestApproved || mode === 'change_request') {
    const baseScope = latestApproved ?? existingScopes[0]
    if (!baseScope) {
      return Response.json(
        { ok: false, code: 'BASE_SCOPE_NOT_FOUND', error: 'No prior scope exists to create a Change Request against.' },
        { status: 400 },
      )
    }

    const updatedSections: Partial<Record<ScopeSectionKey, unknown>> = {}
    if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
      const secObj = raw.sections as Record<string, unknown>
      for (const k of SCOPE_21_SECTIONS) {
        if (secObj[k] !== undefined) {
          updatedSections[k] = typeof secObj[k] === 'string' ? sanitizeText(secObj[k], 4000) : secObj[k]
        }
      }
    }

    const cr = buildChangeRequestScopeContent({
      priorContent: normalizeTo21PointScope(parseJsonSafe(baseScope.content), {
        clientId: client.clientId,
        clientName: client.name,
        businessName: client.businessName,
        businessType: client.businessType,
        plan: client.lead?.interest,
        budgetRange: client.lead?.budgetRange,
      }),
      priorVersion: baseScope.version,
      updatedSections,
      summary: summary || undefined,
      reason: sanitizeText(raw.reason, 1000),
      costImpact: sanitizeText(raw.costImpact, 300),
      timelineImpact: sanitizeText(raw.timelineImpact, 300),
      requestedBy: g.user.email,
    })
    if (!cr.ok) {
      return Response.json(cr, { status: 400 })
    }

    const validation = validate21PointScope(cr.content)
    if (!validation.valid) {
      return Response.json(
        {
          ok: false,
          code: 'INCOMPLETE_21_POINT_SCOPE',
          error: `Scope Change Request is missing ${validation.missingSections.length} required section(s).`,
          validation,
        },
        { status: 400 },
      )
    }

    const created = await db.scopeOfWork.create({
      data: {
        clientId: client.id,
        projectId: projectId ?? baseScope.projectId,
        version: nextVersion,
        status: 'AWAITING_ADMIN_APPROVAL',
        summary: summary || `Change Request v${nextVersion} (supersedes v${baseScope.version})`,
        content: JSON.stringify(cr.content),
        generatedBy: `MANUAL:${g.user.email}`,
      },
    })

    await db.approvalRequest.create({
      data: {
        type: 'FINAL_SCOPE_SEND',
        title: `Approve Scope Change Request v${created.version} for ${client.clientId}`,
        description: `Reason: ${sanitizeText(raw.reason, 500)} | Cost: ${sanitizeText(raw.costImpact, 200)} | Timeline: ${sanitizeText(raw.timelineImpact, 200)}`,
        clientId: client.id,
        projectId: created.projectId,
        payload: JSON.stringify({ scopeId: created.id, version: created.version, changeRequest: cr.content.changeRequest }),
        risk: 'HIGH',
        requestedBy: g.user.email,
      },
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'SCOPE_CHANGE_REQUEST_CREATED',
      entityType: 'ScopeOfWork',
      entityId: created.id,
      clientId: client.clientId,
      details: {
        version: created.version,
        supersedesVersion: baseScope.version,
        costImpact: sanitizeText(raw.costImpact, 200),
        timelineImpact: sanitizeText(raw.timelineImpact, 200),
      },
      ip: g.ip,
    })

    return Response.json({ ok: true, scope: created, validation }, { status: 201 })
  }

  // Initial manual SOW draft (no AI required — full manual fallback)
  const rawContent =
    raw.content && typeof raw.content === 'object' && !Array.isArray(raw.content)
      ? (raw.content as Record<string, unknown>)
      : { title: sanitizeText(raw.title, 200) || `${client.businessName || client.name} — Scope of Work`, summary, sections: raw.sections ?? {} }

  const normalized = normalizeTo21PointScope(rawContent, {
    clientId: client.clientId,
    clientName: client.name,
    businessName: client.businessName,
    businessType: client.businessType,
    plan: client.lead?.interest,
    budgetRange: client.lead?.budgetRange,
  })
  const validation = validate21PointScope(normalized)

  const created = await db.scopeOfWork.create({
    data: {
      clientId: client.id,
      projectId,
      version: nextVersion,
      status: raw.submitForApproval ? 'AWAITING_ADMIN_APPROVAL' : 'DRAFT',
      summary: summary || String(normalized.summary ?? '21-Section Scope of Work'),
      content: JSON.stringify(normalized),
      generatedBy: `MANUAL:${g.user.email}`,
    },
  })

  await audit({
    userId: g.user.id,
    actor: g.user.email,
    action: 'SCOPE_DRAFT_CREATED',
    entityType: 'ScopeOfWork',
    entityId: created.id,
    clientId: client.clientId,
    details: { version: created.version, status: created.status, presentSections: validation.presentCount },
    ip: g.ip,
  })

  return Response.json({ ok: true, scope: created, validation }, { status: 201 })
}

// PATCH /api/admin/scopes — update pre-approval draft OR approve & finalize a validated 21-section SOW
export async function PATCH(req: NextRequest) {
  const raw = await readJson(req)
  const action = sanitizeText(raw.action, 40).toLowerCase()
  const scopeId = sanitizeText(raw.scopeId, 40)
  if (!scopeId) {
    return Response.json({ ok: false, code: 'SCOPE_ID_REQUIRED', error: 'scopeId is required.' }, { status: 400 })
  }

  const requiredCapability = action === 'approve_and_send' || action === 'approve' ? 'scope.approve' : 'scope.write'
  const g = await guard(req, { capability: requiredCapability, capabilityOnly: true })
  if (isResponse(g)) return g

  const scope = await db.scopeOfWork.findUnique({
    where: { id: scopeId },
    include: { client: true },
  })
  if (!scope) {
    return Response.json({ ok: false, code: 'SCOPE_NOT_FOUND', error: 'Scope not found.' }, { status: 404 })
  }

  if (action === 'edit' || !action) {
    if (!canEditScopeInPlace(scope.status)) {
      return Response.json(
        {
          ok: false,
          code: 'SCOPE_IMMUTABLE',
          error: `Scope v${scope.version} is ${scope.status} and immutable. Submit a versioned Change Request instead of editing in place.`,
        },
        { status: 409 },
      )
    }

    const current = parseJsonSafe(scope.content)
    const nextSections =
      raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)
        ? { ...(current.sections as Record<string, unknown> | undefined), ...(raw.sections as Record<string, unknown>) }
        : current.sections
    const merged = {
      ...current,
      ...(raw.summary !== undefined ? { summary: sanitizeText(raw.summary, 1000) } : {}),
      sections: nextSections,
    }
    const validation = validate21PointScope(merged)

    const updated = await db.scopeOfWork.update({
      where: { id: scope.id },
      data: {
        summary: raw.summary !== undefined ? sanitizeText(raw.summary, 1000) : scope.summary,
        content: JSON.stringify(merged),
        reviewedBy: g.user.id,
      },
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'SCOPE_DRAFT_UPDATED',
      entityType: 'ScopeOfWork',
      entityId: scope.id,
      clientId: scope.client.clientId,
      details: { version: scope.version, valid21Point: validation.valid },
      ip: g.ip,
    })

    return Response.json({ ok: true, scope: updated, validation })
  }

  if (action === 'approve' || action === 'approve_and_send') {
    const parsed = parseJsonSafe(scope.content)
    const validation = validate21PointScope(parsed)
    if (!validation.valid) {
      return Response.json(
        {
          ok: false,
          code: 'INCOMPLETE_21_POINT_SCOPE',
          error: `Cannot approve Scope v${scope.version}: ${validation.missingSections.length} of 21 required sections are missing.`,
          validation,
        },
        { status: 400 },
      )
    }

    if (action === 'approve_and_send') {
      const res = await finalizeScopeAndSend(scope.id, g.user.id)
      return Response.json({ ok: true, finalized: true, delivery: res.results, validation })
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.scopeOfWork.update({
        where: { id: scope.id },
        data: { status: 'APPROVED', approvedBy: g.user.id, approvedAt: new Date() },
      })
      await tx.scopeOfWork.updateMany({
        where: {
          clientId: scope.clientId,
          id: { not: scope.id },
          status: { in: ['DRAFT', 'AWAITING_ADMIN_APPROVAL', 'APPROVED', 'FINAL'] },
        },
        data: { status: 'SUPERSEDED' },
      })
      return next
    })

    await audit({
      userId: g.user.id,
      actor: g.user.email,
      action: 'SCOPE_APPROVED',
      entityType: 'ScopeOfWork',
      entityId: scope.id,
      clientId: scope.client.clientId,
      details: { version: scope.version },
      ip: g.ip,
    })

    return Response.json({ ok: true, scope: updated, validation })
  }

  return Response.json({ ok: false, code: 'UNKNOWN_ACTION', error: `Unknown scope action: ${action}` }, { status: 400 })
}
