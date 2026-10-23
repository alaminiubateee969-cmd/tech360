import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { sendCommunication, wrapEmailHtml, emailTemplate } from '@/lib/comms'
import {
  GovernanceDeniedError,
  ensureGovernedApproval,
  executeGoverned,
  findApprovedGovernedApproval,
} from '@/lib/governance/enforce'
import { classifyOutbound, outboundContentHash, recipientHash } from '@/lib/governance/outbound'

export const dynamic = 'force-dynamic'

// Manual message send from admin console — uses the real channel adapters
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const clientRef = sanitizeText(raw.clientId, 40)
  const channel = sanitizeText(raw.channel, 20).toUpperCase()
  const body = sanitizeText(raw.body, 8000)
  const subject = sanitizeText(raw.subject, 300)
  const to = sanitizeText(raw.to, 200)

  if (!['WHATSAPP', 'EMAIL', 'SMS'].includes(channel)) {
    return Response.json({ error: 'channel must be WHATSAPP, EMAIL or SMS' }, { status: 400 })
  }
  if (body.length < 1) return Response.json({ error: 'Message body required' }, { status: 400 })

  const client = clientRef ? await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } }) : null
  if (!client && !to) return Response.json({ error: 'Client or direct recipient required' }, { status: 400 })

  const recipient = to || (channel === 'EMAIL' ? client?.email : client?.whatsapp) || ''
  if (!recipient) return Response.json({ error: `No ${channel === 'EMAIL' ? 'email' : 'phone'} on record for this client` }, { status: 400 })

  // Consequential content (payment instruction, invoice, legal or refund
  // response, handover link, dispute, or any monetary amount) needs a Super
  // Admin approval bound to THIS channel, recipient and wording. There is no
  // privilege-based bypass: a Super Admin who sends consequential content
  // still needs an independent approval. Routine messages are unaffected.
  const policy = classifyOutbound(body, subject)
  let consumedApprovalId: string | undefined
  if (policy.consequential) {
    const resourceKey = `comm:${outboundContentHash({ channel, to: recipient, subject: subject || null, body })}`
    const approvalId = sanitizeText(raw.approvalId, 40) || (await findApprovedGovernedApproval('communication.send', resourceKey))
    try {
      // Consume the approval BEFORE dispatch. If the send then fails or times
      // out, the approval stays spent and nothing re-sends automatically. The
      // operator must request a new approval, so a duplicate cannot be created.
      await executeGoverned(
        {
          action: 'communication.send',
          actor: { type: 'HUMAN', id: g.user.id, role: g.user.role },
          resourceKey,
          approvalId,
          clientId: client?.id ?? null,
        },
        async () => ({}),
      )
      consumedApprovalId = approvalId ?? undefined
    } catch (error) {
      if (error instanceof GovernanceDeniedError && error.code === 'APPROVAL_REQUIRED') {
        const pendingId = await ensureGovernedApproval({
          action: 'communication.send',
          requestedBy: g.user.id,
          resourceKey,
          clientId: client?.id ?? null,
          title: `Send ${channel} message${client ? ` to ${client.clientId}` : ''}`,
          description: 'This message contains consequential content, so a Super Admin must approve this exact message before it is sent.',
          extraPayload: { channel, recipientHash: recipientHash(recipient), categories: policy.categories, carriesAmount: policy.carriesAmount },
        })
        await audit({ actor: g.user.email, action: 'MANUAL_MESSAGE_GATED', userId: g.user.id, clientId: client?.clientId, details: { channel, categories: policy.categories, carriesAmount: policy.carriesAmount, approvalId: pendingId } })
        return Response.json({
          ok: false,
          status: 'ADMIN_APPROVAL_REQUIRED',
          approvalId: pendingId,
          error: 'This message needs a Super Admin approval before it can be sent. The approval has been requested; nothing was sent.',
          categories: policy.categories,
          carriesAmount: policy.carriesAmount,
          message: 'Not sent. A Super Admin approval for this exact message has been requested.',
        }, { status: 409 })
      }
      if (error instanceof GovernanceDeniedError) {
        return Response.json({ ok: false, status: 'GOVERNANCE_DENIED', code: error.code, error: 'This message was refused by governance. Nothing was sent.' }, { status: 409 })
      }
      throw error
    }
  }

  const { communicationId, result } = await sendCommunication({
    clientId: client?.id, channel, to: recipient, subject: subject || (channel === 'EMAIL' ? 'Message from Tech360' : undefined),
    body, agentCode: 'MANUAL',
    approvalId: consumedApprovalId,
  })
  await audit({ actor: g.user.email, action: 'MANUAL_MESSAGE_SENT', userId: g.user.id, clientId: client?.clientId, details: { channel, recipient, status: result.status, consequential: policy.consequential, categories: policy.categories } })

  const statusText = result.status === 'SENT' ? 'sent successfully' : result.status === 'NOT_CONFIGURED' ? 'not sent — channel not configured' : `failed: ${result.error}`
  return Response.json({
    ok: result.status === 'SENT',
    status: result.status,
    error: result.error ?? null,
    message: `Message ${statusText}. Recorded in CRM.`,
    communicationId,
  })
}
