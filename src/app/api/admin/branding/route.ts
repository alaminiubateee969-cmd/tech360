import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { getDocumentBranding, saveDocumentBranding, restoreDefaultBranding, getBrandingHistory, getDefaultBranding, isValidPageSize } from '@/lib/document-branding'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/branding — fetch current branding config (SUPER_ADMIN only, ADMIN can view)
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const branding = await getDocumentBranding(true)
  const history = await getBrandingHistory()
  return Response.json({ branding, history, defaults: getDefaultBranding() })
}

// PUT /api/admin/branding — update branding config (SUPER_ADMIN only)
export async function PUT(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate inputs
  const patch: Record<string, unknown> = {}
  if (body.pageSize !== undefined) {
    if (!isValidPageSize(body.pageSize)) return Response.json({ error: 'Invalid pageSize (A4, LETTER, A3 only)' }, { status: 400 })
    patch.pageSize = body.pageSize
  }
  if (body.headerSpacingMm !== undefined) {
    const v = Number(body.headerSpacingMm)
    if (!Number.isFinite(v) || v < 0 || v > 50) return Response.json({ error: 'headerSpacingMm must be 0-50' }, { status: 400 })
    patch.headerSpacingMm = v
  }
  if (body.footerSpacingMm !== undefined) {
    const v = Number(body.footerSpacingMm)
    if (!Number.isFinite(v) || v < 0 || v > 50) return Response.json({ error: 'footerSpacingMm must be 0-50' }, { status: 400 })
    patch.footerSpacingMm = v
  }
  if (body.contentMarginMm !== undefined) {
    const v = Number(body.contentMarginMm)
    if (!Number.isFinite(v) || v < 0 || v > 50) return Response.json({ error: 'contentMarginMm must be 0-50' }, { status: 400 })
    patch.contentMarginMm = v
  }
  if (body.headerAsset !== undefined) {
    const s = String(body.headerAsset).trim().slice(0, 200)
    if (s && !s.startsWith('/brand/') && !s.startsWith('/private/') && !s.startsWith('http')) return Response.json({ error: 'headerAsset must be a /brand/ path' }, { status: 400 })
    if (s) patch.headerAsset = s
  }
  if (body.footerAsset !== undefined) {
    const s = String(body.footerAsset).trim().slice(0, 200)
    if (s && !s.startsWith('/brand/') && !s.startsWith('/private/') && !s.startsWith('http')) return Response.json({ error: 'footerAsset must be a /brand/ path' }, { status: 400 })
    if (s) patch.footerAsset = s
  }
  if (body.sealAsset !== undefined) {
    const s = String(body.sealAsset).trim().slice(0, 200)
    if (s && !s.startsWith('/brand/') && !s.startsWith('/private/') && !s.startsWith('http')) return Response.json({ error: 'sealAsset must be a /brand/ path' }, { status: 400 })
    if (s) patch.sealAsset = s
  }
  if (body.sealEnabledSOW !== undefined) patch.sealEnabledSOW = Boolean(body.sealEnabledSOW)
  if (body.sealEnabledInvoice !== undefined) patch.sealEnabledInvoice = Boolean(body.sealEnabledInvoice)
  if (body.sealPosition !== undefined) {
    const v = String(body.sealPosition)
    if (!['bottom-right', 'watermark', 'signature-side'].includes(v)) return Response.json({ error: 'Invalid sealPosition' }, { status: 400 })
    patch.sealPosition = v
  }
  if (body.sealOpacity !== undefined) {
    const v = Number(body.sealOpacity)
    if (!Number.isFinite(v) || v < 0 || v > 100) return Response.json({ error: 'sealOpacity 0-100' }, { status: 400 })
    patch.sealOpacity = v
  }
  if (body.sealSizeMm !== undefined) {
    const v = Number(body.sealSizeMm)
    if (!Number.isFinite(v) || v < 10 || v > 120) return Response.json({ error: 'sealSizeMm 10-120' }, { status: 400 })
    patch.sealSizeMm = v
  }
  if (body.logoAsset !== undefined) {
    const s = String(body.logoAsset).trim().slice(0, 200)
    if (s) patch.logoAsset = s
  }

  if (Object.keys(patch).length === 0) return Response.json({ error: 'No valid changes supplied' }, { status: 400 })

  const updated = await saveDocumentBranding(patch as never, g.user.email)
  await audit({ actor: g.user.email, action: 'DOCUMENT_BRANDING_UPDATED', details: { changed: Object.keys(patch), version: updated.version }, ip: g.ip })
  return Response.json({ ok: true, branding: updated, changed: Object.keys(patch) })
}

// DELETE /api/admin/branding — restore approved default template (SUPER_ADMIN only)
export async function DELETE(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const restored = await restoreDefaultBranding(g.user.email)
  await audit({ actor: g.user.email, action: 'DOCUMENT_BRANDING_RESTORED', details: { version: restored.version }, ip: g.ip })
  return Response.json({ ok: true, branding: restored })
}

// POST /api/admin/branding — upload letterhead assets (SUPER_ADMIN only)
// Expects multipart form-data with file field + assetType=header|footer|seal|logo
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  try {
    const form = await req.formData()
    const file = form.get('file')
    const assetType = String(form.get('assetType') ?? '').toLowerCase()
    if (!(file instanceof File)) return Response.json({ error: 'file is required' }, { status: 400 })
    if (!['header', 'footer', 'seal', 'logo'].includes(assetType)) return Response.json({ error: 'assetType must be header, footer, seal or logo' }, { status: 400 })
    if (file.size === 0 || file.size > 10 * 1024 * 1024) return Response.json({ error: 'File size must be 1B-10MB' }, { status: 400 })
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (file.type && !allowedMime.includes(file.type.toLowerCase())) return Response.json({ error: `Unsupported type ${file.type}. Allowed: png, jpg, webp, svg` }, { status: 415 })
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png'
    const bytes = Buffer.from(await file.arrayBuffer())
    // Validate not empty and basic magic (optional)
    if (bytes.length < 10) return Response.json({ error: 'File too small or corrupt' }, { status: 400 })
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const brandDir = path.join(process.cwd(), 'public', 'brand')
    await fs.mkdir(brandDir, { recursive: true })
    const destName = assetType === 'header' ? `tech360-header-high-res.${ext}` : assetType === 'footer' ? `tech360-footer-high-res.${ext}` : assetType === 'seal' ? `tech360-seal.${ext}` : `tech360-logo-custom.${ext}`
    const destPath = path.join(brandDir, destName)
    await fs.writeFile(destPath, bytes)
    const publicUrl = `/brand/${destName}`
    const patch: Record<string, string> = {}
    if (assetType === 'header') patch.headerAsset = publicUrl
    if (assetType === 'footer') patch.footerAsset = publicUrl
    if (assetType === 'seal') patch.sealAsset = publicUrl
    if (assetType === 'logo') patch.logoAsset = publicUrl
    const updated = await saveDocumentBranding(patch as never, g.user.email)
    await audit({ actor: g.user.email, action: 'DOCUMENT_BRANDING_ASSET_UPLOADED', details: { assetType, publicUrl, size: file.size, version: updated.version }, ip: g.ip })
    return Response.json({ ok: true, branding: updated, assetType, publicUrl })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 })
  }
}
