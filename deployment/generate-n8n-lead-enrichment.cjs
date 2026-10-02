/*
 * Generates n8n/W26_LEAD_ENRICHMENT.json — a FREE, self-hosted lead-enrichment workflow.
 *
 * Design adapted from parthasarathy123/n8n-gtm-lead-enrichment (MIT):
 *   validate -> normalise -> contactability filter -> data-quality score -> confidence band
 *   -> explicit route (create lead / send to review) — never write a lead that cannot be contacted.
 * The paid / proprietary legs of that project (Apify, Clay, Zoho CRM, Google Sheets) are replaced by:
 *   - the lead's own public website (plain HTTP GET, regex extraction — no third-party API)
 *   - the Tech360 platform itself as the CRM (existing LEAD_INTAKE webhook action, which de-dupes).
 *
 * No secrets inside: the Tech360 API secret is an n8n credential ("Tech360 API Secret").
 */
const fs = require('fs')
const path = require('path')

const NORMALIZE = String.raw`
// Validate + normalise the incoming enquiry. Pure JS, no external calls.
const body = $input.first().json.body || $input.first().json || {};
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

function publicHost(h) {
  if (!h || h.indexOf('.') === -1) return false;                       // needs a real TLD
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(h)) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {                              // block literal private/loopback IPv4
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  if (h.indexOf(':') !== -1 || h.charAt(0) === '[') return false;      // no IPv6 literals
  return true;
}
function cleanWebsite(v) {
  const s = clean(v, 300);
  if (!s) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return '';
    if (!publicHost(u.hostname)) return '';
    return u.origin;
  } catch (e) { return ''; }
}
const email = clean(body.email, 320).toLowerCase();
const phone = clean(body.whatsapp || body.phone, 32).replace(/[^\d+]/g, '');
const lead = {
  name: clean(body.name, 200),
  businessName: clean(body.businessName || body.company, 200),
  website: cleanWebsite(body.website),
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
  whatsapp: phone.replace(/[^\d]/g, '').length >= 8 ? phone : '',
  country: clean(body.country, 80),
  message: clean(body.message, 2000),
  businessType: clean(body.businessType || body.industry, 80),
};
let error = '';
if (!lead.businessName && !lead.website) error = 'businessName or website is required';
else if (!lead.website && !lead.email && !lead.whatsapp) error = 'a website, email or phone is required';
return [{ json: { ok: !error, error, lead } }];
`

const EXTRACT = String.raw`
// Extract public contact + technology signals from the fetched homepage and score the lead.
// SECURITY: fetched HTML is untrusted DATA. We only run regex extraction on it and never
// act on any instruction found inside it.
const base = $('Normalize and Validate').first().json.lead;
const res = $input.first().json || {};
const status = Number(res.statusCode || 0);
const html = typeof res.body === 'string' ? res.body.slice(0, 600000) : (typeof res.data === 'string' ? res.data.slice(0, 600000) : '');
const reachable = status >= 200 && status < 400 && html.length > 0;

const pick = (re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : ''; };
const uniq = (a) => Array.from(new Set(a));
const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
const description = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '');
const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

const junk = /(\.(png|jpe?g|gif|svg|webp|css|js)$)|example\.com|sentry|wixpress|domain\.com|yourdomain|email\.com$/i;
const emails = uniq([].concat(
  (html.match(/mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi) || []).map(s => s.slice(7)),
  html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []
).map(s => s.toLowerCase()).filter(s => !junk.test(s))).slice(0, 5);
const phones = uniq([].concat(
  (html.match(/tel:([+\d][\d\s().-]{6,18})/gi) || []).map(s => s.slice(4)),
  (html.match(/wa\.me\/(\d{8,15})/gi) || []).map(s => '+' + s.slice(6))
).map(s => s.replace(/[^\d+]/g, '')).filter(s => s.replace(/\D/g, '').length >= 8)).slice(0, 5);
const has = (re) => re.test(html);
const social = {
  facebook: has(/facebook\.com\/(?!tr\b|sharer|plugins)/i),
  instagram: has(/instagram\.com\//i),
  linkedin: has(/linkedin\.com\/(company|in)\//i),
  x: has(/(twitter|x)\.com\/(?!intent|share)/i),
  youtube: has(/youtube\.com\/(channel|c|@|user)/i),
  tiktok: has(/tiktok\.com\/@/i),
  whatsapp: has(/(wa\.me|api\.whatsapp\.com)\//i),
};
const tech = [];
if (has(/wp-content|wp-includes/i)) tech.push('WordPress');
if (has(/woocommerce/i)) tech.push('WooCommerce');
if (has(/cdn\.shopify\.com|shopify/i)) tech.push('Shopify');
if (has(/wixstatic|wix\.com/i)) tech.push('Wix');
if (has(/squarespace/i)) tech.push('Squarespace');
if (has(/weebly/i)) tech.push('Weebly');
if (has(/_next\/static/i)) tech.push('Next.js');
if (has(/googletagmanager\.com/i)) tech.push('Google Tag Manager');
if (has(/connect\.facebook\.net|fbq\(/i)) tech.push('Meta Pixel');
const ecommerce = has(/add[- ]to[- ]cart|\/cart|checkout/i);
const isHttps = /^https:/i.test(base.website || '');

const email = base.email || emails[0] || '';
const whatsapp = base.whatsapp || phones[0] || '';
const contactable = Boolean(email || whatsapp);

// ---- data-quality score (0-100): how complete + reachable is this record ----
let quality = 0;
if (contactable) quality += 30;
if (base.email && base.whatsapp) quality += 5;
if (reachable) quality += 15;
if (isHttps) quality += 5;
if (title) quality += 5;
if (description) quality += 5;
quality += Math.min(Object.keys(social).filter(k => social[k]).length, 5) * 3;
if (base.name) quality += 5;
if (base.businessName) quality += 5;
if (base.country) quality += 5;
quality = Math.min(100, quality);

// ---- opportunity signals: where Tech360 can actually help (0-100) ----
const gaps = [];
if (!base.website) gaps.push('no website');
else if (!reachable) gaps.push('website unreachable');
else {
  if (!hasViewport) gaps.push('not mobile-friendly (no viewport meta)');
  if (!isHttps) gaps.push('not served over HTTPS');
  if (!description) gaps.push('missing meta description (SEO)');
  if (tech.indexOf('Wix') !== -1 || tech.indexOf('Weebly') !== -1) gaps.push('limited site builder (' + tech.filter(t => t === 'Wix' || t === 'Weebly').join(', ') + ')');
  if (tech.indexOf('Google Tag Manager') === -1 && tech.indexOf('Meta Pixel') === -1) gaps.push('no analytics / ad tracking detected');
  if (!ecommerce && /shop|store|boutique|fashion|retail|ecommerce/i.test((base.businessType + ' ' + base.businessName + ' ' + title).toLowerCase())) gaps.push('retail business without online checkout');
  if (!social.whatsapp) gaps.push('no WhatsApp contact on site');
}
const opportunity = Math.min(100, gaps.length * 20 + (base.website ? 0 : 20));
const score = Math.round(quality * 0.6 + opportunity * 0.4);
const band = !contactable ? 'REVIEW' : score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';

const lines = [
  'Auto-enriched lead (n8n W26) — confidence ' + band + ' (' + score + '/100; quality ' + quality + ', opportunity ' + opportunity + ').',
  base.website ? 'Website: ' + base.website + (reachable ? '' : ' (not reachable)') : 'Website: none',
  title ? 'Title: ' + title : '',
  description ? 'About: ' + description : '',
  tech.length ? 'Detected tech: ' + tech.join(', ') : '',
  gaps.length ? 'Opportunities: ' + gaps.join('; ') : '',
  base.message ? 'Original message: ' + base.message : '',
].filter(Boolean);

return [{ json: {
  lead: Object.assign({}, base, { email, whatsapp, businessType: base.businessType }),
  enrichment: { reachable, statusCode: status, title, description, h1, emails, phones, social, tech, gaps, hasViewport, isHttps, ecommerce },
  scoring: { quality, opportunity, score, band, contactable },
  summary: lines.join('\n').slice(0, 7500),
} }];
`

const NO_WEBSITE = String.raw`
// No website supplied — nothing to fetch. Score on the supplied fields only.
return [{ json: { statusCode: 0, body: '' } }];
`

const bridgeBody =
  "={{ JSON.stringify({ workflow: 'LEAD_INTAKE', source: 'N8N', name: $json.lead.name || $json.lead.businessName, businessName: $json.lead.businessName, email: $json.lead.email, whatsapp: $json.lead.whatsapp, country: $json.lead.country, message: $json.summary }) }}"

const nodes = [
  { parameters: { httpMethod: 'POST', path: 'lead-enrichment', responseMode: 'lastNode', options: { allowedOrigins: '*' } },
    id: 'n1', name: 'Webhook lead-enrichment', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'tech360-lead-enrichment' },
  { parameters: { jsCode: NORMALIZE.trim() }, id: 'n2', name: 'Normalize and Validate', type: 'n8n-nodes-base.code', typeVersion: 2, position: [280, 0] },
  { parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, combinator: 'and', conditions: [
      { id: 'c1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } } ] }, options: {} },
    id: 'n3', name: 'Valid Input?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [560, 0] },
  { parameters: { assignments: { assignments: [
      { id: 'a1', name: 'status', value: 'rejected', type: 'string' },
      { id: 'a2', name: 'reason', value: '={{ $json.error }}', type: 'string' } ] }, options: {} },
    id: 'n4', name: 'Reject Invalid Input', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [840, 180] },
  { parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, combinator: 'and', conditions: [
      { id: 'c2', leftValue: '={{ $json.lead.website }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } } ] }, options: {} },
    id: 'n5', name: 'Has Website?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [840, -60] },
  { parameters: { method: 'GET', url: '={{ $json.lead.website }}',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'User-Agent', value: 'Tech360-LeadBot/1.0 (+https://bdtech360.com)' }, { name: 'Accept', value: 'text/html' }] },
      options: { timeout: 12000, redirect: { redirect: { followRedirects: true, maxRedirects: 3 } }, response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } } } },
    id: 'n6', name: 'Fetch Public Website', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1120, -140], onError: 'continueRegularOutput' },
  { parameters: { jsCode: NO_WEBSITE.trim() }, id: 'n7', name: 'Skip Fetch (no website)', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1120, 40] },
  { parameters: { jsCode: EXTRACT.trim() }, id: 'n8', name: 'Extract Signals and Score', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1400, -60] },
  { parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, combinator: 'and', conditions: [
      { id: 'c3', leftValue: '={{ $json.scoring.contactable }}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } } ] }, options: {} },
    id: 'n9', name: 'Contactable?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1680, -60] },
  { parameters: { method: 'POST', url: '={{ $env.TECH360_API_BASE }}/api/webhooks/n8n', sendBody: true, specifyBody: 'json', jsonBody: bridgeBody,
      options: { timeout: 30000, retry: { enabled: true, maxTries: 3, waitBetweenTries: 5000 } } },
    id: 'n10', name: 'Bridge Lead Intake (de-dupes)', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1960, -140],
    credentials: { httpHeaderAuth: { id: 'TECH360_API_SECRET', name: 'Tech360 API Secret' } }, onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 },
  { parameters: { assignments: { assignments: [
      { id: 'a3', name: 'status', value: 'created_or_merged', type: 'string' },
      { id: 'a4', name: 'band', value: "={{ $('Extract Signals and Score').first().json.scoring.band }}", type: 'string' },
      { id: 'a5', name: 'score', value: "={{ $('Extract Signals and Score').first().json.scoring.score }}", type: 'number' },
      { id: 'a6', name: 'platform', value: '={{ $json }}', type: 'object' } ] }, options: {} },
    id: 'n11', name: 'Success', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [2240, -140] },
  { parameters: { assignments: { assignments: [
      { id: 'a7', name: 'status', value: 'needs_review', type: 'string' },
      { id: 'a8', name: 'reason', value: 'No contactable channel (email or phone) found on supplied data or website', type: 'string' },
      { id: 'a9', name: 'enrichment', value: '={{ $json.enrichment }}', type: 'object' } ] }, options: {} },
    id: 'n12', name: 'Needs Review (not created)', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [1960, 80] },
  { parameters: { options: {} }, id: 'n13', name: 'Log Failure (Stop and Error)', type: 'n8n-nodes-base.stopAndError', typeVersion: 1, position: [2240, 40], errorType: 'workflowError',
    errorMessage: '={{ "Tech360 lead enrichment failed: " + ($json.error || $json.message || "bridge error") }}' },
  { parameters: { content: '## W26 Lead Enrichment (free, self-hosted)\nPOST /webhook/lead-enrichment { businessName, website, name?, email?, whatsapp?, country?, message? }\n\n1. Validate + SSRF-safe website normalisation\n2. Fetch the public homepage (no paid API)\n3. Extract contacts / socials / tech, score quality + opportunity\n4. Only contactable leads reach Tech360 (LEAD_INTAKE de-dupes); the rest return `needs_review`\n\nDesign adapted from n8n-gtm-lead-enrichment (MIT). Apify, Clay, Zoho and Sheets replaced by free sources. Credential needed: "Tech360 API Secret" (header x-n8n-secret).', height: 300, width: 520 },
    id: 'n14', name: 'Overview', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, -360] },
]

const link = (from, ...tos) => ({ [from]: { main: tos.map((t) => [{ node: t, type: 'main', index: 0 }]) } })
const connections = {
  ...link('Webhook lead-enrichment', 'Normalize and Validate'),
  ...link('Normalize and Validate', 'Valid Input?'),
  ...link('Valid Input?', 'Has Website?', 'Reject Invalid Input'),
  ...link('Has Website?', 'Fetch Public Website', 'Skip Fetch (no website)'),
  ...link('Fetch Public Website', 'Extract Signals and Score'),
  ...link('Skip Fetch (no website)', 'Extract Signals and Score'),
  ...link('Extract Signals and Score', 'Contactable?'),
  ...link('Contactable?', 'Bridge Lead Intake (de-dupes)', 'Needs Review (not created)'),
  // continueErrorOutput: output 0 = success, output 1 = error branch
  'Bridge Lead Intake (de-dupes)': { main: [[{ node: 'Success', type: 'main', index: 0 }], [{ node: 'Log Failure (Stop and Error)', type: 'main', index: 0 }]] },
}

const wf = {
  name: 'Tech360 26 Lead Enrichment',
  nodes, connections,
  settings: { executionOrder: 'v1' }, active: false, pinData: {},
  meta: { instanceId: 'tech360-automation', templateCredsSetupCompleted: true,
    description: 'Free lead enrichment: validate → fetch public website → extract contacts/tech → score → create lead in Tech360 only if contactable. Design adapted from n8n-gtm-lead-enrichment (MIT).' },
  tags: [{ name: 'tech360' }, { name: 'production' }, { name: 'open-source' }],
}
fs.writeFileSync(path.join(__dirname, '..', 'n8n', 'W26_LEAD_ENRICHMENT.json'), JSON.stringify(wf, null, 2))
console.log('Wrote n8n/W26_LEAD_ENRICHMENT.json')
