import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit, logError } from '@/lib/security'
import { DOCUMENT_HTML_HEADERS } from '@/lib/invoice-document'
import { getDefaultBranding, type DocumentBrandingConfig } from '@/lib/document-branding'
import { pageTemplateNotice } from '@/lib/document-page-template'
import {
  DOCUMENT_TITLES,
  OFFICIAL_DOCUMENT_KINDS,
  renderOfficialDocumentHtml,
  type OfficialDocumentInput,
  type OfficialDocumentKind,
  type DocumentSection,
} from '@/lib/official-document'
import { defaultPermissionsFor, recordGeneratedDocument, type DocumentType } from '@/lib/document-storage'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// POST /api/admin/documents/generate
//
// Renders one of the 17 official document types on the owner-supplied
// letterhead and records it in the document registry.
//
// Guarded: MIN role ADMIN, CSRF on the mutation, rate limited.
// The rendered HTML is returned to the browser with the same locked-down
// CSP the invoice renderer uses (`script-src 'none'`), and the SHA-256 of
// the bytes is stored so the archived copy can be proven unchanged.
//
// `?register=1` also writes a registry row. Registration is separated
// because a preview render must not consume a document ID / version.
// ------------------------------------------------------------

/** Which registry document type each official kind maps to. */
const REGISTRY_TYPE: Record<OfficialDocumentKind, DocumentType> = {
  BUSINESS_PROPOSAL: 'WORK_PROPOSAL',
  SOW: 'SOW',
  QUOTATION: 'WORK_PROPOSAL',
  PAYMENT_INSTRUCTION: 'INVOICE',
  SERVICE_AGREEMENT: 'CONTRACT',
  CONTRACT: 'CONTRACT',
  MEETING_MINUTES: 'OFFICIAL_LETTER',
  CHANGE_REQUEST: 'SOW',
  SCOPE_APPROVAL: 'SOW',
  PROGRESS_REPORT: 'OFFICIAL_LETTER',
  QA_REPORT: 'OFFICIAL_LETTER',
  COMPLETION_REPORT: 'DELIVERY_PACKAGE',
  DELIVERY_HANDOVER: 'HANDOVER_CERTIFICATE',
  CUSTOMER_ACCEPTANCE: 'HANDOVER_CERTIFICATE',
  WARRANTY_SUPPORT: 'OFFICIAL_LETTER',
  OFFICIAL_LETTER: 'OFFICIAL_LETTER',
  CERTIFICATE: 'HANDOVER_CERTIFICATE',
}

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined
}

function sectionsFrom(raw: unknown): DocumentSection[] | null {
  if (!Array.isArray(raw)) return null
  const out: DocumentSection[] = []
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== 'object') return null
    const s = item as Record<string, unknown>
    const heading = str(s.heading, 200)
    if (!heading) return null
    const section: DocumentSection = { heading }
    if (Array.isArray(s.paragraphs)) section.paragraphs = s.paragraphs.filter((p): p is string => typeof p === 'string').slice(0, 40).map((p) => p.slice(0, 4000))
    if (Array.isArray(s.bullets)) section.bullets = s.bullets.filter((p): p is string => typeof p === 'string').slice(0, 80).map((p) => p.slice(0, 1000))
    if (Array.isArray(s.fields)) {
      section.fields = s.fields
        .filter((f): f is { label: string; value: string } => Boolean(f) && typeof f === 'object' && typeof (f as Record<string, unknown>).label === 'string' && typeof (f as Record<string, unknown>).value === 'string')
        .slice(0, 40)
        .map((f) => ({ label: f.label.slice(0, 120), value: f.value.slice(0, 600) }))
    }
    if (s.table && typeof s.table === 'object') {
      const t = s.table as Record<string, unknown>
      const columns = Array.isArray(t.columns) ? t.columns.filter((c): c is string => typeof c === 'string').slice(0, 12).map((c) => c.slice(0, 120)) : null
      const rows = Array.isArray(t.rows)
        ? t.rows.filter(Array.isArray).slice(0, 200).map((r) => (r as unknown[]).slice(0, 12).map((c) => String(c ?? '').slice(0, 600)))
        : null
      if (columns?.length && rows) section.table = { columns, rows }
    }
    out.push(section)
  }
  return out.length ? out : null
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN', rateLimitPerMin: 40 })
  if (isResponse(g)) return g

  let body: Record<string, unknown>
  try {
    const parsed = (await req.json()) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return bad('Body must be a JSON object.')
    body = parsed as Record<string, unknown>
  } catch {
    return bad('Body must be valid JSON.')
  }

  const kind = str(body.kind, 40) as OfficialDocumentKind | undefined
  if (!kind || !OFFICIAL_DOCUMENT_KINDS.includes(kind)) {
    return bad(`kind must be one of: ${OFFICIAL_DOCUMENT_KINDS.join(', ')}`)
  }
  const reference = str(body.reference, 60)
  if (!reference) return bad('reference is required.')
  if (!/^[A-Z0-9][A-Z0-9._/-]{2,59}$/i.test(reference)) {
    return bad('reference must be 3-60 chars of letters, digits, dot, underscore, slash or hyphen.')
  }
  const sections = sectionsFrom(body.sections)
  if (!sections) return bad('sections must be a non-empty array of { heading, paragraphs?, bullets?, fields?, table? }.')

  // Resolve the optional client. A supplied Client ID must exist and not be
  // soft-deleted; an unknown ID is an error rather than a silent null.
  let clientRow: { id: string; clientId: string; name: string } | null = null
  const clientPublicId = str(body.clientId, 40)
  if (clientPublicId) {
    clientRow = await db.client.findFirst({
      where: { clientId: clientPublicId, deletedAt: null },
      select: { id: true, clientId: true, name: true },
    })
    if (!clientRow) return bad(`Client ${clientPublicId} not found.`, 404)
  }

  let projectId: string | null = null
  const projectCode = str(body.projectCode, 40)
  if (projectCode) {
    const project = await db.project.findFirst({
      where: { code: projectCode, deletedAt: null },
      select: { id: true, code: true, clientId: true },
    })
    if (!project) return bad(`Project ${projectCode} not found.`, 404)
    // A project may not be attached to a different customer than the document.
    if (clientRow && project.clientId !== clientRow.id) {
      return bad('Project does not belong to the supplied Client ID.', 409)
    }
    projectId = project.id
  }

  const issuedAt = new Date()
  const input: OfficialDocumentInput = {
    kind,
    reference,
    version: Number.isSafeInteger(body.version) ? Math.max(1, Number(body.version)) : 1,
    issuedAt,
    clientId: clientRow?.clientId ?? null,
    projectCode: projectCode ?? null,
    recipientName: str(body.recipientName, 200) ?? clientRow?.name ?? null,
    recipientBusiness: str(body.recipientBusiness, 200) ?? null,
    recipientEmail: str(body.recipientEmail, 200) ?? null,
    subject: str(body.subject, 300) ?? null,
    sections,
    signatories: Array.isArray(body.signatories)
      ? body.signatories
          .filter((s): s is { name: string; role: string } => Boolean(s) && typeof s === 'object')
          .slice(0, 4)
          .map((s) => ({ name: String((s as Record<string, unknown>).name ?? '').slice(0, 120), role: String((s as Record<string, unknown>).role ?? '').slice(0, 120) }))
      : undefined,
    approvals: [{ action: 'DOCUMENT_RENDERED', by: g.user.email, at: issuedAt }],
  }

  const branding: DocumentBrandingConfig = getDefaultBranding()
  let html: string
  try {
    html = renderOfficialDocumentHtml(input, branding)
  } catch (e) {
    await logError({ source: 'DOCUMENTS', code: 'RENDER_FAILED', message: `Official document render failed for ${kind} ${reference}`, workflow: 'DOCUMENT_GENERATE' })
    void e
    return Response.json({ error: 'Document rendering failed.' }, { status: 500 })
  }

  const bytes = Buffer.from(html, 'utf8')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const registryType = REGISTRY_TYPE[kind]

  let registered: { documentId: string; version: number } | null = null
  const shouldRegister = req.nextUrl.searchParams.get('register') === '1'
  if (shouldRegister) {
    try {
      const entry = await recordGeneratedDocument({
        documentId: reference,
        documentType: registryType,
        clientId: clientRow?.id ?? null,
        clientPublicId: clientRow?.clientId ?? null,
        projectId,
        version: input.version ?? 1,
        createdBy: g.user.email,
        approvalStatus: 'DRAFT',
        finalizationStatus: 'DRAFT',
        // The rendered HTML is NEVER exposed at a public URL; the registry
        // records a private location string only.
        fileLocation: `private/documents/${reference}-v${input.version ?? 1}.html`,
        brandingVersion: branding.version,
        accessPermissions: defaultPermissionsFor(registryType),
        relatedId: null,
        sha256,
        title: `${DOCUMENT_TITLES[kind]} ${reference}`,
        isPublicTemplate: false,
      })
      registered = { documentId: entry.documentId, version: entry.version }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      // A duplicate reference+version is a caller error, not a server fault.
      if (message.includes('Duplicate')) return bad(`Document ${reference} v${input.version ?? 1} already exists.`, 409)
      await logError({ source: 'DOCUMENTS', code: 'REGISTRY_WRITE_FAILED', message: `Registry write failed for ${reference}`, workflow: 'DOCUMENT_GENERATE' })
      return Response.json({ error: 'Document registry write failed.' }, { status: 500 })
    }
  }

  await audit({
    actor: g.user.email,
    action: 'DOCUMENT_GENERATED',
    entityType: 'DOCUMENT',
    entityId: reference,
    clientId: clientRow?.clientId ?? undefined,
    details: {
      kind,
      registryType,
      version: input.version ?? 1,
      sha256,
      registered: Boolean(registered),
      actorRole: g.user.role,
    },
    ip: g.ip,
  })

  return new Response(html, {
    status: 200,
    headers: {
      ...DOCUMENT_HTML_HEADERS,
      'X-TECH360-Document-Sha256': sha256,
      'X-TECH360-Document-Kind': kind,
      'X-TECH360-Branding-Version': String(branding.version),
      'X-TECH360-Page-Template': pageTemplateNotice(branding).slice(0, 200).replace(/[^\x20-\x7E]/g, ' '),
    },
  })
}
