// Pure helpers shared by the WebChat widget and the operator inbox (no React, no DB).

export type ThreadMessageLike = { id: string; createdAt: string }

/** Merge server messages by id (later copies win) and keep (createdAt, id) order. */
export function mergeMessages<T extends ThreadMessageLike>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return current
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, { ...(byId.get(m.id) ?? {}), ...m } as T)
  return [...byId.values()].sort((a, b) => {
    const t = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return t !== 0 ? t : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
