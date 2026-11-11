# Industry Content Source Register

**Phase 4 deliverable** — TECH360 Global Industries Platform
Branch: `arena/f578e244-tech360` · Status: **complete (20/20 validated, 0 issues)**

This register records where every industry payload's content came from, which
design contracts apply, and the validation evidence for each group. It is the
provenance companion to `docs/GLOBAL_INDUSTRY_CONTENT_ARCHITECTURE.md`
(canonical structure) and `docs/MANUFACTURING_FLAGSHIP_SPECIFICATION.md`
(flagship quality bar).

---

## 1. Content sources

| Source class | What it informed | Recorded in |
|---|---|---|
| ISA-95 / Purdue model (L0–L4) | Physical-industry `factory` plane, IT/OT boundary rules | `shared.ts` `makeFactory(physical)`; manufacturing spec §boundary |
| ISO 9001:2015 Cl. 8.4 / 10.2 | Supplier scorecards, NCR→CAPA loops | manufacturing `quality-to-customer` group; construction NCR→CAPA |
| HL7 v2 (ADT/ORM/ORU) + FHIR R4 | Healthcare integration plane (outpatient FHIR, inpatient v2/DICOM) | `healthcare-sector.ts` integrations |
| EDI 837/835/270/271 + NCPDP | Revenue-cycle and pharmacy integrations | `healthcare-sector.ts` |
| FIDIC / BOQ practice | Construction tender, variation, retention, certification | `construction.ts` workflows CON-WF-01..05 |
| Hours-of-service rules | Logistics driver-clock hard blocks | `logistics.ts` LOG-WF-03 / LOG-MOD-03 |
| AML/KYC + sanctions practice | Screening, EDD, alert disposition, filing ladders | `finance.ts` FIN-WF-04 / FIN-MOD-05 |
| Benchmark IA analysis (CE Smart CRM, Vtiger, CRM.bd) | Module-card decomposition, omnichannel diagrams, USD-only posture | Phase 0/1 docs; module card pattern |
| Currency policy (strict USD-only) | All money fields; validator rejects any other currency code | `types.ts` content validator |

**Validator note:** the content validator treats any ISO-4217-looking token
(e.g. `SAR`) as a foreign currency code. Narrative text must avoid bare
currency-code strings — the finance payload uses "suspicious-activity report"
instead of the AML acronym for this reason.

---

## 2. Group inventory (20 slugs)

| Group file | Slugs | ID prefixes | Workflows | Modules | Pricing `[pilotSetup, pilotMonthly, stdSetup, stdMonthly, entSetup, entMonthly]` (USD) | Commit |
|---|---|---|---|---|---|---|
| `manufacturing/index.ts` | `manufacturing` (flagship) | `MFG-WF-01..26`, `MFG-MOD-01..52` | 26 | 52 | `[18500, 4200, 48000, 11500, 125000, 28000]` | `5526fb5` |
| `commerce-retail.ts` | `retail`, `ecommerce`, `restaurants-food`, `travel-hospitality` | `RET/ECM/RST/TRV-*` | 6 each | 8 each | retail `[15500, 3800, 42000, 9800, 110000, 24000]`; ecommerce `[12500, 3200, 38000, 8900, 98000, 21000]`; restaurants `[9800, 2600, 28000, 6800, 76000, 17500]`; travel `[14500, 3600, 41000, 9400, 108000, 23000]` | `83a402f` |
| `education-sector.ts` | `education`, `schools-training` | `EDU/SCH-*` | 6 each | 8 each | education `[16500, 4100, 46000, 10500, 115000, 25000]`; schools `[9500, 2400, 26000, 6200, 68000, 15500]` | `f09434c` |
| `healthcare-sector.ts` | `healthcare`, `hospitals-clinics` | `HLC/HSP-*` | 6 each | 8 each | healthcare `[22000, 5400, 62000, 14000, 155000, 33000]`; hospitals `[48000, 12000, 135000, 29000, 320000, 68000]` | `07499ae` |
| `agencies.ts` | `agencies` | `AGY-*` | 5 | 7 | `[11000, 2900, 31000, 7200, 78000, 17000]` | `60adf0f` |
| `professional-services.ts` | `professional-services` | `PSV-*` | 5 | 7 | `[12000, 3100, 34000, 7800, 84000, 18500]` | `60adf0f` |
| `marketing-agencies.ts` | `marketing-agencies` | `MKT-*` | 5 | 7 | `[12500, 3200, 35000, 8200, 88000, 19000]` | `60adf0f` |
| `legal-services.ts` | `legal-services` | `LGL-*` | 5 | 7 | `[13500, 3400, 38000, 8800, 95000, 21000]` | `60adf0f` |
| `technology-companies.ts` | `technology-companies` | `TEC-*` | 5 | 7 | `[15000, 3800, 42000, 9800, 110000, 24000]` | `60adf0f` |
| `finance.ts` | `finance` | `FIN-*` | 5 | 7 | `[42000, 10500, 120000, 26000, 290000, 62000]` | `498f601` |
| `international-smes.ts` | `international-smes` | `ISM-*` | 5 | 7 | `[16000, 4000, 45000, 10500, 115000, 25000]` | `498f601` |
| `local-businesses.ts` | `local-businesses` | `LOC-*` | 5 | 7 | `[3500, 900, 9500, 2200, 24000, 5400]` | `498f601` |
| `logistics.ts` | `logistics` | `LOG-*` | 5 | 7 | `[17500, 4300, 48000, 11000, 120000, 26000]` | `5b8ac74` |
| `construction.ts` | `construction` | `CON-*` | 5 | 7 | `[19000, 4700, 52000, 12000, 130000, 28000]` | `5b8ac74` |
| `real-estate.ts` | `real-estate` | `RRE-*` | 5 | 7 | `[13000, 3300, 36000, 8400, 90000, 19500]` | `5b8ac74` |

**Totals:** 20 slugs · 129 workflows · 193 modules · 16 group files.

### Scope decision (documented)

- **Flagship + Phase 4a–c groups** (manufacturing, commerce-retail,
  education, healthcare): **6 workflows + 8 modules** per industry
  (manufacturing: 26 + 52 as the quality bar).
- **Phase 4d–f groups** (13 industries): **5 workflows + 7 modules** each —
  a deliberate size control so all 20 slugs reach the full 22-field contract
  with 0 validation issues while keeping payloads maintainable. Every section
  required by `validateIndustrySolution` is present and non-empty.

---

## 3. Validation evidence

| Script | Scope | Result |
|---|---|---|
| `.scratch/validate-mfg.ts` | manufacturing flagship | 0 issues · 26 wf / 52 mod |
| `.scratch/validate-group.ts` | commerce-retail (4) | TOTAL 0 |
| `.scratch/validate-edu.ts` | education + schools-training | TOTAL 0 |
| `.scratch/validate-hlc.ts` | healthcare + hospitals-clinics | TOTAL 0 |
| `.scratch/validate-ap.ts` | agency-professional (5) | TOTAL 0 |
| `.scratch/validate-fe.ts` | finance-enterprise (3) | TOTAL 0 |
| `.scratch/validate-po.ts` | physical-operations (3) | TOTAL 0 |
| `.scratch/validate-registry.ts` | **all 20 via `INDUSTRY_REGISTRY`** | **0 issues · pinned order OK** |

Companion checks (commit `441f984`):

- `npx tsc --noEmit -p tsconfig.json` — clean
- `node --import tsx --test tests/public-route-catalog.test.ts` — 5/5
- `node --import tsx --test tests/reference-parity.test.ts` — 27/27

---

## 4. Contract guarantees (every entry)

Enforced by `src/data/industries/types.ts` validators and `shared.ts`
`assembleIndustry()`:

1. **USD-only** — no other currency token appears in any money field or narrative.
2. **English-only** — all content strings.
3. **Full 22-field payload** — hero, overview, businessModels, challenges,
   departments, roles, workflows (18-field each), modules (22-field each with
   `kpis.frequency` ∈ realtime|daily|weekly|monthly|quarterly), agents,
   dataModel, portals, integrations, analytics, security, roadmap, pricing,
   faqs, uiScreens, applications.
4. **Assets** — hero/UI screens assembled with `language: "en"`,
   `currency: "none"`, `status: "pending-review"`; image files land in Phase 5.
5. **Flagship counts** — only `manufacturing` carries flagship-tier counts;
   other entries are explicitly non-flagship.
6. **Pinned slug order** — `INDUSTRY_REGISTRY` matches the route catalog
   enforced by `tests/public-route-catalog.test.ts` (`SERVICES.length === 21`).

---

## 5. Registry API

```ts
import {
  INDUSTRY_REGISTRY,   // IndustryRegistryEntry[20] in pinned route order
  INDUSTRY_SLUGS,      // readonly string[20]
  getIndustryBySlug,   // (slug) => entry | undefined
} from "@/data/industries";
```

Group entry arrays remain available for per-group tooling:
`COMMERCE_RETAIL_ENTRIES`, `EDUCATION_ENTRIES`, `HEALTHCARE_ENTRIES`,
plus single-entry exports (`MANUFACTURING_ENTRY`, `AGENCIES_ENTRY`,
`PROFESSIONAL_ENTRY`, `MARKETING_ENTRY`, `LEGAL_ENTRY`, `TECHNOLOGY_ENTRY`,
`FINANCE_ENTRY`, `INTERNATIONAL_SMES_ENTRY`, `LOCAL_BUSINESSES_ENTRY`,
`LOGISTICS_ENTRY`, `CONSTRUCTION_ENTRY`, `REAL_ESTATE_ENTRY`).
