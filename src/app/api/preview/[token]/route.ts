import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const preview = await db.preview.findUnique({ where: { token: clean } })
  if (!preview) {
    return new Response('<!doctype html><html><head><meta charset="utf-8"><title>Preview not found</title></head><body style="font-family:sans-serif;text-align:center;padding:80px 20px"><h1>Preview not found</h1><p>This preview link is invalid or has expired. Please contact info@bdtech360.com.</p></body></html>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  return new Response(preview.html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
