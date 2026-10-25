import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const settings = await db.setting.findMany(
    category ? { where: { category } } : undefined
  );
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    settings?: Array<{ key: string; value: string; category: string }>;
  };

  if (!body.settings || !Array.isArray(body.settings)) {
    return NextResponse.json({ error: "Expected settings array" }, { status: 400 });
  }

  let updated = 0;
  for (const s of body.settings) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category },
      create: { key: s.key, value: s.value, category: s.category },
    });
    updated++;
  }

  await db.auditLog.create({
    data: {
      action: "settings.updated",
      entityType: "settings",
      entityId: "bulk",
      metadata: JSON.stringify({ count: updated }),
    },
  });

  return NextResponse.json({ updated });
}
