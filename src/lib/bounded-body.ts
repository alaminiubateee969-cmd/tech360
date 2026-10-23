/**
 * Reads a request body as UTF-8 text, stopping (and cancelling the stream) as
 * soon as `limit` bytes are exceeded. Use it for every public webhook so that a
 * chunked request without Content-Length cannot be buffered in full first.
 * Returns null when the body is over the limit.
 */
export async function readBoundedBody(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}
