// Unit tests for the Hostinger Agentic Mail governance rules.
// These are the rules that keep an AI agent from acting as the mailbox owner:
// no unrestricted grants, no self-authorized sends, no bypassing a block.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AGENT_SEND_CAPABILITIES_NOT_GRANTED,
  MAIL_CAPABILITIES,
  MAIL_ROLE_GRANTS,
  MAIL_ROLE_KEYS,
  authorizeMailCapability,
  decideRecipient,
  mailToolManifest,
  mayRetryMailFailure,
  normalizeRecipient,
  readHostingerMcpStatus,
} from '../src/lib/mail/hostinger-agentic'

describe('per-agent least privilege', () => {
  it('never grants an unrestricted mailbox to any role', () => {
    for (const key of MAIL_ROLE_KEYS) {
      const grant = MAIL_ROLE_GRANTS[key]
      assert.equal(grant.unrestrictedMailbox, false)
      assert.ok(!grant.capabilities.includes('mail.send' as never), `${key} must not hold mail.send`)
      assert.ok(!grant.capabilities.includes('mail.forward' as never), `${key} must not hold mail.forward`)
      for (const capability of grant.capabilities) {
        assert.ok((MAIL_CAPABILITIES as readonly string[]).includes(capability), `${capability} must be a declared capability`)
      }
    }
  })

  it('allows a receptionist to read, search and draft with the right approval level', () => {
    const read = authorizeMailCapability({ role: 'RECEPTIONIST', capability: 'mail.read' })
    assert.equal(read.allowed, true)
    const draft = authorizeMailCapability({ role: 'RECEPTIONIST', capability: 'mail.draft', approvalLevel: 1 })
    assert.equal(draft.allowed, true)
    assert.equal(draft.allowed && draft.autoSendAllowed, false, 'a draft is never auto-sent')
    const draftWithoutReview = authorizeMailCapability({ role: 'RECEPTIONIST', capability: 'mail.draft' })
    assert.equal(draftWithoutReview.allowed, false)
    assert.equal(draftWithoutReview.allowed === false && draftWithoutReview.code, 'APPROVAL_REQUIRED')
  })

  it('refuses a reply until the backend records the required approval', () => {
    const withoutApproval = authorizeMailCapability({ role: 'SUPPORT', capability: 'mail.reply' })
    assert.equal(withoutApproval.allowed, false)
    assert.equal(withoutApproval.allowed === false && withoutApproval.requiredApproval, 2)
    const withApproval = authorizeMailCapability({ role: 'SUPPORT', capability: 'mail.reply', approvalLevel: 2 })
    assert.equal(withApproval.allowed, true)
  })

  it('refuses an agent that tries to send or to auto-send its own draft', () => {
    for (const role of MAIL_ROLE_KEYS) {
      const send = authorizeMailCapability({ role, capability: 'mail.send', approvalLevel: 4 })
      assert.equal(send.allowed, false, `${role} must never hold mail.send`)
      const auto = authorizeMailCapability({ role, capability: 'mail.reply', approvalLevel: 2, autoSend: true })
      assert.equal(auto.allowed, false)
      assert.equal(auto.allowed === false && auto.code, 'SELF_AUTHORIZED_SEND', 'an agent may never trigger a send itself')
      assert.equal(auto.allowed === false && auto.requiredApproval, 2)
    }
    assert.deepEqual([...AGENT_SEND_CAPABILITIES_NOT_GRANTED], ['mail.send', 'mail.forward'])
  })

  it('refuses an unknown role or capability instead of failing open', () => {
    assert.equal(authorizeMailCapability({ role: null, capability: 'mail.read' }).allowed, false)
    assert.equal(authorizeMailCapability({ role: 'SALES', capability: 'root.shell' }).allowed, false)
    const admin = authorizeMailCapability({ role: 'ADMIN_ASSISTANT', capability: 'mail.organize', approvalLevel: 1 })
    assert.equal(admin.allowed, true)
    const adminSend = authorizeMailCapability({ role: 'ADMIN_ASSISTANT', capability: 'mail.reply', approvalLevel: 2 })
    assert.equal(adminSend.allowed, false, 'administration must not answer customers')
  })

  it('declares every tool with a capability and an approval level', () => {
    const manifest = mailToolManifest()
    assert.equal(manifest.length, 11)
    for (const tool of manifest) {
      assert.ok((MAIL_CAPABILITIES as readonly string[]).includes(tool.capability))
      assert.ok(tool.approvalLevel >= 0 && tool.approvalLevel <= 4)
    }
    assert.equal(manifest.find((t) => t.tool === 'mail_send_new')?.approvalLevel, 3)
    assert.equal(manifest.find((t) => t.tool === 'mail_get_message')?.mutates, false)
  })
})

describe('MCP connection status', () => {
  it('reports DISABLED when the Agentic Mail MCP server is not enabled', () => {
    assert.equal(readHostingerMcpStatus({}).state, 'DISABLED')
  })

  it('requires an https URL and a real bearer token, naming variables only', () => {
    const missing = readHostingerMcpStatus({ HOSTINGER_MAIL_MCP_ENABLED: 'true' })
    assert.equal(missing.state, 'INVALID')
    assert.deepEqual(missing.problems, ['HOSTINGER_MAIL_MCP_URL is not set', 'HOSTINGER_MAIL_MCP_TOKEN is not set'])

    const insecure = readHostingerMcpStatus({
      HOSTINGER_MAIL_MCP_ENABLED: 'true',
      HOSTINGER_MAIL_MCP_URL: 'http://mcp.example.com/sse',
      HOSTINGER_MAIL_MCP_TOKEN: 'short',
    })
    assert.equal(insecure.state, 'INVALID')
    assert.equal(insecure.problems.length, 2)
    assert.doesNotMatch(JSON.stringify(insecure), /short/)

    const ok = readHostingerMcpStatus({
      HOSTINGER_MAIL_MCP_ENABLED: 'true',
      HOSTINGER_MAIL_MCP_URL: 'https://mcp.hostinger.example/sse',
      HOSTINGER_MAIL_MCP_TOKEN: 'token_0123456789abcdefghij',
    })
    assert.equal(ok.state, 'CONFIGURED')
    assert.doesNotMatch(JSON.stringify(ok), /token_0123456789abcdefghij/)
  })
})

describe('allow / block governance', () => {
  it('normalizes and rejects unusable addresses', () => {
    assert.equal(normalizeRecipient('  Client@Example.COM '), 'client@example.com')
    assert.equal(normalizeRecipient('not an address'), null)
    assert.equal(decideRecipient('nope', {}).allowed, false)
    const invalid = decideRecipient('nope', {})
    assert.equal(invalid.allowed, false)
    assert.equal(invalid.allowed === false ? invalid.code : null, 'INVALID_RECIPIENT')
  })

  it('lets a block win even when the same address is allowlisted', () => {
    const decision = decideRecipient('client@example.com', {
      allowlist: ['client@example.com'],
      blocklist: ['CLIENT@example.com'],
    })
    assert.equal(decision.allowed, false)
    assert.equal(decision.allowed === false && decision.code, 'BLOCKED_RECIPIENT')
  })

  it('enforces an allowlist when one is configured', () => {
    const outside = decideRecipient('other@example.com', { allowlist: ['client@example.com'] })
    assert.equal(outside.allowed, false)
    assert.equal(outside.allowed === false && outside.code, 'NOT_ON_ALLOWLIST')
    assert.equal(decideRecipient('client@example.com', { allowlist: ['client@example.com'] }).allowed, true)
    assert.equal(decideRecipient('anyone@example.com', {}).allowed, true)
  })

  it('retries only a send that was never processed', () => {
    assert.equal(mayRetryMailFailure('NOT_PROCESSED'), true)
    assert.equal(mayRetryMailFailure('REJECTED'), false)
    assert.equal(mayRetryMailFailure('BLOCKED'), false)
    assert.equal(mayRetryMailFailure('AMBIGUOUS'), false, 'an ambiguous send may already be delivered')
    assert.equal(mayRetryMailFailure('ACCEPTED'), false)
  })
})
