import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reindexAllNullEmbeddings } from "@/lib/ai-rag";

export const dynamic = "force-dynamic";

/**
 * Re-embed all RAG chunks that currently have a null embedding.
 * SUPER_ADMIN only — this calls the real OpenAI embeddings API and
 * can take a while for large knowledge bases.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN"], req);
  if (!auth.ok) return auth.response;

  const result = await reindexAllNullEmbeddings();
  return NextResponse.json(result);
}
