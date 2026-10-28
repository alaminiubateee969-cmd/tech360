# Official documents that print on the TECH360 company pad

The company pad (owner-shared letterhead design, preserved in `public/brand/`)
is applied by `src/lib/letterhead.ts` — the single letterhead engine:

1. **SOW / Project Preview** (client-facing, pre-payment gate) — `/api/preview/[token]`
   Logo + TECH360 wordmark + CONNECT·INNOVATE·GROW tagline + Web|Cloud|AI|Data|Tech
   services line, document meta bar (client ref / version / issued / status),
   faint TECH360 watermark, signature blocks, labeled footer
   (Address · Phone · Website · Email).
2. **Official Invoice** (admin) — `/api/admin/invoices/[number]`
   Full tax invoice on the pad: bill-to block, totals with paid-to-date balance,
   line item, payment instructions. Linked from Payments → Invoices rows.
3. **Handover & Acceptance Certificate** (client-facing) — `/api/handover/[token]/download?format=html`
   Release record + payment verification + client responsibilities + signatures.
4. **Legal policies** (public, print) — every `#/legal/*` page prints with the
   pad letterhead (logo, legal identity, brand rule) via print-only blocks.
