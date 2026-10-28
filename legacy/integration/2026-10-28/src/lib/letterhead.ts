// ------------------------------------------------------------
// TECH360 LLC — Official company pad (letterhead) engine
// Single source of truth for every official document the
// platform issues: SOW previews, invoices, handover
// certificates, printed legal policies.
// Design mirrors the company pad shared by the owner:
// logo + "CONNECT • INNOVATE • GROW" tagline, "Web | Cloud |
// AI | Data | Tech" services line, TECH360 body watermark,
// labeled ADDRESS / PHONE / WEBSITE / EMAIL footer blocks.
// ------------------------------------------------------------

export const PAD = {
  logoUrl: "/brand/tech360-logo-original.jpg",
  logoUrl2x: "/brand/tech360-logo-original.jpg",
  legalName: "TECH360 LLC",
  missouriLLC: "LC014737249",
  ein: "98-1940053",
  address: "117 S Lexington St Ste 100, Harrisonville, MO 64701, USA",
  email: "info@bdtech360.com",
  phone: "+1 (347) 433 1200",
  domain: "bdtech360.com",
  tagline: "CONNECT · INNOVATE · GROW",
  servicesLine: "Web | Cloud | AI | Data | Tech",
  brandBlue: "#009FE3",
  brandNavy: "#063B8F",
  brandGreen: "#18B83A",
  ink: "#0B1F33",
} as const

/** Shared CSS for standalone official documents (SOW preview, invoice, handover). */
export const PAD_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;background:#EDF2F7;color:${PAD.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:900px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 60px -20px rgba(6,59,143,.18);position:relative;overflow:hidden}
/* faint TECH360 watermark like the company pad */
.sheet::before{content:'TECH360';position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-size:110px;font-weight:900;letter-spacing:.12em;color:rgba(6,59,143,.045);pointer-events:none;white-space:nowrap;z-index:0}
.sheet>*{position:relative;z-index:1}
/* — letterhead (mirrors the shared company pad) — */
.pad{padding:34px 42px 0}
.pad-top{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.pad-logo{display:flex;align-items:center;gap:14px}
.pad-logo img{height:46px;width:auto;display:block}
.pad-brand{text-align:right}
.pad-brand .name{font-size:19px;font-weight:900;letter-spacing:.14em;color:${PAD.ink}}
.pad-brand .tag{margin-top:3px;font-size:10.5px;font-weight:700;letter-spacing:.22em;color:${PAD.brandBlue}}
.pad-brand .svcs{margin-top:3px;font-size:10px;color:#7C8DA0;letter-spacing:.05em}
.pad-legal{margin-top:10px;text-align:right;font-size:10.5px;line-height:1.6;color:#526173}
.pad-legal b{color:${PAD.ink};letter-spacing:.06em}
.pad-rule{margin-top:16px;height:5px;border-radius:2px;background:linear-gradient(90deg,${PAD.brandNavy} 0%,${PAD.brandBlue} 38%,${PAD.brandGreen} 72%,${PAD.brandGreen} 100%)}
.pad-sub{display:flex;justify-content:space-between;gap:16px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#7C8DA0;padding:7px 2px 0;border-bottom:1px solid #E2E8F0}
/* — document meta bar — */
.meta{display:flex;flex-wrap:wrap;gap:10px;padding:16px 42px 0}
.meta div{flex:1;min-width:120px;background:#F6F9FC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px}
.meta span{display:block;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#7C8DA0}
.meta b{display:block;margin-top:3px;font-size:14px;color:${PAD.ink}}
.meta b.brand{color:${PAD.brandNavy}}
/* — body — */
.doc{padding:8px 42px 30px}
.doc h2{margin:30px 0 12px;font-size:19px;color:${PAD.ink}}
.doc h2::before{content:'';display:inline-block;width:9px;height:9px;border-radius:2px;background:${PAD.brandBlue};margin-right:9px;vertical-align:1px}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(11,31,51,.04)}
.card h3{margin:0 0 6px;font-size:15px}
.card p{margin:0;color:#526173;font-size:13.5px;line-height:1.6}
.tag{margin-top:10px;display:inline-block;background:#F0FDF4;color:#166534;border:1px solid #BBF7D0;font-size:11.5px;padding:4px 10px;border-radius:99px}
ol.timeline{padding-left:0;list-style:none}
ol.timeline li{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;margin-bottom:10px}
ol.timeline li span{color:${PAD.brandGreen};font-size:12.5px;font-weight:600}
ol.timeline li p{color:#526173;font-size:13.5px;margin:5px 0 0}
.pay{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;display:flex;gap:14px;flex-wrap:wrap}
.pay div{flex:1;min-width:130px;text-align:center;border:1px dashed #CBD8E6;border-radius:10px;padding:12px 8px}
.pay b{font-size:22px;color:${PAD.brandGreen}}
.pay small{color:#526173}
.note{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:13px 16px;font-size:13px;color:#92400E;margin:20px 0}
/* — signature blocks — */
.sigs{display:flex;gap:28px;flex-wrap:wrap;margin-top:34px}
.sig{flex:1;min-width:220px}
.sig .line{height:44px;border-bottom:2px solid ${PAD.ink};display:flex;align-items:flex-end;padding-bottom:4px;font-size:11px;color:#94A3B8;font-style:italic}
.sig .who{margin-top:8px;font-size:12.5px;font-weight:700;color:${PAD.ink}}
.sig .role{font-size:11px;color:#526173;margin-top:2px;line-height:1.5}
.stamp{margin-top:6px;font-size:10px;color:#7C8DA0;letter-spacing:.04em}
/* — pad footer: labeled blocks like the shared company pad — */
.pad-footer{margin-top:26px;border-top:1px solid #E2E8F0;padding:16px 42px 24px}
.pad-footer .rule{height:4px;border-radius:2px;background:linear-gradient(90deg,${PAD.brandGreen} 0%,${PAD.brandBlue} 55%,${PAD.brandNavy} 100%);margin-bottom:16px}
.pad-footer .blocks{display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between}
.pad-footer .blk{min-width:150px;flex:1}
.pad-footer .blk h3{margin:0 0 5px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:${PAD.brandBlue};font-weight:800}
.pad-footer .blk p{margin:0;font-size:10.5px;line-height:1.6;color:#526173}
.pad-footer .fine{margin-top:14px;font-size:9.5px;color:#7C8DA0;line-height:1.7;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.acts{display:flex;gap:12px;justify-content:center;margin-top:26px;flex-wrap:wrap}
.btn{padding:13px 28px;border-radius:10px;font-weight:700;text-decoration:none;display:inline-block}
.btn-a{background:${PAD.brandGreen};color:#fff}
.btn-r{background:#fff;color:${PAD.ink};border:1px solid #CBD8E6}
/* — print: the document prints as the company pad — */
@media print{
  body{background:#fff}
  .sheet{max-width:none;box-shadow:none;margin:0}
  .acts,.no-print{display:none!important}
  @page{margin:12mm 10mm}
  .card,.pay,ol.timeline li{break-inside:avoid}
  .sigs{break-inside:avoid}
}
`

/** The letterhead header block for standalone official documents. */
export function padHeader(docKind: string): string {
  return `<div class="pad">
  <div class="pad-top">
    <div class="pad-logo">
      <img src="${PAD.logoUrl}" srcset="${PAD.logoUrl} 1x, ${PAD.logoUrl2x} 2x" alt="TECH360 LLC — official letterhead"/>
    </div>
    <div class="pad-brand">
      <div class="name">TECH360</div>
      <div class="tag">${PAD.tagline}</div>
      <div class="svcs">${PAD.servicesLine}</div>
    </div>
  </div>
  <div class="pad-legal"><b>${PAD.legalName}</b> · Missouri LLC ${PAD.missouriLLC} · EIN ${PAD.ein}<br/>${PAD.address}</div>
  <div class="pad-rule" aria-hidden="true"></div>
  <div class="pad-sub"><span>Official company document</span><span>${docKind}</span></div>
</div>`
}

/** Document meta bar (reference / issued / valid / status). */
export function padMeta(items: Array<{ label: string; value: string; brand?: boolean }>): string {
  return `<div class="meta">${items
    .map((i) => `<div><span>${i.label}</span><b class="${i.brand ? "brand" : ""}">${i.value}</b></div>`)
    .join("")}</div>`
}

/** The company pad footer — labeled ADDRESS / PHONE / WEBSITE / EMAIL blocks. */
export function padFooter(confidentialNote: string): string {
  return `<div class="pad-footer">
  <div class="rule" aria-hidden="true"></div>
  <div class="blocks">
    <div class="blk"><h3>Address</h3><p>117 S Lexington St Ste 100<br/>Harrisonville, MO 64701, USA</p></div>
    <div class="blk"><h3>Phone</h3><p>${PAD.phone}</p></div>
    <div class="blk"><h3>Website</h3><p>www.${PAD.domain}</p></div>
    <div class="blk"><h3>Email</h3><p>${PAD.email}</p></div>
  </div>
  <div class="fine">
    <span>${confidentialNote}</span>
    <span>Issued electronically by the Tech360 client platform · ${PAD.legalName} · EIN ${PAD.ein}</span>
  </div>
</div>`
}

/** Signature blocks for two-party official documents. */
export function padSignatures(clientName: string, clientLabel = "Client acceptance"): string {
  return `<div class="sigs">
  <div class="sig">
    <div class="line">Authorized signature</div>
    <div class="who">TECH360 LLC</div>
    <div class="role">Project Authorization · on behalf of the company</div>
    <div class="stamp">Date: ______________</div>
  </div>
  <div class="sig">
    <div class="line">Signature</div>
    <div class="who">${clientName}</div>
    <div class="role">${clientLabel}</div>
    <div class="stamp">Date: ______________</div>
  </div>
</div>`
}

/** Consistent issue date helper. */
export function docDate(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}
