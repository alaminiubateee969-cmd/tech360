/**
 * TECH360 — the Prisma field-usage guard.
 *
 * `tsc` only sees the real Prisma types when the client has been
 * generated, which needs the Prisma engine binaries. In an environment
 * without them, a call like
 *
 *     db.chatMessage.create({ data: { sessionId, role, content } })
 *
 * type-checks happily — the model is `any` — and then fails in CI with
 * "Object literal may only specify known properties".
 *
 * That happened: the console AI chat route was written against a
 * `ChatMessage` shape (`sessionId`, `role`, `content`) that the schema
 * has never had. The real model is `conversationId`, `sender`, `body`.
 *
 * This suite reads the schema and checks the fields the source uses
 * against the fields the schema declares, so the same mistake is
 * caught without a generated client. It is relation-aware: the keys
 * under a relation belong to the RELATED model, not to the outer one.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')
const schemaSrc = readFileSync(join(ROOT, 'prisma/schema.prisma'), 'utf8')

type Field = { type: string; relation?: string }

/** model -> Map(fieldName -> field) */
const schemaModels = new Map<string, Map<string, Field>>()

/** model -> Set(compound unique selector names) */
const compoundUniques = new Map<string, Set<string>>()
{
  let model: string | null = null
  for (const raw of schemaSrc.split('\n')) {
    const start = /^model\s+(\w+)\s*\{/.exec(raw)
    if (start) { model = start[1]; schemaModels.set(model, new Map()); continue }
    if (/^\}/.test(raw)) { model = null; continue }
    if (!model) continue
    const line = raw.trim()
    if (!line || line.startsWith('//')) continue
    // Prisma's compound-unique where-selector is `<field1>_<field2>`.
    const unique = /^@@unique\(\[([^\]]*)\]/.exec(line)
    if (unique) {
      const names = unique[1].split(',').map((f) => f.trim().split(':')[0].trim())
      const set = compoundUniques.get(model) ?? new Set()
      set.add(names.join('_'))
      set.add(`${names.join('_')}_key`)
      compoundUniques.set(model, set)
      continue
    }
    if (line.startsWith('@@')) continue
    const field = /^(\w+)\s+([A-Z]\w*)(\[\])?(\??)/.exec(line)
    if (!field) continue
    const type = field[2]
    const isRelation = /^[A-Z]/.test(type) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Bytes', 'Json', 'Decimal'].includes(type)
    schemaModels.get(model)!.set(field[1], isRelation ? { type, relation: type } : { type })
  }
}

/** Prisma's own keys, which are not model fields. */
const OPERATORS = new Set([
  'where', 'select', 'data', 'orderBy', 'include', 'take', 'skip', 'cursor', 'distinct',
  'not', 'in', 'notIn', 'contains', 'startsWith', 'endsWith', 'mode', 'gt', 'gte', 'lt', 'lte',
  'equals', 'connect', 'create', 'createMany', 'connectOrCreate', 'update', 'updateMany', 'upsert',
  'delete', 'deleteMany', 'set', 'unset', 'increment', 'decrement', 'multiply', 'divide', 'push',
  'AND', 'OR', 'NOT', '_count', 'relation', 'references', 'fields', 'onDelete', 'onUpdate', 'map', 'type',
  // orderBy options
  'nulls', 'sort',
])

/**
 * Remove template literals from the source.
 *
 * The blueprint engine emits a whole generated project as a template
 * string, and that generated code is not this application's code — it
 * must not be checked against this application's schema.
 */
function stripTemplateLiterals(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch !== '`') { out += ch; i += 1; continue }
    // a template literal
    i += 1
    let depth = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '\\') { i += 2; continue }
      if (c === '$' && src[i + 1] === '{') { depth += 1; i += 2; continue }
      if (c === '}' && depth > 0) { depth -= 1; i += 1; continue }
      if (c === '`' && depth === 0) { i += 1; break }
      i += 1
    }
    out += '""'
  }
  return out
}

/** Every source file. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      sourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

/** The balanced block that starts at `open` (the index of '{' or '['). */
function balanced(src: string, open: number): string {
  const isArray = src[open] === '['
  let depth = 0
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '{' || ch === '[') depth += 1
    else if (ch === '}' || ch === ']') {
      depth -= 1
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  return isArray ? '' : ''
}

/**
 * The top-level entries of an object literal body, as
 * `[key, valueText]` pairs.
 */
function entries(body: string): Array<[string, string]> {
  const result: Array<[string, string]> = []
  let depth = 0
  let key = ''
  let value = ''
  let inValue = false
  const close = () => {
    const trimmed = key.trim()
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) result.push([trimmed, value])
    key = ''
    value = ''
    inValue = false
  }
  for (const ch of body) {
    if (ch === '{' || ch === '[' || ch === '(') {
      depth += 1
      if (inValue) value += ch
      continue
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth < 0) { close(); break }
      if (inValue) value += ch
      continue
    }
    if (depth === 0) {
      if (ch === ':' && !inValue) { inValue = true; continue }
      if (ch === ',') { close(); continue }
      if (inValue) value += ch
      else key += ch
      continue
    }
    if (inValue) value += ch
  }
  close()
  return result
}

/** The argument blocks whose keys are model fields. */
const FIELD_BLOCKS = ['where', 'select', 'data', 'orderBy', 'include']

/** Blocks that hold another model's fields. */
const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'connect', 'connectOrCreate'])

const problems: string[] = []

/** The object literals inside a `{ ... }` or `[ ... ]` value. */
function objectsIn(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return [balanced(trimmed, trimmed.indexOf('{'))]
  if (trimmed.startsWith('[')) {
    const nested = balanced(trimmed, trimmed.indexOf('['))
    const out: string[] = []
    for (let i = 0; i < nested.length; i += 1) {
      if (nested[i] === '{') out.push(balanced(nested, i))
    }
    return out
  }
  return []
}

/**
 * Check one block body against one model.
 *
 * `context` names the operation for the report. The walk is relation
 * aware: the keys under a relation belong to the RELATED model.
 */
function check(model: string, body: string, context: string, file: string, line: number): void {
  const fields = schemaModels.get(model)
  if (!fields) return

  for (const [key, valueText] of entries(body)) {
    if (FIELD_BLOCKS.includes(key)) {
      for (const nested of objectsIn(valueText)) check(model, nested, context, file, line)
      continue
    }
    if (OPERATORS.has(key)) {
      // `create` / `update` / `connect` under a relation hold the RELATED
      // model's fields, so they are checked against that model.
      if (WRITE_OPS.has(key)) {
        for (const nested of objectsIn(valueText)) check(model, nested, context, file, line)
      }
      continue
    }
    const field = fields.get(key)
    if (!field) {
      // a compound-unique selector, e.g. `identityType_normalizedHash`
      if (compoundUniques.get(model)?.has(key)) continue
      problems.push(`${file.replace(`${ROOT}/`, '')}:${line} — ${context} uses "${key}", which ${model} does not declare`)
      continue
    }
    if (field.relation) {
      for (const nested of objectsIn(valueText)) check(field.relation, nested, context, file, line)
    }
  }
}

const files = sourceFiles(join(ROOT, 'src'))
for (const file of files) {
  const src = stripTemplateLiterals(readFileSync(file, 'utf8'))
  const call = /db\.(\w+)\.(\w+)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = call.exec(src)) !== null) {
    const delegate = match[1]
    // Prisma's delegate is the model name with a lower-case first letter.
    const capitalised = delegate[0].toUpperCase() + delegate.slice(1)
    const model = schemaModels.has(delegate) ? delegate : capitalised
    if (!schemaModels.has(model)) continue
    // the call must be followed by an argument object
    const after = src.slice(match.index + match[0].length).match(/^\s*/)?.[0].length ?? 0
    const argStart = match.index + match[0].length + after
    if (src[argStart] !== '{') continue
    const open = argStart
    const body = balanced(src, open)
    const line = src.slice(0, match.index).split('\n').length
    // Only the DIRECT top-level blocks are argument blocks: a `select:`
    // nested inside a relation belongs to the related model, not to this
    // one, and is reached through the relation walk below.
    for (const [block, valueText] of entries(body)) {
      if (!FIELD_BLOCKS.includes(block)) continue
      const context = `db.${delegate}.${match[2]}() ${block}`
      for (const nested of objectsIn(valueText)) check(model, nested, context, file, line)
    }
  }
}

describe('the source uses only fields the schema declares', () => {
  it('scans the whole source tree', () => {
    assert.ok(files.length > 300, `expected the whole source tree, scanned ${files.length} files`)
  })

  it('uses no unknown field on any Prisma model', () => {
    const unique = [...new Set(problems)]
    assert.deepEqual(
      unique,
      [],
      `Prisma calls that use a field the schema does not declare:\n  ${unique.join('\n  ')}`,
    )
  })
})
