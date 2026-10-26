import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTrackToken } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

const FALLBACK_URL = 'https://bdtech360.com'

// ------------------------------------------------------------
// GET /api/newsletter/track/click?c=<campaignId>&u=<token>&to=<url>
//
// The click redirect for every link in a sent campaign (email-marketing
// parity: knsoftic/Email_Markting). Records a REAL CampaignEvent row,
// then 302-redirects to the destination. Only http(s) destinations are
// honoured — anything else (javascript:, data:, relative paths) falls
// back to the public site, so the redirect can never be abused as an
// open redirect. Repeated identical clicks by the same subscriber are
// deduplicated to keep the evidence table bounded and the unique-click
// number honest.
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('c') ?? ''
  const token = req.nextUrl.searchParams.get('u')
  const to = req.nextUrl.searchParams.get('to') ?? ''
  const email = verifyTrackToken(token, campaignId)

  const safeDestination = /^https?:\/\//i.test(to) ? to : FALLBACK_URL

  try {
    if (campaignId) {
      const campaign = await db.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true },
      })
      if (campaign) {
        const existing = await db.campaignEvent.findFirst({
          where: { campaignId, kind: 'CLICK', email: email ?? null, targetUrl: to.slice(0, 2000) },
          select: { id: true },
        })
        if (!existing) {
          await db.campaignEvent.create({
            data: {
              campaignId,
              kind: 'CLICK',
              email: email ?? null,
              targetUrl: to.slice(0, 2000),
              userAgent: (req.headers.get('user-agent') ?? '').slice(0, 500) || null,
              ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 64) ?? null,
            },
          })
        }
      }
    }
  } catch {
    // never trap the recipient on an error page because tracking failed
  }

  return NextResponse.redirect(safeDestination, 302)
}
