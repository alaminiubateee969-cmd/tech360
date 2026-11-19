import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const dashboard = readFileSync('src/components/admin/DashboardView.tsx', 'utf8')
const tables = readFileSync('src/components/admin/shared/DataTable.tsx', 'utf8')
const notice = readFileSync('src/components/admin/AgentProviderNotice.tsx', 'utf8')

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

// Deliberately labelled static regression contracts, not a substitute for axe
// or keyboard acceptance. The compiled browser report measures actual output.
describe('static admin accessibility regression contracts', () => {
  it('retains a named keyboard-focusable scrollable activity list', () => {
    assert.match(dashboard, /<ul[^>]*aria-label="Recent activity" tabIndex=\{0\}/)
    assert.match(dashboard, /overflow-auto rounded-b-lg focus-visible:outline/)
  })

  it('uses an invoice action color that reaches AA contrast with its white label', () => {
    const classes = dashboard.match(/className="([^"]+)" aria-label="Create invoice draft"/)?.[1]
    assert.ok(classes)
    assert.match(classes, /\btext-white\b/)
    const color = classes.match(/\bbg-\[(#[0-9A-Fa-f]{6})\]/)?.[1]
    assert.ok(color)
    assert.ok(contrast(color, '#ffffff') >= 4.5)
    assert.ok(contrast('#009fe3', '#ffffff') < 4.5, 'the reproduced bright-cyan pair must not be considered accessible')
  })

  it('does not inherit the public body navy for the dark workforce navigation button', () => {
    const action = dashboard.split('actions={canOperate ? <Button')[1]?.split('</Button>')[0]
    assert.ok(action)
    assert.match(action, /className="[^"]*bg-slate-800[^"]*text-slate-200/)
    assert.match(action, /onClick=\{\(\) => onNavigate\('agents'\)\}/)
  })

  it('keeps dark table headers and empty text on the readable muted tone', () => {
    assert.match(tables, /h-9 bg-\[#0d1526\][^'\n]+text-slate-400/)
    assert.match(tables, /text-sm text-slate-400">No records yet\./)
  })

  it('keeps provider-configuration instructions on the readable dark-surface tone', () => {
    assert.match(notice, /mt-1 text-\[11px\] leading-relaxed text-slate-400/)
    assert.ok(contrast('#90a1b9', '#232017') >= 4.5)
    assert.ok(contrast('#62748e', '#232017') < 4.5)
  })
})
