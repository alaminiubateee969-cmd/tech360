// ------------------------------------------------------------
// TECH360 — Document Branding Configuration Engine
// Single Source of Truth for ALL official company documents
//
// Super Admin → Settings → Document Branding manages this config.
// It is stored in the Setting table (key: "document_branding") and
// cached in-process. Every document renderer (invoice, SOW, proposal,
// official letter, legal policies) MUST consume this engine instead
// of hardcoding header/footer markup.
//
// Branding assets:
//  - Header image:  public/brand/tech360-header-high-res.png  (black bar with TECH360 + contacts)
//  - Footer image:  public/brand/tech360-footer-high-res.png
//  - Circular seal: public/brand/tech360-seal.png  (ONLY for SOW & Invoice when enabled)
//  - Fallback letterhead: public/brand/tech360-letterhead-a4.png
//
// Rules (non-negotiable):
//  - TECH360 letterhead is permanent branding for all official documents
//  - Circular seal ONLY on SOW and Invoice (when enabled by Super Admin)
//  - Ordinary official docs & legal policies NEVER get the seal
// ------------------------------------------------------------

import { db } from '@/lib/db'

// Document types that map to branding rules
export type DocumentType =
  | 'WORK_PROPOSAL'
  | 'SOW'
  | 'INVOICE'
  | 'OFFICIAL_LETTER'
  | 'HANDOVER'
  | 'LEGAL_POLICY'
  | 'TERMS'
  | 'PRIVACY'
  | 'REFUND'

export type PageSize = 'A4' | 'LETTER' | 'A3'

export interface DocumentBrandingConfig {
  // Page & spacing
  pageSize: PageSize
  headerSpacingMm: number // e.g. 12
  footerSpacingMm: number // e.g. 12
  contentMarginMm: number // side margins

  // Approved assets (paths served from /brand/ — public, versioned)
  headerAsset: string // e.g. /brand/tech360-header-high-res.png
  footerAsset: string // e.g. /brand/tech360-footer-high-res.png
  letterheadAsset: string // full A4 letterhead fallback
  logoAsset: string // TECH360 LLC logo

  // Circular seal (ONLY for SOW & Invoice)
  sealAsset: string // /brand/tech360-seal.png
  sealEnabledSOW: boolean
  sealEnabledInvoice: boolean
  sealPosition: 'bottom-right' | 'watermark' | 'signature-side'
  sealOpacity: number // 0-100, watermark opacity
  sealSizeMm: number // diameter in mm

  // Brand identity (mirrors OFFICIAL_INFO + PAD constants)
  legalName: string
  missouriLLC: string
  ein: string
  address: string
  email: string
  phone: string
  domain: string
  websiteDisplay: string
  tagline: string
  servicesLine: string
  brandBlue: string
  brandNavy: string
  brandGreen: string
  ink: string

  // Versioning — every save bumps version, documents snapshot the version they were created with
  version: number
  updatedAt: string // ISO
  updatedBy: string | null
  approvedTemplateVersion: number // the approved default template version (for restore)
}

const SETTING_KEY = 'document_branding'
const SETTING_HISTORY_KEY = 'document_branding_history'

const DEFAULT_BRANDING: DocumentBrandingConfig = {
  pageSize: 'A4',
  headerSpacingMm: 14,
  footerSpacingMm: 16,
  contentMarginMm: 14,
  headerAsset: '/brand/tech360-header-high-res.png',
  footerAsset: '/brand/tech360-footer-high-res.png',
  letterheadAsset: '/brand/tech360-letterhead-a4.png',
  logoAsset: '/brand/tech360-logo-original.jpg',
  sealAsset: '/brand/tech360-seal.png',
  sealEnabledSOW: true,
  sealEnabledInvoice: true,
  sealPosition: 'bottom-right',
  sealOpacity: 14,
  sealSizeMm: 42,
  legalName: 'TECH360 LLC',
  missouriLLC: 'LC014737249',
  ein: '98-1940053',
  address: '117 S Lexington St Ste 100, Harrisonville, MO 64701, USA',
  email: 'info@bdtech360.com',
  phone: '+1 (347) 433 1200',
  domain: 'bdtech360.com',
  websiteDisplay: 'www.bdtech360.com',
  tagline: 'CONNECT · INNOVATE · GROW',
  servicesLine: 'Web | Cloud | AI | Data | Tech',
  brandBlue: '#009FE3',
  brandNavy: '#063B8F',
  brandGreen: '#18B83A',
  ink: '#0B1F33',
  version: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  approvedTemplateVersion: 1,
}

// In-process cache (invalidated on save)
let brandingCache: { value: DocumentBrandingConfig; at: number } | null = null
const CACHE_TTL = 30_000

export function getDefaultBranding(): DocumentBrandingConfig {
  return { ...DEFAULT_BRANDING, updatedAt: new Date().toISOString() }
}

export function isValidPageSize(v: unknown): v is PageSize {
  return v === 'A4' || v === 'LETTER' || v === 'A3'
}

function normalizeConfig(raw: unknown): DocumentBrandingConfig {
  const base = getDefaultBranding()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  return {
    pageSize: isValidPageSize(r.pageSize) ? (r.pageSize as PageSize) : base.pageSize,
    headerSpacingMm: typeof r.headerSpacingMm === 'number' && r.headerSpacingMm >= 0 && r.headerSpacingMm <= 50 ? r.headerSpacingMm : base.headerSpacingMm,
    footerSpacingMm: typeof r.footerSpacingMm === 'number' && r.footerSpacingMm >= 0 && r.footerSpacingMm <= 50 ? r.footerSpacingMm : base.footerSpacingMm,
    contentMarginMm: typeof r.contentMarginMm === 'number' && r.contentMarginMm >= 0 && r.contentMarginMm <= 50 ? r.contentMarginMm : base.contentMarginMm,
    headerAsset: typeof r.headerAsset === 'string' && r.headerAsset.length > 0 ? r.headerAsset : base.headerAsset,
    footerAsset: typeof r.footerAsset === 'string' && r.footerAsset.length > 0 ? r.footerAsset : base.footerAsset,
    letterheadAsset: typeof r.letterheadAsset === 'string' && r.letterheadAsset.length > 0 ? r.letterheadAsset : base.letterheadAsset,
    logoAsset: typeof r.logoAsset === 'string' && r.logoAsset.length > 0 ? r.logoAsset : base.logoAsset,
    sealAsset: typeof r.sealAsset === 'string' && r.sealAsset.length > 0 ? r.sealAsset : base.sealAsset,
    sealEnabledSOW: typeof r.sealEnabledSOW === 'boolean' ? r.sealEnabledSOW : base.sealEnabledSOW,
    sealEnabledInvoice: typeof r.sealEnabledInvoice === 'boolean' ? r.sealEnabledInvoice : base.sealEnabledInvoice,
    sealPosition: r.sealPosition === 'watermark' || r.sealPosition === 'signature-side' || r.sealPosition === 'bottom-right' ? r.sealPosition : base.sealPosition,
    sealOpacity: typeof r.sealOpacity === 'number' && r.sealOpacity >= 0 && r.sealOpacity <= 100 ? r.sealOpacity : base.sealOpacity,
    sealSizeMm: typeof r.sealSizeMm === 'number' && r.sealSizeMm >= 10 && r.sealSizeMm <= 120 ? r.sealSizeMm : base.sealSizeMm,
    legalName: typeof r.legalName === 'string' && r.legalName.length > 0 ? r.legalName : base.legalName,
    missouriLLC: typeof r.missouriLLC === 'string' && r.missouriLLC.length > 0 ? r.missouriLLC : base.missouriLLC,
    ein: typeof r.ein === 'string' && r.ein.length > 0 ? r.ein : base.ein,
    address: typeof r.address === 'string' && r.address.length > 0 ? r.address : base.address,
    email: typeof r.email === 'string' && r.email.length > 0 ? r.email : base.email,
    phone: typeof r.phone === 'string' && r.phone.length > 0 ? r.phone : base.phone,
    domain: typeof r.domain === 'string' && r.domain.length > 0 ? r.domain : base.domain,
    websiteDisplay: typeof r.websiteDisplay === 'string' && r.websiteDisplay.length > 0 ? r.websiteDisplay : base.websiteDisplay,
    tagline: typeof r.tagline === 'string' && r.tagline.length > 0 ? r.tagline : base.tagline,
    servicesLine: typeof r.servicesLine === 'string' && r.servicesLine.length > 0 ? r.servicesLine : base.servicesLine,
    brandBlue: typeof r.brandBlue === 'string' && r.brandBlue.length > 0 ? r.brandBlue : base.brandBlue,
    brandNavy: typeof r.brandNavy === 'string' && r.brandNavy.length > 0 ? r.brandNavy : base.brandNavy,
    brandGreen: typeof r.brandGreen === 'string' && r.brandGreen.length > 0 ? r.brandGreen : base.brandGreen,
    ink: typeof r.ink === 'string' && r.ink.length > 0 ? r.ink : base.ink,
    version: typeof r.version === 'number' && r.version > 0 ? r.version : base.version,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.updatedAt,
    updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy : base.updatedBy,
    approvedTemplateVersion: typeof r.approvedTemplateVersion === 'number' ? r.approvedTemplateVersion : base.approvedTemplateVersion,
  }
}

export async function getDocumentBranding(force = false): Promise<DocumentBrandingConfig> {
  if (!force && brandingCache && Date.now() - brandingCache.at < CACHE_TTL) return brandingCache.value
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY } })
    if (row?.value) {
      const parsed = JSON.parse(row.value) as unknown
      const normalized = normalizeConfig(parsed)
      brandingCache = { value: normalized, at: Date.now() }
      return normalized
    }
  } catch {
    // fall through to defaults
  }
  const def = getDefaultBranding()
  brandingCache = { value: def, at: Date.now() }
  return def
}

export async function saveDocumentBranding(
  patch: Partial<DocumentBrandingConfig>,
  actorEmail: string,
): Promise<DocumentBrandingConfig> {
  const current = await getDocumentBranding(true)
  const next: DocumentBrandingConfig = normalizeConfig({
    ...current,
    ...patch,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  })
  // Archive current to history before overwriting
  try {
    const historyRow = await db.setting.findUnique({ where: { key: SETTING_HISTORY_KEY } })
    let history: DocumentBrandingConfig[] = []
    if (historyRow?.value) {
      try {
        history = JSON.parse(historyRow.value) as DocumentBrandingConfig[]
        if (!Array.isArray(history)) history = []
      } catch { history = [] }
    }
    history.unshift(current)
    if (history.length > 20) history = history.slice(0, 20)
    await db.setting.upsert({
      where: { key: SETTING_HISTORY_KEY },
      create: { key: SETTING_HISTORY_KEY, value: JSON.stringify(history) },
      update: { value: JSON.stringify(history), updatedAt: new Date() },
    })
  } catch { /* history best-effort */ }

  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next), updatedAt: new Date() },
  })
  brandingCache = { value: next, at: Date.now() }
  return next
}

export async function restoreDefaultBranding(actorEmail: string): Promise<DocumentBrandingConfig> {
  const def = getDefaultBranding()
  const current = await getDocumentBranding(true)
  const restored: DocumentBrandingConfig = {
    ...def,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
    approvedTemplateVersion: def.approvedTemplateVersion,
  }
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(restored) },
    update: { value: JSON.stringify(restored), updatedAt: new Date() },
  })
  brandingCache = { value: restored, at: Date.now() }
  return restored
}

export async function getBrandingHistory(): Promise<DocumentBrandingConfig[]> {
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_HISTORY_KEY } })
    if (!row?.value) return []
    const parsed = JSON.parse(row.value) as unknown
    return Array.isArray(parsed) ? (parsed as DocumentBrandingConfig[]) : []
  } catch { return [] }
}

// ------------------------------------------------------------
// Seal helpers — enforce non-negotiable rule
// ------------------------------------------------------------

export function isSealAllowedFor(documentType: DocumentType, branding: DocumentBrandingConfig): boolean {
  if (documentType === 'SOW') return branding.sealEnabledSOW
  if (documentType === 'INVOICE') return branding.sealEnabledInvoice
  // All other types NEVER get seal, regardless of toggles
  return false
}

export function sealHtmlFor(documentType: DocumentType, branding: DocumentBrandingConfig): string {
  if (!isSealAllowedFor(documentType, branding)) return ''
  const size = branding.sealSizeMm
  const opacity = branding.sealOpacity
  if (branding.sealPosition === 'watermark') {
    return `<div aria-hidden="true" style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-12deg);opacity:${opacity / 100};pointer-events:none;z-index:0;"><img src="${branding.sealAsset}" alt="" style="width:${size * 4}px;height:${size * 4}px;object-fit:contain;"/></div>`
  }
  if (branding.sealPosition === 'signature-side') {
    return `<div class="seal sig-seal" aria-label="Official TECH360 LLC seal"><img src="${branding.sealAsset}" alt="TECH360 LLC Official Seal" style="width:${size}mm;height:${size}mm;object-fit:contain;opacity:0.96;"/></div>`
  }
  // bottom-right (default)
  return `<div class="seal seal-br" aria-label="Official TECH360 LLC seal"><img src="${branding.sealAsset}" alt="TECH360 LLC Official Seal — Harrisonville Missouri" style="width:${size}mm;height:${size}mm;object-fit:contain;opacity:0.92;"/></div>`
}

// ------------------------------------------------------------
// Shared CSS / helpers that depend on branding config
// Page size influences @page, spacing influences paddings
// ------------------------------------------------------------

export function pageSizeCss(pageSize: PageSize): string {
  switch (pageSize) {
    case 'LETTER': return `size: letter;`
    case 'A3': return `size: A3;`
    case 'A4':
    default: return `size: A4;`
  }
}

export function brandingCss(branding: DocumentBrandingConfig): string {
  const headerPad = branding.headerSpacingMm
  const footerPad = branding.footerSpacingMm
  const margin = branding.contentMarginMm
  return `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;background:#EDF2F7;color:${branding.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:900px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 60px -20px rgba(6,59,143,.18);position:relative;overflow:hidden}
.sheet::before{content:'TECH360';position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:110px;font-weight:900;letter-spacing:.12em;color:rgba(6,59,143,.045);pointer-events:none;white-space:nowrap;z-index:0}
.sheet>*{position:relative;z-index:1}
.brand-header{height:${headerPad}mm;min-height:${headerPad}mm;background:#000;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 ${margin}mm;overflow:hidden;position:relative}
.brand-header img{height:100%;width:auto;object-fit:contain;display:block;max-height:${headerPad}mm}
.brand-header .hdr-contacts{display:flex;align-items:center;gap:18px;font-size:8.5px;color:#8AA0B8;white-space:nowrap}
.brand-header .hdr-contacts a{color:#8AA0B8;text-decoration:none}
.brand-footer{height:${footerPad}mm;min-height:${footerPad}mm;background:#000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 ${margin}mm;overflow:hidden;position:relative}
.brand-footer img{height:100%;width:auto;object-fit:contain;display:block;max-height:${footerPad}mm}
/* Letterhead blocks (logo + tagline) */
.pad{padding:22px ${margin}mm 0}
.pad-top{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.pad-logo{display:flex;align-items:center;gap:14px}
.pad-logo img{height:46px;width:auto;display:block}
.pad-brand{text-align:right}
.pad-brand .name{font-size:19px;font-weight:900;letter-spacing:.14em;color:${branding.ink}}
.pad-brand .tag{margin-top:3px;font-size:10.5px;font-weight:700;letter-spacing:.22em;color:${branding.brandBlue}}
.pad-brand .svcs{margin-top:3px;font-size:10px;color:#7C8DA0;letter-spacing:.05em}
.pad-legal{margin-top:10px;text-align:right;font-size:10.5px;line-height:1.6;color:#526173}
.pad-legal b{color:${branding.ink};letter-spacing:.06em}
.pad-rule{margin-top:16px;height:5px;border-radius:2px;background:linear-gradient(90deg,${branding.brandNavy} 0%,${branding.brandBlue} 38%,${branding.brandGreen} 72%,${branding.brandGreen} 100%)}
.pad-sub{display:flex;justify-content:space-between;gap:16px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7C8DA0;padding:7px 2px 0;border-bottom:1px solid #E2E8F0}
.meta{display:flex;flex-wrap:wrap;gap:10px;padding:16px ${margin}mm 0}
.meta div{flex:1;min-width:120px;background:#F6F9FC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px}
.meta span{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#7C8DA0}
.meta b{display:block;margin-top:3px;font-size:14px;color:${branding.ink}}
.meta b.brand{color:${branding.brandNavy}}
.doc{padding:8px ${margin}mm 30px}
.doc h2{margin:30px 0 12px;font-size:19px;color:${branding.ink}}
.doc h2::before{content:'';display:inline-block;width:9px;height:9px;border-radius:2px;background:${branding.brandBlue};margin-right:9px;vertical-align:1px}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(11,31,51,.04)}
.card h3{margin:0 0 6px;font-size:15px}
.card p{margin:0;color:#526173;font-size:13.5px;line-height:1.6}
.tag{margin-top:10px;display:inline-block;background:#F0FDF4;color:#166534;border:1px solid #BBF7D0;font-size:11.5px;padding:4px 10px;border-radius:99px}
ol.timeline{padding-left:0;list-style:none}
ol.timeline li{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;margin-bottom:10px}
ol.timeline li span{color:${branding.brandGreen};font-size:12.5px;font-weight:600}
ol.timeline li p{color:#526173;font-size:13.5px;margin:5px 0 0}
.pay{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;display:flex;gap:14px;flex-wrap:wrap}
.pay div{flex:1;min-width:130px;text-align:center;border:1px dashed #CBD8E6;border-radius:10px;padding:12px 8px}
.pay b{font-size:22px;color:${branding.brandGreen}}
.pay small{color:#526173}
.note{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:13px 16px;font-size:13px;color:#92400E;margin:20px 0}
.sigs{display:flex;gap:28px;flex-wrap:wrap;margin-top:34px;position:relative}
.sig{flex:1;min-width:220px}
.sig .line{height:44px;border-bottom:2px solid ${branding.ink};display:flex;align-items:flex-end;padding-bottom:4px;font-size:11px;color:#94A3B8;font-style:italic}
.sig .who{margin-top:8px;font-size:12.5px;font-weight:700;color:${branding.ink}}
.sig .role{font-size:11px;color:#526173;margin-top:2px;line-height:1.5}
.stamp{margin-top:6px;font-size:10px;color:#7C8DA0;letter-spacing:.04em}
.seal img{display:block}
.seal-br{position:absolute;right:12px;bottom:-6px}
.sig-seal{margin-left:12px;align-self:flex-end}
.pad-footer{margin-top:26px;border-top:1px solid #E2E8F0;padding:16px ${margin}mm 24px}
.pad-footer .rule{height:4px;border-radius:2px;background:linear-gradient(90deg,${branding.brandGreen} 0%,${branding.brandBlue} 55%,${branding.brandNavy} 100%);margin-bottom:16px}
.pad-footer .blocks{display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between}
.pad-footer .blk{min-width:150px;flex:1}
.pad-footer .blk h3{margin:0 0 5px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:${branding.brandBlue};font-weight:800}
.pad-footer .blk p{margin:0;font-size:10.5px;line-height:1.6;color:#526173}
.pad-footer .fine{margin-top:14px;font-size:9.5px;color:#7C8DA0;line-height:1.7;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.acts{display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap}
.btn{padding:13px 28px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block}
.btn-a{background:${branding.brandGreen};color:#fff}
.btn-r{background:#fff;color:${branding.ink};border:1px solid #CBD8E6}
@media print{
  body{background:#fff}
  .sheet{max-width:none;box-shadow:none;margin:0}
  .acts,.no-print{display:none!important}
  @page{margin:${headerPad}mm ${margin}mm ${footerPad}mm ${margin}mm; ${pageSizeCss(branding.pageSize)}}
  .card,.pay,ol.timeline li{break-inside:avoid}
  .sigs{break-inside:avoid}
  .brand-header,.brand-footer{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
`
}

export function brandHeaderHtml(branding: DocumentBrandingConfig): string {
  return `<div class="brand-header" role="banner" aria-label="TECH360 LLC official letterhead header">
  <img src="${branding.headerAsset}" alt="TECH360 — Smart Solution for a Digital Tomorrow" />
</div>`
}

export function brandFooterHtml(branding: DocumentBrandingConfig): string {
  return `<div class="brand-footer" role="contentinfo" aria-label="TECH360 LLC official letterhead footer">
  <img src="${branding.footerAsset}" alt="TECH360 footer — Smart Solution for a Digital Tomorrow · bdtech360.com · info@bdtech360.com" />
</div>`
}

// Back-compat wrappers that preserve the old letterhead.ts PAD API but delegate to branding config
export function brandingPadHeader(branding: DocumentBrandingConfig, docKind: string): string {
  return `<!-- branding v${branding.version} · ${branding.pageSize} · header:${branding.headerSpacingMm}mm footer:${branding.footerSpacingMm}mm -->
${brandHeaderHtml(branding)}
<div class="pad">
  <div class="pad-top">
    <div class="pad-logo">
      <img src="${branding.logoAsset}" alt="TECH360 LLC — official letterhead"/>
    </div>
    <div class="pad-brand">
      <div class="name">TECH360</div>
      <div class="tag">${branding.tagline}</div>
      <div class="svcs">${branding.servicesLine}</div>
    </div>
  </div>
  <div class="pad-legal"><b>${branding.legalName}</b> · Missouri LLC ${branding.missouriLLC} · EIN ${branding.ein}<br/>${branding.address}</div>
  <div class="pad-rule" aria-hidden="true"></div>
  <div class="pad-sub"><span>Official company document</span><span>${docKind}</span></div>
</div>`
}

export function brandingPadFooter(branding: DocumentBrandingConfig, confidentialNote: string): string {
  return `<div class="pad-footer">
  <div class="rule" aria-hidden="true"></div>
  <div class="blocks">
    <div class="blk"><h3>Address</h3><p>117 S Lexington St Ste 100<br/>Harrisonville, MO 64701, USA</p></div>
    <div class="blk"><h3>Phone</h3><p>${branding.phone}</p></div>
    <div class="blk"><h3>Website</h3><p>${branding.websiteDisplay}</p></div>
    <div class="blk"><h3>Email</h3><p>${branding.email}</p></div>
  </div>
  <div class="fine">
    <span>${confidentialNote}</span>
    <span>Issued electronically by the Tech360 client platform · ${branding.legalName} · EIN ${branding.ein} · branding v${branding.version}</span>
  </div>
</div>
${brandFooterHtml(branding)}`
}
