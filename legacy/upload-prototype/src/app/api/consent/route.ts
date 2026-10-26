import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { status, categories } = body;

    if (!['granted', 'denied', 'revoked'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const cookieStore = await cookies();
    let visitorId = cookieStore.get('tech360_vid')?.value;
    if (!visitorId) {
      visitorId = 'vid_' + crypto.randomBytes(16).toString('hex');
    }

    let visitor = await db.visitor.findUnique({ where: { visitorId } });
    if (!visitor) {
      visitor = await db.visitor.create({
        data: {
          visitorId,
          sessionId: crypto.randomBytes(16).toString('hex'),
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          consentStatus: status,
          consentAt: new Date(),
          pageViews: 0, whatsappClicks: 0,
        },
      });
    } else {
      visitor = await db.visitor.update({
        where: { id: visitor.id },
        data: { consentStatus: status, consentAt: new Date() },
      });
    }

    // Anonymize IP (last octet zeroed for IPv4)
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '';
    let anonymizedIp = rawIp;
    if (rawIp && /^\d+\.\d+\.\d+\.\d+$/.test(rawIp)) {
      const parts = rawIp.split('.');
      parts[3] = '0';
      anonymizedIp = parts.join('.');
    } else if (rawIp && rawIp.includes(':')) {
      anonymizedIp = 'ipv6_' + crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 16);
    }

    await db.consentRecord.create({
      data: {
        visitorId: visitor.visitorId,
        consentStatus: status,
        consentVersion: '1.0',
        categories: JSON.stringify(categories || ['necessary']),
        ipAddress: anonymizedIp,
        userAgent: (req.headers.get('user-agent') || '').substring(0, 255),
        consentAt: new Date(),
      },
    });

    const response = NextResponse.json({ success: true, status });
    response.cookies.set('tech360_vid', visitorId, {
      maxAge: 525600 * 60, httpOnly: true,
      secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    });
    return response;
  } catch (error) {
    console.error('Consent error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
