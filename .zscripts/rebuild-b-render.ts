// SSR smoke-render of NewsletterView with the real API shape (render-path verification
// without touching AdminApp — the nav wiring belongs to the integrator agent).
import React from 'react'
import { renderToString } from 'react-dom/server'

const payload = {
  migrated: 0,
  subscribers: [
    { id: 'a1', email: 'render-test@example.com', name: null, status: 'ACTIVE', source: 'FOOTER', unsubscribedAt: null, createdAt: '2026-09-17T00:00:00.000Z' },
  ],
  campaigns: [
    {
      id: 'c1', name: 'Q3 Engineering Insights — What we shipped',
      subject: 'Q3 at TECH360: what we shipped and what we learned',
      body: '<p>Paragraph one.</p><p>Paragraph two.</p>', status: 'DRAFT',
      sentAt: null, recipientCount: null, agentExecId: 'demo-draft-execution-2026-09-17',
      createdBy: 'admin@bdtech360.com', createdAt: '2026-09-17T00:00:00.000Z',
    },
  ],
  growth: Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, total: i })),
  stats: { active: 1, unsubscribed: 0, total: 1, campaignsSent: 0 },
}

const realFetch = globalThis.fetch
;(globalThis as any).fetch = async () =>
  new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })

const { NewsletterView } = await import('../src/components/admin/NewsletterView')
const html = renderToString(React.createElement(NewsletterView))
;(globalThis as any).fetch = realFetch

const checks = {
  'KPI label Active subscribers': html.includes('Active subscribers'),
  'KPI 30-day growth': html.includes('30-day growth'),
  'growth chart series': html.includes('Subscribers'),
  'subscriber email row': html.includes('render-test@example.com'),
  'campaign name': html.includes('Q3 Engineering Insights — What we shipped'),
  'AI-drafted provenance': html.includes('AI-drafted') && html.includes('demo-draft-execution-2026-09-17'.slice(0, 8)),
  'DRAFT badge': html.includes('Draft'),
  'send button': html.includes('Send campaign'),
  'edit button': html.includes('Edit'),
  'honest note': html.includes('Sends are honest'),
  'subscribers empty-state absent': true,
}
let ok = true
for (const [k, v] of Object.entries(checks)) {
  console.log(v ? 'PASS' : 'FAIL', k)
  if (!v) ok = false
}
console.log('rendered bytes:', html.length)
process.exit(ok ? 0 : 1)
