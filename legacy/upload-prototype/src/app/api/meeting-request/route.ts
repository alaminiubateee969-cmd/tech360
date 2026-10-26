import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, company, email, whatsapp, businessType, projectType,
      preferredDate, preferredTime, timezone, message,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let visitorId = cookieStore.get('tech360_vid')?.value;
    let visitor = null;
    if (visitorId) {
      visitor = await db.visitor.findUnique({ where: { visitorId } });
    }

    const count = await db.meetingRequest.count();
    const meetingId = `MTG-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

    const meeting = await db.meetingRequest.create({
      data: {
        meetingId,
        visitorId: visitor?.visitorId || null,
        name, company: company || null, email,
        whatsapp: whatsapp || null,
        businessType: businessType || null,
        projectType: projectType || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTime: preferredTime || null,
        timezone: timezone || 'UTC',
        message: message || null,
        utmSource: visitor?.utmSource || null,
        utmCampaign: visitor?.utmCampaign || null,
        consentStatus: visitor?.consentStatus || 'pending',
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || null,
        userAgent: (req.headers.get('user-agent') || '').substring(0, 255),
        status: 'requested',
      },
    });

    if (visitor) {
      await db.visitor.update({
        where: { id: visitor.id },
        data: { meetingRequest: true },
      });
    }

    return NextResponse.json({
      success: true,
      meetingId: meeting.meetingId,
      message: `Meeting request received! Meeting ID: ${meeting.meetingId}. We will confirm your preferred time via email within 24 business hours.`,
    });
  } catch (error) {
    console.error('Meeting request error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
