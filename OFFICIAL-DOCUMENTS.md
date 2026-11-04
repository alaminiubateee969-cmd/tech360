# Official documents that print on the TECH360 company pad

The company pad (owner-shared letterhead design, preserved in `public/brand/` with header/footer high-res assets)
is applied by the reusable branding engine `src/lib/document-branding.ts` + `src/lib/letterhead.ts` — the single letterhead source of truth for every official document:

1. **SOW / Project Preview** (client-facing, pre-payment gate) — `/api/preview/[token]`
   Header image (`/brand/tech360-header-high-res.png`) + TECH360 wordmark + CONNECT·INNOVATE·GROW tagline + Web|Cloud|AI|Data|Tech services line, document meta bar (client ref / version / issued / status), faint TECH360 watermark, signature blocks, labeled footer (Address · Phone · Website · Email), **circular TECH360 LLC seal** (`/brand/tech360-seal.png`) when Super Admin enables it for SOW. Branding version is snapshot at generation.
2. **Official Invoice** (admin) — `/api/admin/invoices/[number]?format=html`
   Full tax invoice on the pad: bill-to block, totals with paid-to-date balance, line items, payment instructions, **circular seal** when enabled for Invoice. Linked from Payments → Invoices rows. Every invoice stores brandingVersion, approvalStatus, finalizationStatus and auditHistory (see `GeneratedDocument`).
3. **Handover & Acceptance Certificate** (client-facing) — `/api/handover/[token]/download` (ZIP) + acceptance record
   Release record + payment verification + client responsibilities + signatures. Uses same letterhead header/footer without seal (seal only on SOW/Invoice per policy).
4. **Legal policies** (public, print) — every `#/legal/*` page prints with the pad letterhead (logo, legal identity, brand rule) via print-only blocks and reusable `LetterheadHeader`/`LetterheadFooter` components. **Never shows circular seal** (enforced by `isSealAllowedFor`).
5. **Work Proposal & Official Letter** — `/api/admin/branding/sample?type=WORK_PROPOSAL|OFFICIAL_LETTER`
   Proposal and official letters render on the same TECH360 letterhead header/footer but **never include the circular seal** (seal restricted to SOW & Invoice only). Generated via `src/lib/document-branding.ts` reusable engine.
6. **Official Information Sheet** (authenticated only since 2026-11) — `/api/official-info` (Super Admin/Admin auth required, anonymous returns 404)
   Every official fact on the pad (legal identity, pad + platform contacts, services, Super Admin / Admin login routing — never passwords).
   Private PDFs archived at `private/official/` and served only via `/api/admin/official-docs/[filename]` (role: ADMIN+). Public static access at `/official/*.pdf` has been removed (returns 404). Also shown in console under Settings → Document Branding and System → Official Info (authenticated).
   See `docs/ADMIN_ACCESS_AND_OFFICIAL_INFO.md`.

## Branding configuration (Super Admin → Settings → Document Branding)

- Default page size / header & footer spacing
- Upload/replace approved letterhead header/footer assets
- Upload/replace official circular seal (`/brand/tech360-seal.png`)
- Enable/disable seal for SOW and Invoice (seal never appears on legal/official letters)
- Live preview (`/api/admin/branding/preview?type=SOW|INVOICE|PROPOSAL|LETTER|LEGAL`)
- Generate sample PDFs (`/api/admin/branding/sample?type=WORK_PROPOSAL|SOW|INVOICE|OFFICIAL_LETTER|TERMS|PRIVACY|REFUND`)
- Restore approved default template (bumps branding version; old documents retain their original snapshot)

## Storage (spec §9) — `GeneratedDocument` + `FileRecord`

Every generated document stores: Document ID, Document type, Client ID, Project ID, Version, Created by, Created date, Approval status, Finalization status, File location (private path), Access permissions (role JSON), Audit history, Branding version, SHA256. Access rules: SUPER_ADMIN full, ADMIN per permissions, SALES proposal, PROJECT_MANAGER SOW/project/delivery, FINANCE invoice/payment, CLIENT own authorized only, PUBLIC never private.

## Preservation (spec §10)

Previously generated documents keep original `fileContent` snapshot + `brandingVersion` + `auditHistory` and are never overwritten when global template changes. New documents use latest approved branding version.
