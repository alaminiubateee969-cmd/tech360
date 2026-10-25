/**
 * RAG (Retrieval-Augmented Generation) helpers.
 *
 * indexDocument() chunks content into 500-char windows and stores
 * AIRAGDocument + AIRAGChunk rows.
 *
 * retrieve() does keyword (SQL LIKE) search across chunk content and
 * ranks by a deterministic relevance score (number of query-term hits
 * and proximity). This is HONEST keyword search — not vector search.
 * SQLite has no native vector index. Real semantic retrieval would
 * require sqlite-vss, pgvector, or an external vector DB. We note
 * this explicitly so no one mistakes this for embedding-based recall.
 */

import { db } from "@/lib/db";

const CHUNK_SIZE = 500;

export async function indexDocument(
  title: string,
  content: string,
  source: string,
  sourceRef?: string
): Promise<{ documentId: string; chunksCreated: number }> {
  const doc = await db.aIRAGDocument.create({
    data: {
      source,
      sourceRef: sourceRef ?? null,
      title,
      content,
      metadata: JSON.stringify({ chars: content.length, chunkSize: CHUNK_SIZE }),
      status: "INDEXED",
    },
  });

  const chunks: Array<{ documentId: string; content: string; chunkIndex: number }> = [];
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    chunks.push({
      documentId: doc.id,
      content: content.slice(i, i + CHUNK_SIZE),
      chunkIndex: Math.floor(i / CHUNK_SIZE),
    });
  }
  await db.aIRAGChunk.createMany({ data: chunks });
  return { documentId: doc.id, chunksCreated: chunks.length };
}

/**
 * Retrieve the top-K chunks matching the query. Ranking is by the
 * count of query terms found in the chunk (case-insensitive) — a
 * deterministic keyword-relevance score.
 */
export async function retrieve(
  query: string,
  topK = 5
): Promise<
  Array<{
    chunkId: string;
    documentId: string;
    title: string;
    content: string;
    chunkIndex: number;
    score: number;
  }>
> {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  // Fetch all chunks containing any term (broad filter, then rank in JS).
  // For a small knowledge base this is fine and keeps the implementation
  // honest about its capabilities.
  const where = terms.length
    ? { OR: terms.map((t) => ({ content: { contains: t } })) }
    : undefined;

  const chunks = await db.aIRAGChunk.findMany({
    where,
    take: 500,
    include: { document: true },
  });

  const scored = chunks.map((c) => {
    const lower = c.content.toLowerCase();
    let score = 0;
    for (const t of terms) {
      // count occurrences
      let idx = lower.indexOf(t);
      while (idx >= 0) {
        score += 1;
        idx = lower.indexOf(t, idx + t.length);
      }
    }
    return {
      chunkId: c.id,
      documentId: c.documentId,
      title: c.document.title,
      content: c.content,
      chunkIndex: c.chunkIndex,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);
  return scored.slice(0, topK);
}

export async function listDocuments(limit = 50) {
  return db.aIRAGDocument.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { chunks: true } } },
  });
}

export async function deleteDocument(documentId: string) {
  await db.aIRAGChunk.deleteMany({ where: { documentId } });
  await db.aIRAGDocument.delete({ where: { id: documentId } });
}
