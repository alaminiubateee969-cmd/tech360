/**
 * Agent Memory store.
 *
 * saveMemory() persists a memory entry; if the value is long it is
 * chunked into AIMemoryChunk rows (500-char chunks) so recall can
 * surface partial context.
 *
 * recallMemory() does a keyword (SQL LIKE) search across memory keys
 * and chunk content. This is honest keyword search — SQLite has no
 * native vector index, so we do not pretend to do semantic retrieval.
 * Real vector search would require sqlite-vss or an external vector DB.
 */

import { db } from "@/lib/db";

const CHUNK_SIZE = 500;

export async function saveMemory(
  agentId: string,
  type: "session" | "long-term" | "episodic",
  key: string,
  value: string,
  metadata?: Record<string, unknown>
): Promise<{ memoryId: string; chunksCreated: number }> {
  const memory = await db.aIAgentMemory.create({
    data: {
      agentId,
      type,
      key,
      value,
      metadata: JSON.stringify(metadata ?? {}),
    },
  });

  // Chunk if the value is long enough to benefit from granular recall.
  let chunksCreated = 0;
  if (value.length > CHUNK_SIZE) {
    const chunks: Array<{ id?: string; memoryId: string; content: string; chunkIndex: number }> = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push({
        memoryId: memory.id,
        content: value.slice(i, i + CHUNK_SIZE),
        chunkIndex: Math.floor(i / CHUNK_SIZE),
      });
    }
    await db.aIMemoryChunk.createMany({ data: chunks });
    chunksCreated = chunks.length;
  }

  return { memoryId: memory.id, chunksCreated };
}

export async function recallMemory(
  agentId: string,
  query: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    type: string;
    key: string;
    value: string;
    snippet: string;
    createdAt: Date;
  }>
> {
  const term = `%${query.trim()}%`;
  // Search both the memory key/value and any chunks.
  const memories = await db.aIAgentMemory.findMany({
    where: {
      agentId,
      OR: [{ key: { contains: query } }, { value: { contains: query } }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const chunkMatches = await db.aIMemoryChunk.findMany({
    where: {
      memory: { agentId },
      content: { contains: query },
    },
    take: limit,
    include: { memory: true },
  });

  const results: Array<{
    id: string;
    type: string;
    key: string;
    value: string;
    snippet: string;
    createdAt: Date;
  }> = [];

  for (const m of memories) {
    const idx = m.value.toLowerCase().indexOf(query.toLowerCase());
    const snippet =
      idx >= 0
        ? "…" + m.value.slice(Math.max(0, idx - 40), idx + 160) + "…"
        : m.value.slice(0, 200);
    results.push({
      id: m.id,
      type: m.type,
      key: m.key,
      value: m.value,
      snippet,
      createdAt: m.createdAt,
    });
  }

  for (const c of chunkMatches) {
    if (results.some((r) => r.id === c.memoryId)) continue;
    results.push({
      id: c.memory.id,
      type: c.memory.type,
      key: c.memory.key,
      value: c.memory.value,
      snippet: c.content,
      createdAt: c.memory.createdAt,
    });
  }

  // `term` is computed for an explicit LIKE but Prisma `contains` already
  // does case-insensitive LIKE on SQLite. We keep `term` for clarity.
  void term;

  return results.slice(0, limit);
}

export async function listMemory(agentId: string, limit = 50) {
  return db.aIAgentMemory.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { chunks: true } } },
  });
}
