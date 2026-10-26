import { NextRequest, NextResponse } from "next/server";
import { retrieve, listDocuments } from "@/lib/ai-rag";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const topK = Math.min(20, Math.max(1, Number(searchParams.get("topK") || "5")));
  const action = searchParams.get("action") || "search";

  if (action === "list") {
    const docs = await listDocuments(50);
    return NextResponse.json({ documents: docs });
  }

  if (!query) {
    return NextResponse.json({ error: "q (query) is required" }, { status: 400 });
  }
  const results = await retrieve(query, topK);
  return NextResponse.json({ query, results });
}
