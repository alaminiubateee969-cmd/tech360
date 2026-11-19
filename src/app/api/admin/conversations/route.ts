import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { AI_CHAT_ANON_PREFIX } from '@/lib/chat'
import { tenantOf } from '@/lib/tenancy'
import { INBOX_VIEWS, inboxViewWhere, isPriority, isTeam, parseInboxView } from '@/lib/webchat/policy'

export const dynamic = 'force-dynamic'

// ADMIN — operator inbox list (latest 100 by activity), tenant-scoped.
// ?view=ALL|UNASSIGNED|MINE|ASSIGNED|OPEN|PENDING|ESCALATED|RESOLVED
// ?status=OPEN|CLOSED (visitor session; legacy filter, still supported)
// ?q=search (visitor name/email/phone, subject, preview, Client ID)
// ?priority=… ?team=…
// View counts are always included so the UI shows live queue sizes.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF', capability: 'crm.read' })
  if (isResponse(g)) return g

  const tenantId = tenantOf(g.user as typeof g.user & { tenantId?: string })
  const url = new URL(req.url)
  const view = parseInboxView(url.searchParams.get('view'))
  const statusParam = sanitizeText(url.searchParams.get('status') ?? '', 20).toUpperCase()
  const q = sanitizeText(url.searchParams.get('q') ?? '', 100)
  const priority = sanitizeText(url.searchParams.get('priority') ?? '', 10).toUpperCase()
  const team = sanitizeText(url.searchParams.get('team') ?? '', 20).toUpperCase()

  // The console's own AI conversations live in the same table under a
  // namespaced anon id. They are NOT visitor conversations, so they are
  // excluded from the live-chat inbox and from its counts.
  const base = { tenantId, anonId: { not: { startsWith: AI_CHAT_ANON_PREFIX } } }

  let searchClientRowIds: string[] = []
  if (q) {
    const matches = await db.client.findMany({
      where: { OR: [{ clientId: { contains: q } }, { name: { contains: q } }, { email: { contains: q } }] },
      select: { id: true },
      take: 50,
    })
    searchClientRowIds = matches.map((m) => m.id)
  }
  const searchWhere = q
    ? {
        OR: [
          { visitorName: { contains: q } },
          { visitorEmail: { contains: q } },
          { visitorPhone: { contains: q } },
          { subject: { contains: q } },
          { lastMessagePreview: { contains: q } },
          ...(searchClientRowIds.length ? [{ clientId: { in: searchClientRowIds } }] : []),
        ],
      }
    : {}
  const where = {
    ...base,
    ...inboxViewWhere(view, g.user.id),
    ...(statusParam === 'OPEN' || statusParam === 'CLOSED' ? { status: statusParam } : {}),
    ...(isPriority(priority) ? { priority } : {}),
    ...(isTeam(team) ? { team } : {}),
    ...searchWhere,
  }

  const [conversations, openCount, closedCount, ...viewCounts] = await Promise.all([
    db.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { _count: { select: { messages: true } } },
    }),
    db.chatConversation.count({ where: { ...base, status: 'OPEN' } }),
    db.chatConversation.count({ where: { ...base, status: 'CLOSED' } }),
    ...INBOX_VIEWS.map((v) => db.chatConversation.count({ where: { ...base, ...inboxViewWhere(v, g.user.id) } })),
  ])

  // agentEmail of the last human admin reply per conversation (single grouped query)
  const ids = conversations.map((c) => c.id)
  const adminMessages = ids.length
    ? await db.chatMessage.findMany({
        where: { conversationId: { in: ids }, sender: 'ADMIN', internal: false, aiGenerated: false },
        orderBy: { createdAt: 'asc' },
        select: { conversationId: true, agentEmail: true },
      })
    : []
  const lastAgentByConversation = new Map<string, string>()
  for (const m of adminMessages) {
    if (m.agentEmail) lastAgentByConversation.set(m.conversationId, m.agentEmail)
  }

  // Permanent Client ID per conversation (follow the merge pointer so the
  // inbox never shows an identity that was merged away).
  const clientRowIds = [...new Set(conversations.map((c) => c.clientId).filter((id): id is string => Boolean(id)))]
  const clientRows = clientRowIds.length
    ? await db.client.findMany({
        where: { id: { in: clientRowIds } },
        select: { id: true, clientId: true, mergedIntoId: true, deletedAt: true },
      })
    : []
  const mergedTargets = clientRows.map((c) => c.mergedIntoId).filter((id): id is string => Boolean(id))
  const mergedRows = mergedTargets.length
    ? await db.client.findMany({ where: { id: { in: mergedTargets } }, select: { id: true, clientId: true } })
    : []
  const mergedNameById = new Map(mergedRows.map((c) => [c.id, c.clientId]))
  const displayClientIdByRowId = new Map(
    clientRows.map((c) => [
      c.id,
      c.deletedAt ? null : c.mergedIntoId ? (mergedNameById.get(c.mergedIntoId) ?? null) : c.clientId,
    ]),
  )

  return Response.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      anonId: c.anonId,
      clientId: c.clientId ? (displayClientIdByRowId.get(c.clientId) ?? null) : null,
      status: c.status,
      inboxState: c.inboxState,
      priority: c.priority,
      team: c.team,
      assignedToId: c.assignedToId,
      assignedToEmail: c.assignedToEmail,
      humanRequested: Boolean(c.humanRequestedAt),
      aiIntent: c.aiIntent,
      aiLanguage: c.aiLanguage,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      visitorPhone: c.visitorPhone,
      subject: c.subject,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
      lastSender: c.lastSender,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      lastAgentEmail: lastAgentByConversation.get(c.id) ?? null,
    })),
    counts: { OPEN: openCount, CLOSED: closedCount },
    viewCounts: Object.fromEntries(INBOX_VIEWS.map((v, i) => [v, viewCounts[i]])),
    view,
  })
}
