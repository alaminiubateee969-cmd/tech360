# Third-party open-source credits

Tech360 reuses *ideas, check-lists and structure* from the MIT-licensed projects below.
No source files were copied unmodified; everything was re-implemented for this codebase.
Each project's licence text is available in its repository.

| Feature in Tech360 | Inspired by | Licence |
|---|---|---|
| Editorial diagram kit (`src/components/site/diagram-kit.tsx`), flat quiet button variants | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design), [tt-a1i/archify](https://github.com/tt-a1i/archify) | MIT |
| Admin SEO Audit (`src/lib/seo-audit-core.ts`) — audit framework & check order | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (seo-audit), [every-app/open-seo](https://github.com/every-app/open-seo) (site-audit workflow; its keyword/backlink data needs a *paid* DataForSEO key, so that part was deliberately NOT adopted) | MIT |
| Admin Marketing Kit (`src/data/marketing-templates.ts`) — copy frameworks | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT |
| n8n W26 Lead Enrichment (`n8n/W26_LEAD_ENRICHMENT.json`) — validate → score → route design | [parthasarathy123/n8n-gtm-lead-enrichment](https://github.com/parthasarathy123/n8n-gtm-lead-enrichment) (Apify/Clay/Zoho/Sheets legs replaced by free sources) | MIT |
| SMS channel (`src/lib/comms.ts`) — calls the httpSMS HTTP API | [NdoleStudio/httpsms](https://github.com/NdoleStudio/httpsms) (AGPL-3.0, used only as an external service — none of its code is included), [httpsms-node](https://github.com/NdoleStudio/httpsms-node) (MIT, API shape reference) | AGPL-3.0 / MIT |
| Newsletter engagement tracking (`src/lib/newsletter.ts` — open pixel, click redirect, unique-open/click stats) — tracking design pattern | [mohamed11sk/Email-markting](https://github.com/mohamed11sk/Email-markting) (open-pixel concept), [knsoftic/Email_Markting](https://github.com/knsoftic/Email_Markting) (open+click concept). Both repos carry **no licence file** — no code was copied; the TECH360 implementation is original (HMAC-signed tokens, deduplicated events, safe redirects) | no licence — concepts only |
| Knowledge upload with text extraction (`src/lib/doc-extract.ts`, `/api/admin/knowledge/upload`) — "chat with your docs" ingestion pattern (PDF/WORD/CSV/TXT) | [Lin-jun-xiang/docGPT-langchain](https://github.com/Lin-jun-xiang/docGPT-langchain) | MIT |
| Curated image-prompt pattern library (`src/data/image-prompts.ts`) — browsable tag-filterable gallery concept; all 36 prompts are original English business patterns written for this codebase, none copied | [songguoxs/gpt4o-image-prompts](https://github.com/songguoxs/gpt4o-image-prompts) (**no licence file** — gallery concept only, zero prompt text reused) | no licence — concept only |

## Runtime dependencies added for knowledge extraction

| Package | Purpose | Licence |
|---|---|---|
| [unpdf](https://github.com/unjs/unpdf) | Serverless-friendly PDF text extraction for knowledge uploads | MIT |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | DOCX → raw-text extraction for knowledge uploads | BSD-2-Clause |

## Deliberately not integrated
AGPL/GPL projects whose code would impose copyleft on this product (RSSHub, Firecrawl, VoiceStudio, OpenViking, SiYuan, idurar-erp-crm, frappe/crm, linphone) — run them as separate services if needed. Projects with no licence file cannot legally be reused.
