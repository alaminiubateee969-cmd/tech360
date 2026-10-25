import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, properties } = body;

    if (!event) {
      return NextResponse.json({ error: 'Event name required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let visitorId = cookieStore.get('tech360_vid')?.value;

    if (!visitorId) {
      visitorId = 'vid_' + crypto.randomBytes(16).toString('hex');
    }

    const referrer = req.headers.get('referer') || '';
    const referrerHost = referrer ? new URL(referrer).hostname.toLowerCase() : '';
    let source = 'Direct';
    if (referrerHost.includes('facebook.com') || referrerHost.includes('instagram.com')) source = 'Facebook';
    else if (referrerHost.includes('linkedin.com')) source = 'LinkedIn';
    else if (referrerHost.includes('google.')) source = 'Google';
    else if (referrerHost.includes('youtube.com')) source = 'YouTube';
    else if (referrerHost.includes('whatsapp.com')) source = 'WhatsApp';
    else if (referrer && !referrerHost.includes('bdtech360.com')) source = 'Referral';

    let visitor = await db.visitor.findUnique({ where: { visitorId } });
    if (!visitor) {
      visitor = await db.visitor.create({
        data: {
          visitorId,
          sessionId: crypto.randomBytes(16).toString('hex'),
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          landingPage: req.nextUrl.pathname,
          referrer: referrer || null,
          firstTouchSource: source,
          lastTouchSource: source,
          pageViews: event === 'page_view' ? 1 : 0,
          whatsappClicks: event === 'whatsapp_click' ? 1 : 0,
          consentStatus: 'pending',
        },
      });
    } else {
      const updates: Record<string, unknown> = { lastSeenAt: new Date(), lastTouchSource: source };
      if (event === 'page_view') updates.pageViews = (visitor.pageViews || 0) + 1;
      if (event === 'service_view') updates.serviceViews = (visitor.serviceViews || 0) + 1;
      if (event === 'case_study_view') updates.caseStudyViews = (visitor.caseStudyViews || 0) + 1;
      if (event === 'whatsapp_click') updates.whatsappClicks = (visitor.whatsappClicks || 0) + 1;
      if (event === 'project_brief_start') updates.projectBriefStarted = true;
      if (event === 'project_brief_submit') updates.projectBriefSubmitted = true;
      if (event === 'meeting_request') updates.meetingRequest = true;
      visitor = await db.visitor.update({ where: { id: visitor.id }, data: updates });
    }

    await db.marketingEvent.create({
      data: {
        visitorId: visitor.visitorId,
        sessionId: visitor.sessionId || null,
        eventName: event,
        page: properties?.page || req.nextUrl.pathname,
        service: properties?.service || null,
        industry: properties?.industry || null,
        projectType: properties?.projectType || null,
        utmSource: visitor.utmSource,
        utmCampaign: visitor.utmCampaign,
        consentStatus: visitor.consentStatus,
      },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('tech360_vid', visitorId, {
      maxAge: 525600 * 60, httpOnly: true,
      secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    });
    return response;
  } catch (error) {
    console.error('Track error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
