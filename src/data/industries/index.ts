import type { IndustryRegistryEntry } from "./types";
import { additionalSolutionsFor } from "./additional-solutions";

import { COMMERCE_RETAIL_ENTRIES } from "./commerce-retail";
import { EDUCATION_ENTRIES } from "./education-sector";
import { HEALTHCARE_ENTRIES } from "./healthcare-sector";
import { MANUFACTURING_ENTRY } from "./manufacturing";
import { AGENCIES_ENTRY } from "./agencies";
import { PROFESSIONAL_ENTRY } from "./professional-services";
import { MARKETING_ENTRY } from "./marketing-agencies";
import { LEGAL_ENTRY } from "./legal-services";
import { TECHNOLOGY_ENTRY } from "./technology-companies";
import { FINANCE_ENTRY } from "./finance";
import { INTERNATIONAL_SMES_ENTRY } from "./international-smes";
import { LOCAL_BUSINESSES_ENTRY } from "./local-businesses";
import { LOGISTICS_ENTRY } from "./logistics";
import { CONSTRUCTION_ENTRY } from "./construction";
import { REAL_ESTATE_ENTRY } from "./real-estate";

/**
 * Global Industries Platform — canonical registry of all 20 preserved industry slugs.
 *
 * Order matches the pinned route catalog (`src/lib/public-route-catalog.ts`,
 * enforced by `tests/public-route-catalog.test.ts`). Every entry has been
 * validated by `validateIndustrySolution` with 0 issues (USD-only, English-only,
 * full 22-field contract).
 */
const bySlugOrder = [
  ...COMMERCE_RETAIL_ENTRIES, // ecommerce, retail, restaurants-food, travel-hospitality
  ...EDUCATION_ENTRIES, // education, schools-training
  ...HEALTHCARE_ENTRIES, // healthcare, hospitals-clinics
  REAL_ESTATE_ENTRY,
  AGENCIES_ENTRY,
  PROFESSIONAL_ENTRY,
  MARKETING_ENTRY,
  LOCAL_BUSINESSES_ENTRY,
  INTERNATIONAL_SMES_ENTRY,
  FINANCE_ENTRY,
  LOGISTICS_ENTRY,
  CONSTRUCTION_ENTRY,
  MANUFACTURING_ENTRY, // flagship pilot
  LEGAL_ENTRY,
  TECHNOLOGY_ENTRY,
];

/** Reorder to the pinned slug sequence used by the public route catalog. */
const PINNED_SLUG_ORDER = [
  "ecommerce",
  "education",
  "schools-training",
  "healthcare",
  "hospitals-clinics",
  "real-estate",
  "restaurants-food",
  "agencies",
  "professional-services",
  "marketing-agencies",
  "local-businesses",
  "international-smes",
  "finance",
  "retail",
  "logistics",
  "travel-hospitality",
  "construction",
  "manufacturing",
  "legal-services",
  "technology-companies",
] as const;

/**
 * Attach the industry-specific solutions that complete each industry's
 * catalogue to the ≥8 solution minimum (see `./additional-solutions.ts`).
 *
 * Done here — at the single registry assembly point — so every consumer
 * (pages, structured data, agent content, tests) sees the same catalogue and
 * no individual industry file can drift below the minimum again.
 */
function withAdditionalSolutions(entry: IndustryRegistryEntry): IndustryRegistryEntry {
  const extra = additionalSolutionsFor(entry.slug);
  if (extra.length === 0) return entry;
  const existing = new Set(entry.data.modules.map((m) => m.id));
  const additions = extra.filter((m) => !existing.has(m.id));
  if (additions.length === 0) return entry;
  return {
    ...entry,
    data: { ...entry.data, modules: [...entry.data.modules, ...additions] },
  };
}

const entryMap = new Map<string, IndustryRegistryEntry>(
  bySlugOrder.map((entry) => [entry.slug, withAdditionalSolutions(entry)]),
);

/** All 20 industry solutions in pinned route order. */
export const INDUSTRY_REGISTRY: IndustryRegistryEntry[] = PINNED_SLUG_ORDER.map(
  (slug) => {
    const entry = entryMap.get(slug);
    if (!entry) {
      throw new Error(`INDUSTRY_REGISTRY: missing entry for slug "${slug}"`);
    }
    return entry;
  },
);

if (INDUSTRY_REGISTRY.length !== 20) {
  throw new Error(
    `INDUSTRY_REGISTRY: expected 20 entries, got ${INDUSTRY_REGISTRY.length}`,
  );
}

/** Lookup an industry solution by its preserved slug. */
export function getIndustryBySlug(slug: string): IndustryRegistryEntry | undefined {
  return entryMap.get(slug);
}

/** All registry slugs in pinned order (mirrors the public route catalog). */
export const INDUSTRY_SLUGS: readonly string[] = PINNED_SLUG_ORDER;

export default INDUSTRY_REGISTRY;
