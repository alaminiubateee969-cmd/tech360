import { NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

const ALLOWED: Record<string, { privatePath: string; contentType: string }> = {
  'TECH360-Official-Info.pdf': { privatePath: 'private/official/TECH360-Official-Info.pdf', contentType: 'application/pdf' },
  'TECH360_Official_A4_Letterhead.pdf': { privatePath: 'private/official/TECH360_Official_A4_Letterhead.pdf', contentType: 'application/pdf' },
}

// GET /api/admin/official-docs/[filename] — serve private official PDFs (auth required)
// Anonymous or unauthorized returns 404 (hide existence) per spec §8
export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }
  const { filename } = await params
  const entry = ALLOWED[filename]
  if (!entry) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }
  try {
    const fullPath = join(process.cwd(), entry.privatePath)
    const bytes = await readFile(fullPath)
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': entry.contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': String(bytes.length),
      },
    })
  } catch {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }
}
