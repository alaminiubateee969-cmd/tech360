import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/**
 * TECH360 brand-token guard.
 *
 * The design tokens are the single source of truth for brand colour across the
 * public site, admin console, customer portal and every official document.
 * These assertions exist because the previous state was a grayscale semantic
 * layer (`--primary: oklch(0.205 0 0)`) plus 700+ hardcoded hex literals, which
 * is precisely how a brand drifts without anyone noticing.
 */

const css = readFileSync('src/app/globals.css', 'utf8')

/** The palette measured from the owner-supplied artwork. */
const MEASURED = {
  'brand-navy': '#002077',   // letterhead wordmark "TECH"
  'brand-blue': '#024cb9',   // emblem blue arc
  'brand-bright': '#007bdb', // emblem bright accent
  'brand-teal': '#029962',   // emblem teal band
  'brand-green': '#25b03b',  // emblem green arc
  'brand-mint': '#90d8b4',   // letterhead pale mint line art
  'brand-cyan': '#009fe3',   // logo accent (present in logo, 0.54% of pixels)
} as const

function tokenValue(name: string): string | null {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : null
}

/** Split the stylesheet into the light (`:root`) and dark (`.dark`) blocks. */
function block(selector: string): string {
  const start = css.indexOf(selector)
  assert.ok(start >= 0, `stylesheet is missing the ${selector} block`)
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

describe('brand tokens — measured from the owner artwork', () => {
  it('defines every measured brand token with the exact artwork value', () => {
    for (const [name, value] of Object.entries(MEASURED)) {
      assert.equal(tokenValue(name)?.toLowerCase(), value, `--${name} must be ${value}`)
    }
  })

  it('exposes brand tokens to Tailwind so bg-brand-* utilities compile', () => {
    for (const name of Object.keys(MEASURED)) {
      assert.match(css, new RegExp(`--color-${name}:\\s*var\\(--${name}\\)`), `missing --color-${name} alias`)
    }
  })

  it('never lets a semantic token fall back to achromatic grayscale', () => {
    // `oklch(L 0 0)` is R=G=B — grey. That was the original defect.
    const greyOklch = /oklch\([0-9.]+ 0 0(?: \/ [0-9%]+)?\)/
    for (const selector of [':root {', '.dark {']) {
      const b = block(selector)
      for (const token of ['--primary', '--ring', '--sidebar-primary']) {
        const m = b.match(new RegExp(`${token}:\\s*([^;]+);`))
        assert.ok(m, `${token} missing in ${selector}`)
        assert.doesNotMatch(m[1], greyOklch, `${token} in ${selector} is grayscale: ${m[1]}`)
      }
    }
  })

  it('points primary at the brand blue, not a literal that can drift', () => {
    const primary = block(':root {').match(/--primary:\s*([^;]+);/)
    assert.ok(primary)
    assert.match(primary[1], /var\(--brand-blue\)/)
  })

  it('tokenises #009FE3 as a real accent rather than deleting it', () => {
    // Measured: #009FE3 is 0.54% of the owner logo, so it is a legitimate
    // brand accent. It must remain available as a token, and the CSS must
    // record the letterhead distinction so a future sweep does not confuse
    // "not in the letterhead" with "not in the brand".
    assert.equal(tokenValue('brand-cyan'), '#009fe3')
    assert.match(css, /--color-brand-cyan:\s*var\(--brand-cyan\)/)
    assert.match(css, /absent from the letterhead/i)
  })
})
