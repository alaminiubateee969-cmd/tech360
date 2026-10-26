import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

type MetaTemplate = {
  id: string
  name: string
  status: string
  category?: string
  language?: string
  components?: unknown[]
  rejected_reason?: string
}

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'STAFF' })
  if (isResponse(g)) return g

  const token = process.env.WHATSAPP_TOKEN
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  const version = (process.env.META_GRAPH_API_VERSION ?? 'v26.0').replace(/^v?/, 'v')

  if (!token || !wabaId) {
    return Response.json({
      configured: false,
      templates: [],
      message: 'Set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID in the server environment to read Meta-approved templates.',
    })
  }

  try {
    const endpoint = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(wabaId)}/message_templates`)
    endpoint.searchParams.set('fields', 'id,name,status,category,language,components,rejected_reason')
    endpoint.searchParams.set('limit', '100')
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const payload = await response.json().catch(() => ({})) as {
      data?: MetaTemplate[]
      error?: { message?: string; code?: number; type?: string }
      paging?: { next?: string }
    }

    if (!response.ok) {
      return Response.json({
        configured: true,
        templates: [],
        error: 'Meta template request failed',
        providerStatus: response.status,
        providerCode: payload.error?.code ?? null,
        message: payload.error?.message ?? 'Meta did not return template data. Check token permissions and WABA ID.',
      }, { status: response.status === 401 || response.status === 403 ? 502 : 502 })
    }

    return Response.json({
      configured: true,
      templates: (payload.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        category: item.category ?? null,
        language: item.language ?? null,
        components: item.components ?? [],
        rejectedReason: item.rejected_reason ?? null,
      })),
      hasMore: Boolean(payload.paging?.next),
      note: 'Template statuses come directly from Meta. This endpoint does not create or send templates.',
    })
  } catch {
    return Response.json({ configured: true, templates: [], error: 'Unable to reach Meta template API' }, { status: 502 })
  }
}
