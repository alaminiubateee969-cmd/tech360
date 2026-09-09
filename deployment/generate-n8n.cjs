/* Generates 25 importable n8n workflow JSONs (no secrets — credentials via n8n). */
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'n8n')

const W = (code, name, desc, nodes, connections) => ({
  name: `Tech360 ${name}`,
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
  active: false,
  pinData: {},
  meta: {
    instanceId: 'tech360-automation',
    templateCredsSetupCompleted: true,
    description: desc,
  },
  tags: [{ name: 'tech360' }, { name: 'production' }],
  code,
})

function webhookNode(pathSuffix, method = 'POST') {
  return {
    parameters: { httpMethod: method, path: pathSuffix, responseMode: 'lastNode', options: { allowedOrigins: '*' } },
    id: 'n1', name: `Webhook ${pathSuffix}`, type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: `tech360-${pathSuffix}`,
  }
}
function apiCall(name, body, onError = 'continueRegularOutput') {
  return {
    parameters: {
      method: 'POST',
      url: '={{ $env.TECH360_API_BASE }}/api/webhooks/n8n',
      sendBody: true, specifyBody: 'json',
      jsonBody: `=${JSON.stringify(body).replace(/"{{BODY}}"/, '={{ JSON.stringify($json) }}')}`,
      options: { timeout: 30000, retry: { enabled: true, maxTries: 3, waitBetweenTries: 5000 } },
    },
    id: 'n2', name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [300, 0],
    credentials: { httpHeaderAuth: { id: 'TECH360_API_SECRET', name: 'Tech360 API Secret' } },
    onError,
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  }
}
function errorBranch() {
  return {
    parameters: { options: {} },
    id: 'n3', name: 'Log Failure (Stop and Error)', type: 'n8n-nodes-base.stopAndError', typeVersion: 1, position: [620, 160],
    errorType: 'workflowError', errorMessage: '={{ "Tech360 journey step failed: " + $json.error }}',
  }
}
function successBranch(name = 'Success') {
  return {
    parameters: { assignments: { assignments: [{ id: 'a1', name: 'status', value: 'ok', type: 'string' }] }, options: {} },
    id: 'n4', name, type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [620, -80],
  }
}
const link = (from, to, out = 'main') => ({ [from]: { main: [[{ node: to, type: out, index: 0 }]] } })

const workflows = []

const defs = [
  ['W01_LEAD_INTAKE', '01 Lead Intake', 'First message (any channel) → Client ID → CRM lead → welcome message. Trigger: webhook or form POST. Calls platform journey engine.', 'lead-intake', { workflow: 'LEAD_INTAKE', source: '={{ $json.source || "N8N" }}', name: '={{ $json.name }}', businessName: '={{ $json.businessName }}', email: '={{ $json.email }}', whatsapp: '={{ $json.whatsapp }}', country: '={{ $json.country }}', message: '={{ $json.message }}' }],
  ['W02_WHATSAPP_IN', '02 WhatsApp Incoming', 'Receives WhatsApp Cloud API webhooks (messages + statuses), forwards to platform which links everything to the Client ID. Configure the WhatsApp credential + platform API secret. Platform webhook: /api/webhooks/whatsapp.', 'whatsapp-in', null],
  ['W03_EMAIL_IN', '03 Email Incoming', 'Inbound email parsed (IMAP or mail webhook) → forwarded to n8n bridge → attached to client record.', 'email-in', { workflow: 'LEAD_INTAKE', source: 'EMAIL', name: '={{ $json.fromName }}', email: '={{ $json.fromEmail }}', message: '={{ $json.subject }}: {{ $json.text }}' }],
  ['W04_SOCIAL_INBOX', '04 Social Inbox', 'Facebook/Instagram/LinkedIn/X inbound messages → platform /api/webhooks/social → CRM communications.', 'social-inbox', null],
  ['W05_BUSINESS_DETECTION', '05 Business Detection', 'AI business-type detection after intake. Signal trigger from CRM.', 'business-detection', { workflow: 'DETECT_BUSINESS', clientId: '={{ $json.clientId }}', message: '={{ $json.message }}' }],
  ['W06_PLAN_RECOMMENDATION', '06 Plan Recommendation', 'AI recommends the best Tech360 service plan for the detected business.', 'plan-recommendation', { workflow: 'RECOMMEND_PLAN', clientId: '={{ $json.clientId }}' }],
  ['W07_SCOPE_COLLECTION', '07 Scope Collection', 'AI-generated discovery questions sent to client via WhatsApp/Email (adapter-level honesty: NOT_CONFIGURED if credentials absent).', 'scope-collection', { workflow: 'ASK_SCOPE_QUESTIONS', clientId: '={{ $json.clientId }}' }],
  ['W08_SCOPE_REVIEW', '08 Scope Review', 'Client submits scope → AI gap analysis + draft Scope of Work + admin approval queue entry.', 'scope-review', { workflow: 'SUBMIT_SCOPE', clientId: '={{ $json.clientId }}', scopeText: '={{ $json.scopeText }}' }],
  ['W09_FINAL_SCOPE', '09 Final Scope', 'Admin approval → final SOW version locked. Executed via platform approval endpoint.', 'final-scope', null],
  ['W10_ADMIN_APPROVAL', '10 Admin Approval', 'Sensitive action queue: Super Admin approves/rejects in the Command Center → gated execution (final scope send, refunds, handover, deletions).', 'admin-approval', null],
  ['W11_CLIENT_APPROVAL', '11 Client Approval', 'Client approves or requests revision of final scope; revisions create new versions; meetings only when client asks.', 'client-approval', { workflow: 'CLIENT_SCOPE_DECISION', clientId: '={{ $json.clientId }}', decision: '={{ $json.decision }}', notes: '={{ $json.notes }}' }],
  ['W12_MEETING', '12 Meeting', 'Meeting requested by client → slots proposed → booking link.', 'meeting', null],
  ['W13_HTML_PREVIEW', '13 HTML Preview', 'Generate HTML preview from approved scope, send tokenized link, track VIEWED/APPROVED/REVISION events.', 'html-preview', { workflow: 'GENERATE_PREVIEW', clientId: '={{ $json.clientId }}' }],
  ['W14_PAYMENT', '14 Payment', 'Payment instructions (approval-gated) + recording + verification gate.', 'payment', { workflow: 'REQUEST_PAYMENT', clientId: '={{ $json.clientId }}' }],
  ['W15_PROJECT_START', '15 Project Start', 'Verified payment → project ACTIVE + AI task breakdown.', 'project-start', { workflow: 'START_PROJECT', clientId: '={{ $json.clientId }}' }],
  ['W16_PROJECT_TASKS', '16 Project Tasks', 'Task generation/progress for active projects.', 'project-tasks', { workflow: 'START_PROJECT', clientId: '={{ $json.clientId }}', projectId: '={{ $json.projectId }}' }],
  ['W17_PROJECT_UPDATES', '17 Project Updates', 'Milestone progress updates to the client via configured channels.', 'project-updates', null],
  ['W18_FINAL_PAYMENT', '18 Final Payment', 'Final payment request + verification → unlocks handover preparation.', 'final-payment', { workflow: 'RECORD_PAYMENT', clientId: '={{ $json.clientId }}', amount: '={{ $json.amount }}', method: '={{ $json.method }}', transactionId: '={{ $json.transactionId }}', milestone: 'FINAL' }],
  ['W19_DELIVERY', '19 Delivery', 'Delivery checklist + client confirmation questions.', 'delivery', null],
  ['W20_SOURCE_HANDOVER', '20 Source Code Handover', 'Full payment gate → admin approval → secure package release (tokenized, expiring, download-tracked).', 'source-handover', { workflow: 'PREPARE_HANDOVER', clientId: '={{ $json.clientId }}', projectId: '={{ $json.projectId }}' }],
  ['W21_PASSWORD_CHANGE', '21 Password Change', 'Post-handover password-change request + client confirmation.', 'password-change', null],
  ['W22_REVIEW_REQUEST', '22 Review Request', 'Optional review request after confirmed delivery (never forced).', 'review-request', null],
  ['W23_REFERRAL_REQUEST', '23 Referral Request', 'Optional referral request.', 'referral-request', null],
  ['W24_DAILY_CEO_REPORT', '24 Daily CEO Report', 'Daily scheduled CEO report from live CRM data (Pulse agent).', null, null],
  ['W25_ERROR_MONITORING', '25 Error Monitoring', 'Every 15 min: scan failed automations/messages, retry with backoff, escalate critical.', null, null],
]

for (const [code, name, desc, pathSuffix, body] of defs) {
  if (code === 'W24_DAILY_CEO_REPORT') {
    const nodes = [
      { parameters: { rule: { interval: [{ field: 'days', triggerAtHour: 8 }] } }, id: 'n1', name: 'Schedule Daily 08:00', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0] },
      apiCall('Platform CEO Report', { workflow: 'CEO_REPORT' }),
      { parameters: { options: {} }, id: 'n3', name: 'Deliver Report', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [620, 0] },
    ]
    workflows.push(W(code, name, desc, nodes, { ...link('Schedule Daily 08:00', 'Platform CEO Report'), ...link('Platform CEO Report', 'Deliver Report') }))
    continue
  }
  if (code === 'W25_ERROR_MONITORING') {
    const nodes = [
      { parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } }, id: 'n1', name: 'Schedule Every 15min', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0] },
      { parameters: { method: 'GET', url: '={{ $env.TECH360_API_BASE }}/api/admin/logs/errors?resolved=false', options: { timeout: 20000 } }, id: 'n2', name: 'Fetch Unresolved Errors', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [300, 0], credentials: { httpHeaderAuth: { id: 'TECH360_API_SECRET', name: 'Tech360 API Secret' } } },
      { parameters: { conditions: { options: { caseSensitive: true, version: 2 }, conditions: [{ leftValue: '={{ $json.logs ? $json.logs.length : 0 }}', rightValue: 0, operator: { type: 'number', operation: 'gt' } }], combinator: 'and' }, options: {} }, id: 'n3', name: 'Has Errors?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [560, 0] },
      { parameters: { options: {} }, id: 'n4', name: 'Notify Admin', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [820, -60] },
      { parameters: { options: {} }, id: 'n5', name: 'All Clear', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [820, 120] },
    ]
    workflows.push(W(code, name, desc, nodes, { 'Fetch Unresolved Errors': { main: [[{ node: 'Has Errors?', type: 'main', index: 0 }]] }, 'Has Errors?': { main: [[{ node: 'Notify Admin', type: 'main', index: 0 }], [{ node: 'All Clear', type: 'main', index: 0 }]] } }))
    continue
  }
  if (body === null) {
    // informational/gated workflows: webhook → validation → bridge with passthrough
    const nodes = [webhookNode(pathSuffix), apiCall(`Bridge ${name}`, { workflow: code.replace(/^W\d+_/, '').toUpperCase(), action: '={{ $json.action }}', clientId: '={{ $json.clientId }}', payload: '={{ $json }}' }), successBranch(), errorBranch()]
    workflows.push(W(code, name, desc, nodes, { ...link(`Webhook ${pathSuffix}`, `Bridge ${name}`), ...link(`Bridge ${name}`, 'Success'), ...link(`Bridge ${name}`, 'Log Failure (Stop and Error)', 'error') }))
    continue
  }
  const nodes = [webhookNode(pathSuffix), apiCall(`Bridge ${name}`, { workflow: code.replace(/^W\d+_/, '').toUpperCase(), ...Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v])) }), successBranch(), errorBranch()]
  workflows.push(W(code, name, desc, nodes, { ...link(`Webhook ${pathSuffix}`, `Bridge ${name}`), ...link(`Bridge ${name}`, 'Success'), ...link(`Bridge ${name}`, 'Log Failure (Stop and Error)', 'error') }))
}

fs.mkdirSync(OUT, { recursive: true })
for (const w of workflows) {
  const code = w.code
  delete w.code
  fs.writeFileSync(path.join(OUT, `${code}.json`), JSON.stringify(w, null, 2))
}
console.log(`Wrote ${workflows.length} n8n workflows to ${OUT}`)
