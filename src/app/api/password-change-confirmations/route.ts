import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/password-change-confirmations
 * Create a password change confirmation record at handover time.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.TECH360_API_KEY;
  const apiKeyOk = !!expectedKey && !!apiKey && apiKey === expectedKey;

  if (!apiKeyOk) {
    const auth = await requireRole(["SUPER_ADMIN", "MANAGER", "STAFF"], req);
    if (!auth.ok) return auth.response;
  }

  try {
    const body = await req.json();
    const { clientId, projectHandoverId, notes } = body as {
      clientId?: string;
      projectHandoverId?: string;
      notes?: string;
    };

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId required" },
        { status: 400 }
      );
    }

    const confirmation = await db.passwordChangeConfirmation.create({
      data: {
        clientId,
        projectHandoverId: projectHandoverId ?? null,
        confirmed: false,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ confirmation }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/password-change-confirmations
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "MANAGER", "STAFF"], req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;

  const confirmations = await db.passwordChangeConfirmation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ confirmations });
}
