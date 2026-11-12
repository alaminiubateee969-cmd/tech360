import assert from 'node:assert/strict'
import { after, before, it } from 'node:test'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '../src/lib/db'
import { requireApprovedScope, requirePreviewBeforePayment } from '../src/lib/lifecycle-gates'
import { generatePreview, requestPayment } from '../src/lib/journey'
import { POST as decide } from '../src/app/api/preview/[token]/action/route'
import { POST as view } from '../src/app/api/preview/[token]/view/route'

let clientId = ''
let scopeId = ''
let previewId = ''
const token = randomUUID().replace(/-/g, '')
const ref = `TEST-LIFECYCLE-${token}`

before(async () => {
  const client = await db.client.create({ data: { clientId: ref, name: 'Lifecycle test', source: 'TEST' } })
  clientId = client.id
  const scope = await db.scopeOfWork.create({ data: { clientId, version: 1, status: 'FINAL', content: '{}' } })
  scopeId = scope.id
})
after(async () => {
  await db.auditLog.deleteMany({ where: { clientId: ref } })
  await db.errorLog.deleteMany({ where: { clientId: ref } })
  await db.client.delete({ where: { id: clientId } })
  await db.$disconnect()
})

it('requires a current explicit scope decision and viewed dispatch before payment', async () => {
  await assert.rejects(() => requireApprovedScope(clientId), /explicit customer approval/i)
  await assert.rejects(() => generatePreview(clientId), /explicit customer approval/i)
  await assert.rejects(() => requestPayment(clientId, 'test'), /explicit customer approval/i)
  await db.scopeApproval.create({ data: { clientId, scopeId, decision: 'APPROVED' } })
  assert.equal((await requireApprovedScope(clientId)).id, scopeId)
  await assert.rejects(() => requirePreviewBeforePayment(clientId), /dispatched and viewed/i)
  const preview = await db.preview.create({ data: { token, clientId, scopeVersion: 1, status: 'SENT', sentAt: new Date(), html: '<html></html>' } })
  previewId = preview.id
  await assert.rejects(() => requirePreviewBeforePayment(clientId), /dispatched and viewed/i)
  const response = await view(new NextRequest(`https://example.test/api/preview/${token}/view`, { method: 'POST' }), { params: Promise.resolve({ token }) })
  assert.equal(response.status, 200)
  assert.equal((await requirePreviewBeforePayment(clientId, 1)).preview.id, previewId)
  await assert.rejects(() => requirePreviewBeforePayment(clientId, 2), /scope version/i)
})

it('records one decision and does not reopen a terminal preview on view', async () => {
  const request = () => new NextRequest(`https://example.test/api/preview/${token}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'REVISION_REQUESTED', notes: 'Please adjust the design.' }) })
  const first = await decide(request(), { params: Promise.resolve({ token }) })
  assert.equal(first.status, 200)
  assert.equal((await first.json()).ok, true)
  assert.equal((await decide(request(), { params: Promise.resolve({ token }) })).status, 409)
  assert.equal(await db.previewEvent.count({ where: { previewId, type: 'REVISION_REQUESTED' } }), 1)
  assert.equal(await db.communication.count({ where: { clientId, body: { contains: 'Preview revision requested' } } }), 1)
  assert.equal((await view(new NextRequest(`https://example.test/api/preview/${token}/view`, { method: 'POST' }), { params: Promise.resolve({ token }) })).status, 200)
  assert.equal((await db.preview.findUniqueOrThrow({ where: { id: previewId } })).status, 'REVISION_REQUESTED')
  await assert.rejects(() => requirePreviewBeforePayment(clientId), /dispatched and viewed/i)
  await db.preview.create({ data: { token: randomUUID().replace(/-/g, ''), clientId, scopeVersion: 1, version: 2, status: 'GENERATED', html: '<html></html>' } })
  // A newer unsent version cannot inherit delivery evidence from an older preview.
  await assert.rejects(() => requirePreviewBeforePayment(clientId), /dispatched and viewed/i)
})
