import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

// GET /api/admin/official-docs — list private official documents (auth required)
// Super Admin / Admin only
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  return Response.json({
    ok: true,
    documents: [
      {
        filename: 'TECH360-Official-Info.pdf',
        title: 'Official Information Sheet',
        path: '/api/admin/official-docs/TECH360-Official-Info.pdf',
        access: 'SUPER_ADMIN, ADMIN only',
      },
      {
        filename: 'TECH360_Official_A4_Letterhead.pdf',
        title: 'Official A4 Letterhead (owner-issued pad)',
        path: '/api/admin/official-docs/TECH360_Official_A4_Letterhead.pdf',
        access: 'SUPER_ADMIN, ADMIN only',
      },
    ],
    note: 'Anonymous public access to /official/*.pdf has been removed (2026-11). Use this authenticated endpoint.',
  })
}
