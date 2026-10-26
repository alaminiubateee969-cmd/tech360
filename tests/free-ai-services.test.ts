import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFreeModels } from '../src/lib/free-ai-services'
import { AI_OPERATOR_MIN_ROLE, AI_WORKFORCE_MIN_ROLE } from '../src/lib/ai-workforce-policy'
import { hasRole } from '../src/lib/access-policy'

test('free catalog rejects paid, missing pricing, and unsuffixed routes', () => {
  const entry = (id: string, prompt: unknown, completion: unknown) => ({ id, pricing: { prompt, completion } })
  assert.deepEqual(parseFreeModels({ data: [
    entry('b:free', '0', '0'), entry('paid:free', '1', '0'), entry('no-suffix', '0', '0'),
    entry('missing:free', undefined, undefined), entry('null:free', null, null),
    entry('a:free', 0, 0),
  ] }).map((m) => m.id), ['a:free', 'b:free'])
  assert.throws(() => parseFreeModels({}))
})
test('Admin and Super Admin can operate; private infrastructure stays restricted', () => {
  for (const role of ['ADMIN', 'SUPER_ADMIN']) assert.equal(hasRole({ role }, AI_OPERATOR_MIN_ROLE), true)
  for (const role of ['CLIENT', 'STAFF', 'MANAGER']) assert.equal(hasRole({ role }, AI_OPERATOR_MIN_ROLE), false)
  assert.equal(hasRole({ role: 'ADMIN' }, AI_WORKFORCE_MIN_ROLE), false)
})
