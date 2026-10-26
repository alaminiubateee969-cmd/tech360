import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteFile } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER"], req);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const file = await deleteFile(id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ message: "Deleted" });
}
