import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Channel, Direction } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/communications
 * Create a communication record.
 *
 * Public with X-API-Key OR authenticated CRM user.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.TECH360_API_KEY;
  const apiKeyOk = !!expectedKey && !!apiKey && apiKey === expectedKey;

  if (!apiKeyOk) {
    const auth = await requireRole(
      ["SUPER_ADMIN", "MANAGER", "AGENT", "STAFF"],
      req
    );
    if (!auth.ok) return auth.response;
  }

  try {
    const body = await req.json();
    const {
      leadId,
      clientId,
      projectId,
      direction = "INBOUND",
      channel = "WHATSAPP",
      subject,
      body: bodyText,
      fromName,
      fromEmail,
      fromNumber,
    } = body as {
      leadId?: string;
      clientId?: string;
      projectId?: string;
      direction?: string;
      channel?: string;
      subject?: string;
      body?: string;
      fromName?: string;
      fromEmail?: string;
      fromNumber?: string;
    };

    const validChannels: Channel[] = [
      "EMAIL",
      "WHATSAPP",
      "CALL",
      "MEETING",
      "SOCIAL",
    ];
    const validDirections: Direction[] = ["INBOUND", "OUTBOUND"];

    const finalChannel = validChannels.includes(channel as Channel)
      ? (channel as Channel)
      : "WHATSAPP";
    const finalDirection = validDirections.includes(direction as Direction)
      ? (direction as Direction)
      : "INBOUND";

    // Try to attach to a lead automatically if email/phone matches
    let finalLeadId = leadId ?? null;
    if (!finalLeadId && (fromEmail || fromNumber)) {
      const matches = await db.lead.findMany({
        where: {
          OR: [
            ...(fromEmail ? [{ email: { contains: fromEmail } }] : []),
            ...(fromNumber ? [{ phone: { contains: fromNumber } }] : []),
          ],
        },
        take: 1,
        select: { id: true },
      });
      if (matches[0]) finalLeadId = matches[0].id;
    }

    // Build a human-readable subject from optional fields
    let finalSubject = subject ?? "";
    if (!finalSubject) {
      const parts: string[] = [];
      if (fromName) parts.push(`From: ${fromName}`);
      if (fromEmail) parts.push(`<${fromEmail}>`);
      if (fromNumber) parts.push(`(${fromNumber})`);
      finalSubject = parts.join(" ") || `${finalChannel} message`;
    }

    const comm = await db.communication.create({
      data: {
        leadId: finalLeadId,
        clientId: clientId ?? null,
        projectId: projectId ?? null,
        direction: finalDirection,
        channel: finalChannel,
        subject: finalSubject,
        body: bodyText ?? "",
      },
    });

    return NextResponse.json({ communication: comm }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/communications
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(
    ["SUPER_ADMIN", "MANAGER", "AGENT", "STAFF"],
    req
  );
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  const clientId = searchParams.get("clientId");
  const channel = searchParams.get("channel");
  const direction = searchParams.get("direction");

  const where: Record<string, unknown> = {};
  if (leadId) where.leadId = leadId;
  if (clientId) where.clientId = clientId;
  if (channel) where.channel = channel;
  if (direction) where.direction = direction;

  const communications = await db.communication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ communications });
}
