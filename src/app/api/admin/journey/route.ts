import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import {
  detectBusiness, recommendPlan, askScopeQuestions, submitScope, generatePreview,
  requestPayment, recordPayment, verifyPayment, activateProject, prepareHandover,
  releaseHandover, closeProject, clientScopeDecision,
} from '@/lib/journey'

export const dynamic = 'force-dynamic'

// Manual journey advancement from the admin console — same real engine as automation
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
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
        message = `Preview generated and sent (or logged). Link: ${r6.link}`
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
        message = `Project ${(r10.project as { code?: string } | undefined)?.code ?? ''} activated with AI task breakdown.`
        break
      }
      case 'PREPARE_HANDOVER': {
        const projectId = sanitizeText(payload.projectId, 40) || (await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }))?.id
        if (!projectId) return Response.json({ error: 'No project found for client' }, { status: 400 })
        const r11 = await prepareHandover(client.id, projectId, g.user.email)
        result = r11 as unknown as Record<string, unknown>
        message = r11.blocked ? `BLOCKED: ${r11.reason}` : 'Handover package prepared and queued for Super Admin approval.'
        break
      }
      case 'RELEASE_HANDOVER': {
        const handoverId = sanitizeText(payload.handoverId, 40)
        if (!handoverId) return Response.json({ error: 'handoverId required' }, { status: 400 })
        if (g.user.role !== 'SUPER_ADMIN') return Response.json({ error: 'Only Super Admin can release source code' }, { status: 403 })
        const r12 = await releaseHandover(handoverId, g.user.id)
        result = r12 as unknown as Record<string, unknown>
        message = `Source package released. Secure link: ${r12.link}`
        break
      }
      case 'CLOSE_PROJECT': {
        const projectId = sanitizeText(payload.projectId, 40) || (await db.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }))?.id
        if (!projectId) return Response.json({ error: 'No project found' }, { status: 400 })
        const r13 = await closeProject(projectId, g.user.email)
        result = r13 as unknown as Record<string, unknown>
        message = 'Project closed and completed.'
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
