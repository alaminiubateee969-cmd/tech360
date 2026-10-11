import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { parseHandoverManifest } from '@/lib/handover-artifacts'
import {
  detectBusiness, recommendPlan, askScopeQuestions, submitScope, generatePreview,
  requestPayment, recordPayment, verifyPayment, activateProject, prepareHandover,
  closeProject, clientScopeDecision, requestReviewAndReferral,
} from '@/lib/journey'

export const dynamic = 'force-dynamic'

// Manual journey advancement from the admin console — same real engine as automation
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g

  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const action = sanitizeText(raw.action, 40).toUpperCase()
  const payload = (raw.payload ?? {}) as Record<string, unknown>

  const client = await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } })
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 })

  try {
    let result: Record<string, unknown> | null = null
    let message = ''
    switch (action) {
      case 'DETECT_BUSINESS':
        const r1 = await detectBusiness(client.id, sanitizeText(payload.message, 4000))
        result = r1 as unknown as Record<string, unknown>
        message = r1.ok ? `Business detected: ${r1.json?.businessType ?? 'see output'}` : `Detection failed: ${r1.error}`
        break
      case 'RECOMMEND_PLAN':
        const r2 = await recommendPlan(client.id)
        result = r2 as unknown as Record<string, unknown>
        message = r2.ok ? `Plan recommended: ${r2.json?.plan ?? 'see output'}` : `Recommendation failed: ${r2.error}`
        break
      case 'ASK_SCOPE_QUESTIONS':
        const r3 = await askScopeQuestions(client.id)
        result = r3 as unknown as Record<string, unknown>
        message = r3.run.ok ? `Scope questions generated. Delivery: ${(r3.delivery || []).join(', ')}` : `Failed: ${r3.run.error}`
        break
      case 'SUBMIT_SCOPE': {
        const text = sanitizeText(payload.text ?? payload.scopeText ?? payload.scope, 12000)
        if (text.length < 10) return Response.json({ error: 'Scope text required' }, { status: 400 })
        const r4 = await submitScope(client.id, text)
        result = r4 as unknown as Record<string, unknown>
        message = r4.forge.ok && r4.scopeId ? 'Draft Scope of Work generated and queued for admin approval.' : `Scope generation failed: ${r4.forge.error}`
        break
      }
      case 'CLIENT_SCOPE_DECISION': {
        const decision = sanitizeText(payload.decision, 40).toUpperCase() as 'APPROVED' | 'REVISION_REQUESTED' | 'CLARIFICATION_REQUESTED'
        const r5 = await clientScopeDecision(client.id, decision || 'APPROVED', sanitizeText(payload.notes, 4000))
        result = r5 as unknown as Record<string, unknown>
        message = `Client decision recorded. Next: ${r5.next}`
        break
      }
      case 'GENERATE_PREVIEW': {
        const r6 = await generatePreview(client.id)
        result = r6 as unknown as Record<string, unknown>
        const delivery = r6.delivery.length ? r6.delivery.map((item) => `${item.channel}:${item.status}`).join(', ') : 'NO_CHANNEL_ATTEMPTED'
        message = r6.reused
          ? `Existing preview reused; no duplicate provider sends were attempted. Current status: ${r6.status}. Link: ${r6.link}`
          : r6.status === 'SENT'
            ? `Preview generated; at least one provider accepted the send request. Channel status: ${delivery}. Link: ${r6.link}`
            : `Preview generated but not sent. Channel status: ${delivery}. Share only through an authorized channel. Link: ${r6.link}`
        break
      }
      case 'REQUEST_PAYMENT':
        const r7 = await requestPayment(client.id, g.user.email)
        result = r7 as unknown as Record<string, unknown>
        message = `Payment requested. Delivery: ${(r7.results ?? []).join(', ')}`
        break
      case 'RECORD_PAYMENT': {
        const amount = Number(payload.amount)
        if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Valid amount required' }, { status: 400 })
        const r8 = await recordPayment(client.id, {
          amount, currency: sanitizeText(payload.currency, 8) || 'USD', method: sanitizeText(payload.method, 40),
          transactionId: sanitizeText(payload.transactionId, 80), milestone: sanitizeText(payload.milestone, 60),
          notes: sanitizeText(payload.notes, 2000),
        })
        result = r8 as unknown as Record<string, unknown>
        message = 'Payment recorded with PENDING status. Verify it to activate gates.'
        break
      }
      case 'VERIFY_PAYMENT': {
        const paymentId = sanitizeText(payload.paymentId, 40)
        if (!paymentId) return Response.json({ error: 'paymentId required' }, { status: 400 })
        const r9 = await verifyPayment(paymentId, g.user.id)
        result = r9 as unknown as Record<string, unknown>
        message = 'Payment verified. Project activated if this was the first verified payment.'
        break
      }
      case 'START_PROJECT': {
        const r10 = await activateProject(client.id, sanitizeText(payload.projectId, 40) || undefined)
        result = r10 as unknown as Record<string, unknown>
        const projectCode = r10.project.code
        message = r10.taskRun?.ok && r10.taskCount > 0
          ? `Project ${projectCode} activated; ${r10.taskCount} project task(s) are persisted. Verify the breakdown before assigning work.`
          : r10.taskRun
            ? `Project ${projectCode} activated, but task generation did not produce a persisted breakdown. No AI-generated task completion is being claimed.`
            : `Project ${projectCode} activated; ${r10.taskCount} existing task(s) were retained without duplication.`
        break
      }
      case 'PREPARE_HANDOVER': {
        const projectId = sanitizeText(payload.projectId, 40) || (await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }))?.id
        if (!projectId) return Response.json({ error: 'No project found for client' }, { status: 400 })
        const r11 = await prepareHandover(client.id, projectId, g.user.email)
        if (r11.blocked) {
          result = { blocked: true, reason: r11.reason }
          message = `BLOCKED: ${r11.reason}`
        } else {
          const manifest = parseHandoverManifest(r11.handover.contents, projectId)
          result = {
            blocked: false,
            reused: 'reused' in r11 && r11.reused === true,
            handover: { id: r11.handover.id, status: r11.handover.status, projectId: r11.handover.projectId, expiryAt: r11.handover.expiryAt },
            artifactCount: manifest?.files.length ?? 0,
          }
          message = 'reused' in r11 && r11.reused
            ? `Existing handover record (${r11.handover.status}) reused; no new approval request was created.`
            : 'Verified artifact manifest prepared and queued for Super Admin approval.'
        }
        break
      }
      case 'RELEASE_HANDOVER': {
        return Response.json({ error: 'Handover release must be executed through the pending Super Admin approval request.' }, { status: 403 })
      }
      case 'CLOSE_PROJECT': {
        const projectId = sanitizeText(payload.projectId, 40) || (await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }))?.id
        if (!projectId) return Response.json({ error: 'No project found' }, { status: 400 })
        const r13 = await closeProject(projectId, g.user.email)
        result = r13 as unknown as Record<string, unknown>
        message = 'Project closed and completed.'
        break
      }
      case 'REQUEST_REVIEW': {
        const r14 = await requestReviewAndReferral(client.id)
        result = r14 as unknown as Record<string, unknown>
        message = 'Review + referral requested. Real Review/Referral records created; client submits via portal, admin moderates.'
        break
      }
      case 'REQUEST_REFERRAL': {
        const r15 = await requestReviewAndReferral(client.id)
        result = r15 as unknown as Record<string, unknown>
        message = 'Referral requested. Client can submit a referral from the portal.'
        break
      }
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
    await audit({ actor: g.user.email, action: `JOURNEY_${action}`, userId: g.user.id, clientId: client.clientId, details: { action } })
    return Response.json({ ok: true, action, result, message })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return Response.json({ ok: false, error: msg, message: `Action failed: ${msg}` }, { status: 500 })
  }
}
