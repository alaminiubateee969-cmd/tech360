import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TRACKING_PIXEL_GIF, verifyTrackToken } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/newsletter/track/open?c=<campaignId>&u=<signed token>
//
// The 1×1 open pixel embedded in every sent campaign (email-marketing
// parity: mohamed11sk/Email-markting). Writes ONE real CampaignEvent
// row per campaign+subscriber (duplicate opens are not re-recorded),
// then always answers with the transparent GIF — a tracking pixel must
// never break email rendering. Unattributable opens (missing/invalid
// token) are recorded with a null email and counted once as anonymous.
// No event is ever written for a campaign that does not exist.
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('c') ?? ''
  const token = req.nextUrl.searchParams.get('u')
  const email = verifyTrackToken(token, campaignId)

  try {
    if (campaignId) {
      const campaign = await db.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, status: true },
      })
      if (campaign) {
        const existing = await db.campaignEvent.findFirst({
          where: { campaignId, kind: 'OPEN', email: email ?? null },
          select: { id: true },
        })
        if (!existing) {
          await db.campaignEvent.create({
            data: {
              campaignId,
              kind: 'OPEN',
              email: email ?? null,
              userAgent: (req.headers.get('user-agent') ?? '').slice(0, 500) || null,
              ip: null, // deliberately not stored for opens — attribution does not need it
            },
          })
        }
      }
    }
  } catch {
    // a broken pixel must never surface an error to the recipient
  }

  return new NextResponse(TRACKING_PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  })
}
