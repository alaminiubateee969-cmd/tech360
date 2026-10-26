import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, company, businessType, projectType, email, whatsapp,
      currentWebsite, projectDescription, requiredFeatures,
      expectedTimeline, referenceWebsite,
    } = body;

    if (!name || !email || !projectDescription) {
      return NextResponse.json({ error: 'Name, email, and project description are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let visitorId = cookieStore.get('tech360_vid')?.value;

    // Get visitor data for attribution
    let visitor = null;
    if (visitorId) {
      visitor = await db.visitor.findUnique({ where: { visitorId } });
    }

    // Generate brief ID
    const count = await db.projectBrief.count();
    const briefId = `BRF-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const brief = await db.projectBrief.create({
      data: {
        briefId,
        visitorId: visitor?.visitorId || null,
        name, company: company || null,
        businessType: businessType || null,
        projectType: projectType || null,
        email, whatsapp: whatsapp || null,
        currentWebsite: currentWebsite || null,
        projectDescription,
        requiredFeatures: requiredFeatures || null,
        expectedTimeline: expectedTimeline || null,
        referenceWebsite: referenceWebsite || null,
        firstTouchSource: visitor?.firstTouchSource || null,
        lastTouchSource: visitor?.lastTouchSource || null,
        utmSource: visitor?.utmSource || null,
        utmMedium: visitor?.utmMedium || null,
        utmCampaign: visitor?.utmCampaign || null,
        utmContent: visitor?.utmContent || null,
        utmTerm: visitor?.utmTerm || null,
        landingPage: visitor?.landingPage || null,
        referrer: visitor?.referrer || null,
        consentStatus: visitor?.consentStatus || 'pending',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
        userAgent: (req.headers.get('user-agent') || '').substring(0, 255),
        status: 'new',
      },
    });

    // Update visitor
    if (visitor) {
      await db.visitor.update({
        where: { id: visitor.id },
        data: { projectBriefSubmitted: true },
      });
    }

    // Track marketing event
    await db.marketingEvent.create({
      data: {
        visitorId: visitor?.visitorId || 'anonymous',
        sessionId: visitor?.sessionId || null,
        eventName: 'project_brief_submit',
        page: '/project-brief',
        projectType: projectType || null,
        utmSource: visitor?.utmSource || null,
        utmCampaign: visitor?.utmCampaign || null,
        consentStatus: visitor?.consentStatus || 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      briefId: brief.briefId,
      message: `Thank you! Your project brief has been received. Brief ID: ${brief.briefId}. We will respond within 24 business hours.`,
    });
  } catch (error) {
    console.error('Project brief error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
