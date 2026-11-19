import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const legalView = readFileSync('src/components/site/LegalView.tsx', 'utf8')
const styles = readFileSync('src/app/globals.css', 'utf8')

describe('public legal-page print letterhead', () => {
  it('includes the configured letterhead artwork as a real image in the legal print document', () => {
    assert.match(legalView, /className="legal-print-document[\s\S]*?src=\{branding\.letterheadAsset\}/)
  })

  it('prints the US-Letter artwork at its natural page ratio with measured content insets', () => {
    assert.match(styles, /@page\s*\{\s*size:\s*letter;\s*margin:\s*39mm 16mm 46mm;/)
    assert.match(styles, /\.legal-print-letterhead-art\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*-39mm;[\s\S]*?left:\s*-16mm;[\s\S]*?width:\s*216mm;[\s\S]*?height:\s*279\.4mm;[\s\S]*?object-fit:\s*contain;/)
    assert.match(styles, /\.legal-print-document \[data-print="pad"\]\s*\{\s*display:\s*none !important;/)
  })
})
