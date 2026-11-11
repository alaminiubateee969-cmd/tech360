import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET the teardown in the format the caller needs:
 *   ?format=markdown  the full report (default)
 *   ?format=spoken    the script the voice surface reads aloud
 *   ?format=json      the report object
 *   ?format=evidence  the complete Evidence record
 *
 * Served from the stored teardown rather than recomputed, so re-reading a
 * teardown months later returns exactly what was concluded at capture time.
 * Re-analyzing is a new POST, which creates a new row — history is never
 * overwritten in place.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const target = await db.reaTarget.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!target) return Response.json({ error: 'REA target not found.' }, { status: 404 })

  if (target.status === 'REFUSED') {
    // A refused target has no teardown. Say so, with the reason, instead of
    // returning an empty document that could be mistaken for a clean result.
    return Response.json(
      {
        error: 'This target was refused at admission, so no teardown exists.',
        refusalCode: target.refusalCode,
        refusalReason: target.refusalReason,
      },
      { status: 422 },
    )
  }

  const format = sanitizeText(new URL(req.url).searchParams.get('format') ?? 'markdown', 16).toLowerCase()

  if (format === 'spoken') {
    return new Response(target.spoken ?? '', {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-evidence-id': target.evidenceId ?? '',
        'x-render-model': target.renderModel,
        'cache-control': 'no-store',
      },
    })
  }

  if (format === 'json') {
    return Response.json({ evidenceId: target.evidenceId, report: safeParse(target.teardown) })
  }

  if (format === 'evidence') {
    return Response.json(safeParse(target.evidence))
  }

  const filename = `teardown-${target.code}-${target.host.replace(/[^a-z0-9.-]/gi, '_')}.md`
  return new Response(target.markdown ?? '', {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `inline; filename="${filename}"`,
      'x-evidence-id': target.evidenceId ?? '',
      'cache-control': 'no-store',
    },
  })
}

function safeParse(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}
