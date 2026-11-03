import { NextRequest } from 'next/server'
import { DOCUMENT_SECURITY_HEADERS, isInlineSafeMime } from '@/lib/files'
import { readFile, uploadFile } from '@/lib/factory/control/data'
import { guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const result = await readFile(g.actor, text(url.searchParams.get('companyId'), 60), text(url.searchParams.get('fileId'), 60))
  if (!result.ok || !result.data) return noStore({ ok: false, reason: result.reason, code: result.code }, 403)
  const { file } = result.data
  if (url.searchParams.get('download') === '1') {
    const bytes = Buffer.from(file.content, 'base64')
    return new Response(new Uint8Array(bytes), { headers: {
      ...DOCUMENT_SECURITY_HEADERS,
      'Content-Type': file.mimeType,
      'Content-Disposition': `${isInlineSafeMime(file.mimeType) ? 'inline' : 'attachment'}; filename="${file.name.replace(/["\r\n]/g, '')}"`,
      'Cache-Control': 'no-store',
    } })
  }
  return noStore({ ok: true, file: { id: file.id, name: file.name, mimeType: file.mimeType, checksum: file.checksum } })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req, 'STAFF')
  if (guardFailed(g)) return g
  const result = await uploadFile(g.actor, await readBody(req))
  return noStore(result as unknown as Record<string, unknown>, result.ok ? 201 : 403)
}
