import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LeadSource, LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (status) where.status = status as LeadStatus;
  if (source) where.source = source as LeadSource;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { company: { contains: q } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, message } = body as {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      message?: string;
    };

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        company: company ?? null,
        message: message ?? null,
        source: "WEBSITE",
        status: "NEW",
        score: 50,
      },
    });

    await db.auditLog.create({
      data: {
        action: "lead.created",
        entityType: "lead",
        entityId: lead.id,
        metadata: JSON.stringify({ source: "website_form" }),
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
