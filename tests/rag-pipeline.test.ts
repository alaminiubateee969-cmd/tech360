/**
 * TECH360 — RAG pipeline tests.
 *
 * The retrieval layer is exercised against a recording Prisma stub so
 * the real pipeline code runs: chunking, embedding, indexing, access
 * filtering, provenance recording and grounded answering.
 */
import assert from 'node:assert/strict'
import { before, describe, it, beforeEach, mock } from 'node:test'

// ---- recording Prisma stub ---------------------------------------------
type Call = { method: string; args: unknown }
const calls: Call[] = []

const storedChunks: Array<Record<string, unknown>> = []
let storedIngest: Record<string, unknown> | null = null
let findManyFilter: Record<string, unknown> = {}

class PrismaClientStub {
  knowledgeChunk = {
    upsert: async (args: unknown) => {
      calls.push({ method: 'knowledgeChunk.upsert', args })
      const data = (args as { create: Record<string, unknown> }).create
      storedChunks.push(data)
      return data
    },
    findMany: async (args: unknown) => {
      calls.push({ method: 'knowledgeChunk.findMany', args })
      findManyFilter = (args as { where: Record<string, unknown> }).where
      return storedChunks
    },
    count: async () => storedChunks.length,
    deleteMany: async () => ({ count: storedChunks.length }),
  }
  knowledgeIngestRecord = {
    upsert: async (args: unknown) => {
      calls.push({ method: 'knowledgeIngestRecord.upsert', args })
      storedIngest = (args as { create: Record<string, unknown> }).create
      return storedIngest
    },
    count: async () => (storedIngest ? 1 : 0),
  }
  auditLog = {
    create: async (args: unknown) => {
      calls.push({ method: 'auditLog.create', args })
      return { id: 'audit_1' }
    },
  }
  errorLog = { create: async () => ({ id: 'err_1' }) }
  notification = { create: async () => ({ id: 'notif_1' }) }
  $transaction = async (ops: unknown) => {
    if (Array.isArray(ops)) {
      for (const op of ops) await op
      return ops.length
    }
    return ops
  }
}

mock.module('@prisma/client', {
  namedExports: { PrismaClient: PrismaClientStub },
  defaultExport: { PrismaClient: PrismaClientStub },
})

// The modules are loaded lazily inside `before()` — this test file is
// compiled to CommonJS, so top-level await is not available, and the
// Prisma mock must be registered before the modules import it.
type RagModules = {
  chunkText: (text: string, options?: { size?: number; overlap?: number }) => Array<{ index: number; content: string; checksum: string; characterCount: number }>
  chunkChecksum: (content: string) => string
  estimateTokens: (text: string) => number
  lexicalEmbedding: (text: string, dimensions?: number) => number[]
  cosineSimilarity: (a: number[], b: number[]) => number
  lexicalEmbedder: { kind: string; model: string; dimensions: number; embed: (text: string) => Promise<number[]> }
  ingestDocument: (input: Record<string, unknown>) => Promise<{ ok: boolean; chunkCount: number; errorCode: string | null }>
  retrieveContext: (input: Record<string, unknown>) => Promise<{ ok: boolean; citations: Array<{ documentId: string; chunkIndex: number; score: number; accessLevel: string; excerpt: string }>; embedder: string; embedderKind: string }>
  answerWithEvidence: (input: Record<string, unknown>) => Promise<{ ok: boolean; answer: string; abstained: boolean }>
  isAccessLevel: (value: unknown) => boolean
  highestAccessLevel: (levels: string[]) => string
  ACCESS_LEVELS: readonly string[]
}

let M: RagModules

before(async () => {
  const [chunking, embeddings, pipeline, store] = await Promise.all([
    import('../src/lib/rag/chunking'),
    import('../src/lib/rag/embeddings'),
    import('../src/lib/rag/pipeline'),
    import('../src/lib/rag/store'),
  ])
  M = { ...chunking, ...embeddings, ...pipeline, ...store } as unknown as RagModules
})

const SAMPLE = `
Tech360 LLC admission SOP. A student who applies for undergraduate admission must submit
a passport copy, a photograph, academic transcripts and a completed application form.
Applications are reviewed by the admissions desk within three working days. Fees are
payable before the offer is confirmed. Refunds are not processed after visa submission.
`.trim()

beforeEach(() => {
  calls.length = 0
  storedChunks.length = 0
  storedIngest = null
  findManyFilter = {}
})

// ============================================================
describe('chunking', () => {
  it('splits long text into overlapping chunks with checksums', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence ${i} about admission and fees.`).join(' ')
    const chunks = M.chunkText(long, { size: 400, overlap: 80 })
    assert.ok(chunks.length > 1, 'a long document must produce several chunks')
    assert.ok(chunks.every((c) => c.content.length <= 400))
    assert.equal(chunks[0].index, 0)
    assert.equal(new Set(chunks.map((c) => c.checksum)).size, chunks.length, 'checksums must be unique')
  })

  it('produces a single chunk for short text', () => {
    const chunks = M.chunkText('A short note about the admission desk.')
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].index, 0)
  })

  it('returns nothing for empty text', () => {
    assert.deepEqual(M.chunkText('   '), [])
  })

  it('computes a stable checksum', () => {
    assert.equal(M.chunkChecksum('abc'), M.chunkChecksum('abc'))
    assert.notEqual(M.chunkChecksum('abc'), M.chunkChecksum('abd'))
  })

  it('estimates tokens for English and Bangla alike', () => {
    assert.ok(M.estimateTokens('one two three four') >= 1)
    assert.ok(M.estimateTokens('ভর্তি ফি জানতে চাই') >= 1)
  })
})

// ============================================================
describe('embeddings', () => {
  it('is deterministic', () => {
    const a = M.lexicalEmbedding('admission requirements for undergraduate students')
    const b = M.lexicalEmbedding('admission requirements for undergraduate students')
    assert.deepEqual(a, b)
  })

  it('is L2-normalised', () => {
    const vector = M.lexicalEmbedding('admission requirements')
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    assert.ok(Math.abs(norm - 1) < 1e-9, `expected a unit vector, got norm ${norm}`)
  })

  it('scores a matching text higher than an unrelated one', () => {
    const query = M.lexicalEmbedding('student admission fee payment')
    const related = M.lexicalEmbedding('The student pays the admission fee before the offer is confirmed.')
    const unrelated = M.lexicalEmbedding('The production server was restarted at midnight.')
    assert.ok(M.cosineSimilarity(query, related) > M.cosineSimilarity(query, unrelated))
  })

  it('returns a zero vector for empty text', () => {
    assert.equal(M.cosineSimilarity(M.lexicalEmbedding(''), M.lexicalEmbedding('anything')), 0)
  })
})

// ============================================================
describe('ingestion — provenance and indexing', () => {
  it('records every required provenance field', async () => {
    const result = await M.ingestDocument({
      documentId: 'doc-1',
      text: SAMPLE,
      source: 'INTERNAL_SOP',
      owner: 'admissions.desk',
      accessLevel: 'INTERNAL',
      embedder: M.lexicalEmbedder,
    })
    assert.equal(result.ok, true)
    assert.ok(result.chunkCount > 0)
    assert.ok(storedIngest, 'a provenance record must be written')
    for (const field of [
      'source',
      'owner',
      'collectedAt',
      'lastVerifiedAt',
      'accessLevel',
      'version',
      'retentionPolicy',
      'permissionScope',
      'contentHash',
    ]) {
      assert.ok(field in storedIngest!, `provenance is missing "${field}"`)
    }
    assert.equal(storedIngest!.accessLevel, 'INTERNAL')
    assert.equal(storedIngest!.owner, 'admissions.desk')
  })

  it('indexes every chunk with a vector and an access level', async () => {
    await M.ingestDocument({
      documentId: 'doc-2',
      text: SAMPLE,
      source: 'INTERNAL_SOP',
      owner: 'admissions.desk',
      accessLevel: 'CONFIDENTIAL',
      embedder: M.lexicalEmbedder,
    })
    assert.equal(storedChunks.length, (storedIngest as { chunkCount: number }).chunkCount)
    for (const chunk of storedChunks) {
      assert.equal(chunk.accessLevel, 'CONFIDENTIAL')
      assert.equal(typeof chunk.embedding, 'string')
      assert.equal((JSON.parse(chunk.embedding as string) as number[]).length, 256)
    }
  })

  it('refuses a document that is too short to index', async () => {
    const result = await M.ingestDocument({
      documentId: 'doc-3',
      text: 'too short',
      source: 'X',
      owner: 'Y',
      accessLevel: 'INTERNAL',
      embedder: M.lexicalEmbedder,
    })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'DOCUMENT_TOO_SHORT')
  })

  it('refuses a student record at PUBLIC access level', async () => {
    const result = await M.ingestDocument({
      documentId: 'doc-4',
      text: SAMPLE,
      source: 'STUDENT_FILE',
      owner: 'admissions.desk',
      accessLevel: 'PUBLIC',
      containsStudentRecords: true,
      embedder: M.lexicalEmbedder,
    })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'STUDENT_RECORD_ACCESS_TOO_BROAD')
    assert.equal(storedChunks.length, 0, 'nothing may be indexed when the access rule is broken')
  })

  it('refuses a document with no owner or source', async () => {
    const result = await M.ingestDocument({
      documentId: 'doc-5',
      text: SAMPLE,
      source: '',
      owner: '',
      accessLevel: 'INTERNAL',
      embedder: M.lexicalEmbedder,
    })
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'MISSING_PROVENANCE')
  })

  it('writes an audit record for the ingestion', async () => {
    await M.ingestDocument({
      documentId: 'doc-6',
      text: SAMPLE,
      source: 'INTERNAL_SOP',
      owner: 'admissions.desk',
      accessLevel: 'INTERNAL',
      embedder: M.lexicalEmbedder,
    })
    const auditCalls = calls.filter((c) => c.method === 'auditLog.create')
    assert.ok(auditCalls.length >= 1)
  })
})

// ============================================================
describe('retrieval — access isolation and citations', () => {
  async function seed() {
    await M.ingestDocument({
      documentId: 'doc-internal',
      text: SAMPLE,
      source: 'INTERNAL_SOP',
      owner: 'admissions.desk',
      accessLevel: 'INTERNAL',
      embedder: M.lexicalEmbedder,
    })
    await M.ingestDocument({
      documentId: 'doc-restricted',
      text: SAMPLE,
      source: 'STUDENT_FILE',
      owner: 'registrar',
      accessLevel: 'RESTRICTED',
      embedder: M.lexicalEmbedder,
    })
  }

  it('filters by the caller access levels in the database query', async () => {
    await seed()
    await M.retrieveContext({ query: 'admission fee', accessLevels: ['PUBLIC', 'INTERNAL'], embedder: M.lexicalEmbedder })
    const find = calls.find((c) => c.method === 'knowledgeChunk.findMany')
    assert.ok(find)
    const where = (find!.args as { where: { accessLevel: { in: string[] } } }).where
    assert.deepEqual(where.accessLevel.in, ['PUBLIC', 'INTERNAL'])
    assert.equal(where.accessLevel.in.includes('RESTRICTED'), false, 'a restricted chunk must never be queried for a lower-clearance caller')
  })

  it('never returns a chunk above the caller clearance', async () => {
    await seed()
    const result = await M.retrieveContext({
      query: 'admission fee',
      accessLevels: ['PUBLIC', 'INTERNAL'],
      embedder: M.lexicalEmbedder,
    })
    assert.equal(result.ok, true)
    for (const citation of result.citations) {
      assert.notEqual(citation.accessLevel, 'RESTRICTED')
    }
  })

  it('returns a restricted chunk to a caller that holds the clearance', async () => {
    await seed()
    const result = await M.retrieveContext({
      query: 'admission fee',
      accessLevels: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
      embedder: M.lexicalEmbedder,
    })
    assert.ok(result.citations.length > 0)
  })

  it('returns citations that name the document, chunk and score', async () => {
    await seed()
    const result = await M.retrieveContext({
      query: 'student admission fee',
      accessLevels: ['PUBLIC', 'INTERNAL'],
      embedder: M.lexicalEmbedder,
    })
    assert.ok(result.citations.length > 0)
    for (const citation of result.citations) {
      assert.equal(typeof citation.documentId, 'string')
      assert.equal(typeof citation.chunkIndex, 'number')
      assert.equal(typeof citation.score, 'number')
      assert.ok(citation.excerpt.length > 0)
    }
  })

  it('reports the embedder it used', async () => {
    await seed()
    const result = await M.retrieveContext({ query: 'fee', accessLevels: ['INTERNAL'], embedder: M.lexicalEmbedder })
    assert.equal(result.embedder, 'tech360-lexical-v1')
    assert.equal(result.embedderKind, 'LEXICAL_LOCAL')
  })

  it('rejects an empty query', async () => {
    const result = await M.retrieveContext({ query: ' ', accessLevels: ['INTERNAL'], embedder: M.lexicalEmbedder })
    assert.equal(result.ok, false)
  })
})

// ============================================================
describe('grounded answering — abstention', () => {
  it('abstains when there is no evidence at all', async () => {
    const answer = await M.answerWithEvidence({
      query: 'anything',
      accessLevels: ['PUBLIC'],
      embedder: M.lexicalEmbedder,
    })
    assert.equal(answer.ok, true)
    assert.equal(answer.abstained, true)
    assert.equal(answer.answer, 'INSUFFICIENT_EVIDENCE')
  })

  it('abstains when no provider can serve the request', async () => {
    const answer = await M.answerWithEvidence({
      query: 'admission fee',
      accessLevels: ['PUBLIC'],
      embedder: M.lexicalEmbedder,
    })
    // No model provider is configured in the test environment, so the
    // platform must abstain rather than invent an answer.
    assert.equal(answer.abstained, true)
    assert.equal(answer.answer, 'INSUFFICIENT_EVIDENCE')
  })
})

// ============================================================
describe('access levels', () => {
  it('recognises only the four declared levels', () => {
    assert.equal(M.isAccessLevel('INTERNAL'), true)
    assert.equal(M.isAccessLevel('PUBLIC'), true)
    assert.equal(M.isAccessLevel('CONFIDENTIAL'), true)
    assert.equal(M.isAccessLevel('RESTRICTED'), true)
    assert.equal(M.isAccessLevel('SECRET'), false)
    assert.equal(M.ACCESS_LEVELS.length, 4)
  })

  it('computes the highest level a caller holds', () => {
    assert.equal(M.highestAccessLevel(['PUBLIC', 'INTERNAL']), 'INTERNAL')
    assert.equal(M.highestAccessLevel(['PUBLIC', 'RESTRICTED', 'INTERNAL']), 'RESTRICTED')
    assert.equal(M.highestAccessLevel([]), 'PUBLIC')
  })
})
