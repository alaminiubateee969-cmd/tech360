import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { executeNLCommand } from "@/lib/nl-command";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const commandText = (body as { command?: string }).command;
  if (!commandText) return NextResponse.json({ error: "Missing command" }, { status: 400 });
  try {
    const result = await executeNLCommand(commandText, req);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
