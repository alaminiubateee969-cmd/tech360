/** Provider output is untrusted even when an upstream returns HTTP 200. */
export function isEmbeddingVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

export function isEmbeddingBatch(value: unknown, expectedCount: number): value is number[][] {
  return Array.isArray(value) && value.length === expectedCount && value.length > 0
    && value.every(isEmbeddingVector) && value.every((vector) => vector.length === value[0].length)
}
