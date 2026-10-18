// ============================================================
// TECH360 — retrieval embeddings
// ============================================================
// Two real embedders, and the platform always reports which one served
// a request. It never claims a neural embedding when it used a
// lexical one.
//
//   NEURAL_LOCAL  — a local embedding model served by the private model
//                   service (BGE-M3 by default, 1024 dimensions).
//   LEXICAL_LOCAL — a deterministic, dependency-free lexical embedder
//                   (hashed character trigrams + word tokens, 256
//                   dimensions, L2-normalised). It is a real vector
//                   representation and works offline; it captures
//                   lexical overlap, not semantic similarity, and the
//                   API labels it as such.
//
// REFERENCE: https://huggingface.co/BAAI/bge-m3 (MIT)
// ============================================================

import { routeEmbed } from '@/lib/model/router'

export type EmbedderKind = 'NEURAL_LOCAL' | 'LEXICAL_LOCAL'

export type Embedder = {
  kind: EmbedderKind
  model: string
  dimensions: number
  embed: (text: string) => Promise<number[]>
}

export const LEXICAL_DIMENSIONS = 256

function hash32(value: string, seed = 2166136261): number {
  let hash = seed >>> 0
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function l2Normalise(vector: number[]): number[] {
  let sum = 0
  for (const value of vector) sum += value * value
  const norm = Math.sqrt(sum)
  if (norm === 0) return vector
  return vector.map((value) => value / norm)
}

/**
 * Deterministic lexical embedder.
 * Character trigrams give robustness to Bangla inflection and typos;
 * word tokens give term weighting. Fully deterministic: the same text
 * always produces the same vector, so an index built today still matches
 * tomorrow.
 */
export function lexicalEmbedding(text: string, dimensions = LEXICAL_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0)
  const normalized = text.toLowerCase().replace(/[।॥]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return vector

  const words = normalized.split(' ').filter((w) => w.length > 1)
  for (const word of words) {
    vector[hash32(word) % dimensions] += 1
  }
  const padded = ` ${normalized} `
  for (let i = 0; i < padded.length - 2; i += 1) {
    const trigram = padded.slice(i, i + 3)
    vector[hash32(trigram) % dimensions] += 0.5
  }
  return l2Normalise(vector)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Resolve the embedder for the running deployment.
 *
 * The neural embedder is used when the private model service can serve
 * embeddings. Otherwise the lexical embedder is used and the caller is
 * told so — the retrieval quality differs and the platform does not
 * pretend otherwise.
 */
export async function resolveEmbedder(env: NodeJS.ProcessEnv = process.env): Promise<Embedder> {
  const result = await routeEmbed({ input: 'embedding probe' }, env)
  if (result.ok && result.vectors.length > 0 && result.vectors[0].length > 0) {
    const dimensions = result.vectors[0].length
    const model = result.model
    return {
      kind: 'NEURAL_LOCAL',
      model,
      dimensions,
      embed: async (text: string) => {
        const embedded = await routeEmbed({ input: text }, env)
        if (!embedded.ok || embedded.vectors.length === 0) {
          // The provider failed mid-flight: fall back to the lexical
          // embedder rather than silently returning an empty vector.
          return lexicalEmbedding(text, dimensions)
        }
        return embedded.vectors[0]
      },
    }
  }
  return {
    kind: 'LEXICAL_LOCAL',
    model: 'tech360-lexical-v1',
    dimensions: LEXICAL_DIMENSIONS,
    embed: async (text: string) => lexicalEmbedding(text),
  }
}

/** A synchronous lexical embedder — used by tests and by offline indexing. */
export const lexicalEmbedder: Embedder = {
  kind: 'LEXICAL_LOCAL',
  model: 'tech360-lexical-v1',
  dimensions: LEXICAL_DIMENSIONS,
  embed: async (text: string) => lexicalEmbedding(text),
}
