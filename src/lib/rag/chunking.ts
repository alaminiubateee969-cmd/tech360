// ============================================================
// TECH360 — document chunking
// ============================================================
// Splits an extracted document into overlapping, self-contained chunks.
// Every chunk carries a checksum so a changed document is detectable
// without storing the original text twice.
// ============================================================

import { createHash } from 'crypto'

export type Chunk = {
  index: number
  content: string
  checksum: string
  characterCount: number
}

export const DEFAULT_CHUNK_SIZE = 900
export const DEFAULT_CHUNK_OVERLAP = 150

export function chunkChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Split text into chunks of at most `size` characters with `overlap`
 * characters of context carried into the next chunk. Paragraph breaks
 * are preferred so a chunk rarely cuts a sentence in half.
 */
export function chunkText(
  text: string,
  options: { size?: number; overlap?: number } = {},
): Chunk[] {
  const size = Math.max(200, options.size ?? DEFAULT_CHUNK_SIZE)
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, size - 50))
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!normalized) return []

  const chunks: Chunk[] = []
  let cursor = 0
  let index = 0

  while (cursor < normalized.length) {
    let end = Math.min(cursor + size, normalized.length)
    if (end < normalized.length) {
      // Prefer a paragraph, then a sentence boundary, inside the window.
      const window = normalized.slice(cursor, end)
      const paragraph = window.lastIndexOf('\n\n')
      const sentence = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('। '),
        window.lastIndexOf('\n'),
      )
      const boundary = paragraph > size * 0.4 ? paragraph : sentence > size * 0.4 ? sentence : -1
      if (boundary > 0) end = cursor + boundary + 1
    }
    const content = normalized.slice(cursor, end).trim()
    if (content.length > 0) {
      chunks.push({
        index,
        content,
        checksum: chunkChecksum(content),
        characterCount: content.length,
      })
      index += 1
    }
    if (end >= normalized.length) break
    cursor = Math.max(end - overlap, cursor + 1)
  }

  return chunks
}

/** Word-count estimate that works for Bangla and English alike. */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return Math.max(1, Math.round(words.length * 1.35))
}
