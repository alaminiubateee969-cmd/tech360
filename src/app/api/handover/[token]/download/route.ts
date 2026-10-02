import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText, clientIp, audit, logError } from '@/lib/security'
import { escapeHtml } from '@/lib/comms'
import { PAD_CSS, padHeader, padMeta, padFooter, padSignatures, PAD } from '@/lib/letterhead'
import { evaluateHandoverGate } from '@/lib/commerce-policy'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PREPARED: { label: 'Prepared', color: '#526173', bg: '#F6F9FC', border: '#CBD8E6' },
  RELEASED: { label: 'Released to client', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
  DOWNLOADED: { label: 'Downloaded by client', color: '#063B8F', bg: '#F4FAFF', border: '#B7DBF3' },
  CONFIRMED: { label: 'Delivery confirmed', color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
}

// SECURE SOURCE PACKAGE DOWNLOAD — gated: RELEASED status + full payment verified.
// Default: JSON manifest (programmatic). ?format=html: the official Handover &
// Acceptance Certificate on the Tech360 company pad (printable).
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const handover = await db.handoverRecord.findUnique({ where: { packageToken: clean }, include: { project: { include: { payments: true, client: true } } } })
  if (!handover) return Response.json({ error: 'Package not found' }, { status: 404 })

  // Re-verify release, full payment and expiry at download time (defense in depth).
  const paid = handover.project.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0)
  const gate = evaluateHandoverGate({
    status: handover.status,
    totalAmount: handover.project.totalAmount,
    paidAmount: paid,
    expiryAt: handover.expiryAt,
  })
  if (!gate.allowed && gate.code === 'NOT_RELEASED') {
    await logError({ source: 'SECURITY', code: 'HANDOVER_ACCESS_BLOCKED', message: `Download attempt on unreleased package ${clean.slice(0, 8)} from ${clientIp(req)}`, clientId: handover.clientId })
    return Response.json({ error: 'This package is not released. Source code becomes available only after full payment verification and admin release.' }, { status: 403 })
  }
  if (!gate.allowed && gate.code === 'PAYMENT_INCOMPLETE') {
    await logError({ source: 'SECURITY', code: 'HANDOVER_PAYMENT_GATE', message: `Download blocked: payment incomplete for ${handover.project.code}`, clientId: handover.clientId })
    return Response.json({ error: 'Payment verification incomplete. Contact info@bdtech360.com.' }, { status: 403 })
  }
  if (!gate.allowed && gate.code === 'EXPIRED') {
    return Response.json({ error: 'This package link has expired. Contact info@bdtech360.com for renewal.' }, { status: 410 })
  }

  await db.handoverRecord.update({ where: { id: handover.id }, data: { status: 'DOWNLOADED', downloadedAt: new Date() } })
  await audit({ actor: `client:${handover.project.client.clientId}`, action: 'SOURCE_PACKAGE_DOWNLOADED', clientId: handover.project.client.clientId, projectId: handover.projectId, ip: clientIp(req), details: { packageToken: clean.slice(0, 8), format: new URL(req.url).searchParams.get('format') === 'html' ? 'HTML_CERTIFICATE' : 'JSON_MANIFEST' } })

  // ---------- Official HTML certificate on the company pad ----------
  if (new URL(req.url).searchParams.get('format') === 'html') {
    const st = STATUS_LABEL[handover.status] ?? STATUS_LABEL.RELEASED
    const released = handover.releasedAt ? new Date(handover.releasedAt).toISOString().slice(0, 10) : '—'
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/><title>Handover & Acceptance Certificate — ${escapeHtml(handover.project.code)} — Tech360</title><style>${PAD_CSS}
.status-chip{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.06em;padding:6px 14px;border-radius:99px;border:1px solid ${st.border};background:${st.bg};color:${st.color}}
.cert-grid{display:flex;gap:24px;flex-wrap:wrap;margin-top:24px}
.cert-box{flex:1;min-width:230px;background:#F6F9FC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px}
.cert-box h3{margin:0 0 10px;font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:#7C8DA0}
.cert-box p{margin:0;font-size:13.5px;line-height:1.8;color:#33475C}
.cert-box b{color:${PAD.ink}}
.gate{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
.gate div{flex:1;min-width:170px;border:1px solid #BBF7D0;background:#F0FDF4;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#14532D}
.gate b{display:block;font-size:13px}
.dl{display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap}
.btn-d{background:${PAD.brandNavy};color:#fff;padding:13px 26px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block}
</style></head><body>
<div class="sheet">
${padHeader('Handover &amp; Acceptance Certificate')}
${padMeta([
      { label: 'Project', value: escapeHtml(handover.project.code), brand: true },
      { label: 'Client reference', value: escapeHtml(handover.project.client.clientId) },
      { label: 'Package', value: escapeHtml(handover.packageToken.slice(0, 12).toUpperCase()) },
      { label: 'Status', value: st.label },
    ])}
<main class="doc">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px">
  <h2 style="margin:0">Source handover &amp; acceptance</h2>
  <span class="status-chip">${st.label}</span>
</div>
<p class="intro" style="color:#526173;font-size:14px;line-height:1.7;max-width:64ch;margin-top:14px">This certificate confirms that the completed source package for <b>${escapeHtml(handover.project.name)}</b> has been released to <b>${escapeHtml(handover.project.client.name)}</b> (${escapeHtml(handover.project.client.clientId)}) following the Tech360 Source Code Handover Policy: full payment verified, all deliverables completed, and ownership transferred as documented in the engagement.</p>
<div class="cert-grid">
  <div class="cert-box"><h3>Release record</h3><p><b>Released:</b> ${released}<br/><b>Type:</b> ${escapeHtml(handover.type)}<br/><b>Contents:</b> ${escapeHtml(String(handover.contents ?? 'Source package manifest').slice(0, 220))}</p></div>
  <div class="cert-box"><h3>Payment verification</h3><p><b>Project value:</b> ${handover.project.totalAmount} ${'USD'}<br/><b>Verified paid:</b> ${paid} ${'USD'}<br/><b>Gate:</b> passed at download (re-checked)</p></div>
</div>
<h2>Client responsibilities on acceptance</h2>
<div class="gate">
  <div><b>Change all temporary passwords</b> delivered with the package, then confirm in your client portal.</div>
  <div><b>Verify the package works</b> in your environment; report any issue within the warranty window.</div>
  <div><b>Keep this certificate</b> — it is your proof of ownership transfer and release date.</div>
</div>
${padSignatures(escapeHtml(handover.project.client.name), 'Client acceptance of delivery')}
<div class="dl"><a class="btn btn-d" href="?format=json">Download source manifest (JSON)</a></div>
</main>
${padFooter('This certificate is confidential and intended for the addressed recipient. Full source archives are delivered through the documented secure transfer channel.')}
</div>
</body></html>`
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  }

  // ---------- Default: JSON manifest (programmatic download) ----------
  const manifest = {
    package: handover.packageToken.slice(0, 12).toUpperCase(),
    project: { code: handover.project.code, name: handover.project.name },
    client: handover.project.client.clientId,
    releasedAt: handover.releasedAt,
    downloadedAt: new Date().toISOString(),
    type: handover.type,
    contents: handover.contents ?? 'Source package manifest',
    note: 'This manifest confirms your access to the released source package. Full source archives are delivered through your project repository/secure transfer as documented in the handover record. The official Handover & Acceptance Certificate is available at the same link with ?format=html.',
  }
  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="tech360-${handover.project.code}-handover.json"`,
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
