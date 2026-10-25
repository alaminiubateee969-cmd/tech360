import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getFile } from "@/lib/storage";
import { promises as fs } from "fs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const file = await getFile(id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const buffer = await fs.readFile(file.storagePath);
    return new NextResponse(buffer, { status: 200, headers: { "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${file.name}"` } });
  } catch { return NextResponse.json({ error: "File not on disk" }, { status: 404 }); }
}
