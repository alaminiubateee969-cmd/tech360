import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ClientCommsInbox } from '../src/components/admin/ClientDetailView'
import type { CommunicationRecord } from '../src/lib/admin-client'

const communications: CommunicationRecord[] = [
  {
    id: 'comm-client-a',
    clientId: 'db-client-a',
    channel: 'WHATSAPP',
    direction: 'IN',
    sender: '+8801000000001',
    body: 'Message belonging to client A',
    status: 'RECEIVED',
    createdAt: '2026-10-11T10:00:00.000Z',
  },
  {
    id: 'comm-client-b',
    clientId: 'db-client-b',
    channel: 'EMAIL',
    direction: 'IN',
    sender: 'private@example.invalid',
    body: 'Private message belonging to client B',
    status: 'RECEIVED',
    createdAt: '2026-10-11T10:01:00.000Z',
  },
]

test('Client 360 inbox renders only messages for its canonical database client id', () => {
  const markup = renderToStaticMarkup(
    createElement(ClientCommsInbox, { clientId: 'db-client-a', communications }),
  )

  assert.match(markup, /Message belonging to client A/)
  assert.doesNotMatch(markup, /Private message belonging to client B/)
  assert.doesNotMatch(markup, /private@example\.invalid/)
})

test('Client 360 inbox shows the empty state rather than another client’s messages', () => {
  const markup = renderToStaticMarkup(
    createElement(ClientCommsInbox, { clientId: 'db-client-c', communications }),
  )

  assert.match(markup, /No communications yet/)
  assert.doesNotMatch(markup, /Message belonging to client A/)
  assert.doesNotMatch(markup, /Private message belonging to client B/)
})
