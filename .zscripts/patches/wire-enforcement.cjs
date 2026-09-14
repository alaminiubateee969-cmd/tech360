const fs = require('fs')

// Insert a feature gate at the top of an exported async handler.
// Returns true if applied.
function gate(file, handlerSig, gateCode, importLine) {
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes('// feature-gate:')) {
    console.log('skip (already gated):', file)
    return false
  }
  if (!src.includes(handlerSig)) {
    console.error('HANDLER NOT FOUND in', file, '→', handlerSig)
    return false
  }
  src = src.replace(handlerSig, handlerSig + '\n' + gateCode)
  if (importLine && !src.includes(importLine.trim().split(' from ')[0].replace('import { ', '').split(',').map(s => s.trim()).join(''))) {
    src = 'import { ' + importLine + ' }' + '\n' + src
  }
  fs.writeFileSync(file, src)
  console.log('gated:', file)
  return true
}

const importFeatures = `import { featureEnabled } from '@/lib/features'`


// ============================================================
// 1) PUBLIC BLOG — blog flag + maintenance mode
// ============================================================
gate(
  'src/app/api/blog/route.ts',
  'export async function GET() {',
  `  // feature-gate: blog switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('blog')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ posts: [], disabled: true, maintenance: (await featureEnabled('maintenance_mode')) })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 2) PUBLIC BLOG SLUG — blog flag + maintenance
// ============================================================
gate(
  'src/app/api/blog/[slug]/route.ts',
  'export async function GET(',
  `  // feature-gate: blog switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('blog')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ error: 'Blog is currently unavailable.' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 3) CONTACT INTAKE — support flag + maintenance
// ============================================================
gate(
  'src/app/api/contact/route.ts',
  'export async function POST(req: NextRequest) {',
  `  // feature-gate: support/contact switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('support'))) {
    return Response.json({ error: 'Contact form intake is currently disabled. Please try again later or email hello@bdtech360.com.' }, { status: 503 })
  }
  if (await featureEnabled('maintenance_mode')) {
    return Response.json({ error: 'We are performing scheduled maintenance. Please try again shortly.' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 4) NEWSLETTER — maintenance
// ============================================================
gate(
  'src/app/api/newsletter/route.ts',
  'export async function POST(req: NextRequest) {',
  `  // feature-gate: maintenance mode (Super Admin)
  if (await featureEnabled('maintenance_mode')) {
    return Response.json({ error: 'We are performing scheduled maintenance. Please try again shortly.' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 5) PUBLIC REVIEWS FEED — public_website flag + maintenance
// ============================================================
gate(
  'src/app/api/reviews/route.ts',
  'export async function GET() {',
  `  // feature-gate: public website switch + maintenance mode (Super Admin)
  if (!(await featureEnabled('public_website')) || (await featureEnabled('maintenance_mode'))) {
    return Response.json({ reviews: [] })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 6) ADMIN PAYMENT RECORDING — payments flag + gateway acceptance
// ============================================================
let src = fs.readFileSync('src/app/api/admin/payments/route.ts', 'utf8')
if (!src.includes('// feature-gate')) {
  src = src.replace(
    'export async function POST(req: NextRequest) {',
    `export async function POST(req: NextRequest) {
  // feature-gate: payments switch (Super Admin) + gateway governance
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by Super Admin (System → Feature Management).' }, { status: 503 })
  }`,
  )
  fs.writeFileSync('src/app/api/admin/payments/route.ts', src)
  console.log('gated: payments POST')
}

// ============================================================
// 7) PAYMENT VERIFY — payments flag
// ============================================================
gate(
  'src/app/api/admin/payments/verify/route.ts',
  'export async function POST(req: NextRequest) {',
  `  // feature-gate: payments switch (Super Admin)
  if (!(await featureEnabled('payments'))) {
    return Response.json({ error: 'Payments are currently disabled by Super Admin.' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 8) AI AGENT RUN — ai_agents flag
// ============================================================
gate(
  'src/app/api/admin/agents/[code]/run/route.ts',
  'export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {',
  `  // feature-gate: AI agents switch (Super Admin) — refuses execution,
  // including from the autonomous ops loop trigger path
  if (!(await featureEnabled('ai_agents'))) {
    return Response.json({ error: 'AI agent execution is currently disabled by Super Admin (System → Feature Management).' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

// ============================================================
// 9) N8N REGISTRY — n8n flag
// ============================================================
gate(
  'src/app/api/admin/n8n/route.ts',
  'export async function GET(req: NextRequest) {',
  `  // feature-gate: n8n switch (Super Admin)
  if (!(await featureEnabled('n8n'))) {
    return Response.json({ error: 'n8n integration is currently disabled by Super Admin.' }, { status: 503 })
  }`,
  `import { featureEnabled } from '@/lib/features'`,
)

console.log('done')
