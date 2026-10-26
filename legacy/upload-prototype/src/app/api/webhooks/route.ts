import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns registered webhooks for the Automation Hub.
export async function GET() {
  const webhooks = await db.webhook.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ webhooks });
}
