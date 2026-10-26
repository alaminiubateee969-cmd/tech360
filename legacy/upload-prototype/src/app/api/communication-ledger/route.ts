import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","ADMIN","PROJECT_MANAGER","SALES","SUPPORT"], req);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const where = clientId ? { clientId } : {};
  const entries = await db.communicationLedger.findMany({ where, take: 100, orderBy: { timestamp: "desc" } });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","ADMIN","PROJECT_MANAGER","SALES","SUPPORT"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const count = await db.communicationLedger.count();
  const ledgerId = `LEDGER-2026-${String(count + 1).padStart(6, "0")}`;
  const entry = await db.communicationLedger.create({
    data: {
      ledgerId,
      clientId: body.clientId || null,
      projectId: body.projectId || null,
      channel: body.channel,
      direction: body.direction || "INBOUND",
      sender: body.sender || null,
      recipient: body.recipient || null,
      messageBody: body.messageBody || "",
      attachmentIds: JSON.stringify(body.attachments || []),
      deliveryStatus: body.deliveryStatus || "DELIVERED",
      sourceMessageId: body.sourceMessageId || null,
      staffUserId: auth.session.user.id,
      aiClassification: body.aiClassification || null,
      nextAction: body.nextAction || null,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
