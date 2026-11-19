/**
 * Unified portfolio index for /work.
 *
 * Merges the two existing collections — the 12 system scenarios
 * (`WORK_EXAMPLES`) and the 8 delivery blueprints (`CASE_STUDIES`) — into one
 * filterable, searchable list with a normalised taxonomy (type, industry,
 * capability, technology) and a structured media record per entry.
 *
 * MEDIA PROVENANCE CONTRACT
 * -------------------------
 * Every image and video carries a `provenance` value that is rendered as a
 * visible label wherever the media appears. TECH360 currently holds no
 * client-authorised project evidence that may be published, so no entry uses
 * `client-evidence`. When authorised screenshots or recordings are supplied,
 * add them with `provenance: 'client-evidence'` and an `authorisation` note —
 * never relabel generated artwork as evidence.
 */

import { CASE_STUDIES, type CaseStudy } from "./site";
import { PORTFOLIO_MEDIA_VERSIONS } from "./portfolio-media-versions";
import { WORK_EXAMPLES, type WorkExample } from "./work-examples";
import { getCaseStudyImage } from "./service-images";
import { BLUEPRINT_DETAILS, getBlueprintDetail } from "./blueprint-details";
import { getProjectDetail } from "./work-details";

/* ------------------------------------------------------------------ */
/* Provenance                                                          */
/* ------------------------------------------------------------------ */

export type MediaProvenance =
  | "concept-artwork"
  | "architecture-diagram"
  | "motion-preview"
  | "client-evidence";

export const PROVENANCE: Record<MediaProvenance, { label: string; description: string }> = {
  "concept-artwork": {
    label: "Concept artwork",
    description:
      "Original AI-assisted illustration created for TECH360. It shows the kind of system or setting, not a screenshot of working software or a real client.",
  },
  "architecture-diagram": {
    label: "Architecture diagram",
    description:
      "Programmatically drawn flow diagram of the intended architecture. Placeholder bars represent data, not real figures.",
  },
  "motion-preview": {
    label: "Concept motion preview",
    description:
      "Short silent explainer video assembled from the concept artwork and the documented workflow stages. It is not a recording of a working product.",
  },
  "client-evidence": {
    label: "Authorised client evidence",
    description:
      "Screenshot or recording of delivered software, published with the client’s written permission.",
  },
};

/** Date the current motion previews were produced (used for VideoObject.uploadDate). */
export const PORTFOLIO_MEDIA_PRODUCED_ON = "2026-11-18";

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export type PortfolioKind = "system" | "blueprint";

export const KIND_LABEL: Record<PortfolioKind, { singular: string; plural: string; cta: string }> = {
  system: { singular: "System scenario", plural: "System scenarios", cta: "Explore the specification" },
  blueprint: { singular: "Delivery blueprint", plural: "Delivery blueprints", cta: "Read the blueprint" },
};

export const PORTFOLIO_INDUSTRIES = [
  "Commerce & Retail",
  "Education",
  "Healthcare",
  "Real Estate",
  "Restaurants & Food",
  "Logistics",
  "Agencies & Creative",
  "Professional Services",
  "Technology",
  "Cross-industry",
] as const;
export type PortfolioIndustry = (typeof PORTFOLIO_INDUSTRIES)[number];

export const PORTFOLIO_CAPABILITIES = [
  "Web & Commerce",
  "CRM & Sales",
  "Client Portals",
  "Workflow Automation",
  "AI Agents",
  "Messaging",
  "Analytics",
  "Operations & ERP",
] as const;
export type PortfolioCapability = (typeof PORTFOLIO_CAPABILITIES)[number];

/* ------------------------------------------------------------------ */
/* Entry model                                                         */
/* ------------------------------------------------------------------ */

export interface PortfolioImage {
  src: string;
  /** Smaller variant for cards (≈800px wide). */
  srcSmall?: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  provenance: MediaProvenance;
}

export interface PortfolioVideo {
  src: string;
  poster: string;
  width: number;
  height: number;
  durationSeconds: number;
  title: string;
  /** Text alternative describing what the silent video shows. */
  description: string;
  provenance: "motion-preview" | "client-evidence";
}

export interface PortfolioEntry {
  slug: string;
  kind: PortfolioKind;
  title: string;
  /** One-sentence card summary. */
  summary: string;
  industry: PortfolioIndustry;
  industrySlug?: string;
  capabilities: PortfolioCapability[];
  technologies: string[];
  /** Ordered workflow stage titles (used by cards, video and detail pages). */
  stages: string[];
  href: string;
  cover: PortfolioImage;
  gallery: PortfolioImage[];
  video?: PortfolioVideo;
  /** Planning estimate only. */
  deliveryWeeks?: string;
  featured: boolean;
}

/* ------------------------------------------------------------------ */
/* Explicit, auditable mappings                                        */
/* ------------------------------------------------------------------ */

const SYSTEM_TAXONOMY: Record<string, { industry: PortfolioIndustry; capabilities: PortfolioCapability[]; technologies: string[] }> = {
  "ecommerce-storefront": { industry: "Commerce & Retail", capabilities: ["Web & Commerce", "Messaging"], technologies: ["Next.js", "PostgreSQL", "Payment gateway", "Webhooks"] },
  "education-crm": { industry: "Education", capabilities: ["CRM & Sales", "Messaging"], technologies: ["Next.js", "PostgreSQL", "WhatsApp Cloud API", "Prisma"] },
  "school-erp": { industry: "Education", capabilities: ["Operations & ERP", "Client Portals"], technologies: ["Next.js", "MySQL", "SMS gateway", "Prisma"] },
  "clinic-system": { industry: "Healthcare", capabilities: ["Operations & ERP", "Messaging"], technologies: ["Next.js", "PostgreSQL", "SMS gateway", "Cloud Storage"] },
  "real-estate-crm": { industry: "Real Estate", capabilities: ["CRM & Sales", "Client Portals"], technologies: ["Next.js", "TypeScript", "PostgreSQL", "Prisma"] },
  "agency-portal": { industry: "Agencies & Creative", capabilities: ["Client Portals", "Workflow Automation"], technologies: ["Next.js", "TypeScript", "Cloud Storage", "SMTP"] },
  "ai-automation": { industry: "Cross-industry", capabilities: ["AI Agents", "Workflow Automation"], technologies: ["Node.js", "n8n", "LLM provider", "PostgreSQL"] },
  "whatsapp-sales-funnel": { industry: "Professional Services", capabilities: ["Messaging", "CRM & Sales", "Workflow Automation"], technologies: ["WhatsApp Cloud API", "Node.js", "PostgreSQL", "Webhooks"] },
  "social-automation": { industry: "Cross-industry", capabilities: ["Workflow Automation", "Analytics"], technologies: ["n8n", "Meta Graph API", "LinkedIn API", "Node.js"] },
  "lead-management": { industry: "Professional Services", capabilities: ["CRM & Sales", "Analytics"], technologies: ["Next.js", "PostgreSQL", "Prisma", "Webhooks"] },
  "client-portal": { industry: "Technology", capabilities: ["Client Portals", "Web & Commerce"], technologies: ["Next.js", "TypeScript", "SMTP", "Cloud Storage"] },
  "custom-dashboard": { industry: "Technology", capabilities: ["Analytics", "Operations & ERP"], technologies: ["Next.js", "Recharts", "PostgreSQL", "SMTP"] },
};

const BLUEPRINT_TAXONOMY: Record<string, { industry: PortfolioIndustry; capabilities: PortfolioCapability[] }> = {
  "fashion-retail-store-launch": { industry: "Commerce & Retail", capabilities: ["Web & Commerce", "Messaging", "Workflow Automation"] },
  "clinic-appointment-automation": { industry: "Healthcare", capabilities: ["Operations & ERP", "Messaging", "Workflow Automation"] },
  "school-enquiry-pipeline": { industry: "Education", capabilities: ["CRM & Sales", "Messaging", "Workflow Automation"] },
  "developer-sales-crm": { industry: "Real Estate", capabilities: ["CRM & Sales", "Analytics"] },
  "restaurant-order-pipeline": { industry: "Restaurants & Food", capabilities: ["Operations & ERP", "Messaging", "Workflow Automation"] },
  "logistics-live-tracking": { industry: "Logistics", capabilities: ["Operations & ERP", "Client Portals", "Messaging"] },
  "agency-client-portal": { industry: "Agencies & Creative", capabilities: ["Client Portals", "Workflow Automation"] },
  "firm-intake-automation": { industry: "Professional Services", capabilities: ["Client Portals", "Workflow Automation"] },
};

/** Shown first in the spotlight carousel, in this order. */
const FEATURED = [
  "clinic-appointment-automation",
  "ai-automation",
  "developer-sales-crm",
  "ecommerce-storefront",
  "logistics-live-tracking",
] as const;

const VIDEO_DURATION_SECONDS = 12;

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

/**
 * Content-versioned URL for a portfolio media file: `/videos/work/x.mp4?v=<sha256-prefix>`.
 * The hash comes from src/data/portfolio-media-versions.ts (generated by
 * scripts/media/hash-portfolio-media.mjs), so the URL changes whenever the
 * bytes change and next.config.ts can safely serve `?v=` requests as
 * `immutable`. Unknown paths are returned unversioned (short cache policy).
 */
export function mediaUrl(path: string): string {
  const version = PORTFOLIO_MEDIA_VERSIONS[path];
  return version ? `${path}?v=${version}` : path;
}

/** Strips the `?v=` cache-busting query, giving the file path under public/. */
export function mediaFilePath(url: string): string {
  return url.split("?")[0];
}

function smallWorkImage(src: string): string {
  // /images/work/01-x.jpg → /images/work/sm/01-x-800.webp
  return src.replace(/^\/images\/work\/(.+)\.jpg$/, "/images/work/sm/$1-800.webp");
}

function stripScenarioPrefix(text: string): string {
  return text.replace(/^(Illustrative scenario|Possible approach|Intended outcome, not a measured result):\s*/i, "");
}

function systemEntry(example: WorkExample): PortfolioEntry {
  const taxonomy = SYSTEM_TAXONOMY[example.slug];
  const detail = getProjectDetail(example.slug);
  const stages = detail?.journey.map((step) => step.title) ?? example.modules.slice(0, 4);
  const cover: PortfolioImage = {
    src: example.image,
    srcSmall: mediaUrl(smallWorkImage(example.image)),
    width: 1312,
    height: 816,
    alt: example.imageAlt,
    caption: `${example.name} — concept artwork, not a screenshot of working software.`,
    provenance: "concept-artwork",
  };
  return {
    slug: example.slug,
    kind: "system",
    title: example.name,
    summary: example.tagline,
    industry: taxonomy.industry,
    industrySlug: detail?.industrySlug,
    capabilities: taxonomy.capabilities,
    technologies: taxonomy.technologies,
    stages,
    href: `/work/projects/${example.slug}`,
    cover,
    gallery: [cover],
    video: {
      src: mediaUrl(`/videos/work/${example.slug}.mp4`),
      poster: mediaUrl(`/videos/work/posters/${example.slug}.webp`),
      width: 1280,
      height: 720,
      durationSeconds: VIDEO_DURATION_SECONDS,
      title: `${example.name} — concept motion preview`,
      description: `Silent ${VIDEO_DURATION_SECONDS}-second explainer. It opens on the ${example.name} concept artwork, then steps through the intended user journey — ${stages.join(", ")} — and closes on a TECH360 end card. It is labelled as a concept preview throughout and is not a recording of working software.`,
      provenance: "motion-preview",
    },
    deliveryWeeks: example.deliveryWeeks,
    featured: (FEATURED as readonly string[]).includes(example.slug),
  };
}

function blueprintEntry(study: CaseStudy): PortfolioEntry {
  const taxonomy = BLUEPRINT_TAXONOMY[study.slug];
  const detail = getBlueprintDetail(study.slug);
  const diagram = getCaseStudyImage(study.slug);
  const stages = detail?.stages.map((stage) => stage.title) ?? [];
  const relatedExample = detail ? WORK_EXAMPLES.find((example) => example.slug === detail.relatedProject) : undefined;
  const cover: PortfolioImage = {
    src: mediaUrl(`/images/case-studies/covers/${study.slug}.webp`),
    srcSmall: mediaUrl(`/images/case-studies/covers/${study.slug}-800.webp`),
    width: 1600,
    height: 1000,
    alt: COVER_ALT[study.slug] ?? `${study.title} — concept artwork`,
    caption: "Concept artwork of the operating setting — not a photograph of a real client or deployment.",
    provenance: "concept-artwork",
  };
  const gallery: PortfolioImage[] = [cover];
  if (diagram) {
    gallery.push({
      src: diagram.src,
      width: diagram.width,
      height: diagram.height,
      alt: diagram.alt,
      caption: `${diagram.concept} — architecture diagram; bars are placeholders, not data.`,
      provenance: "architecture-diagram",
    });
  }
  return {
    slug: study.slug,
    kind: "blueprint",
    title: study.title,
    summary: stripScenarioPrefix(study.challenge),
    industry: taxonomy.industry,
    industrySlug: detail?.industrySlug,
    capabilities: taxonomy.capabilities,
    technologies: study.stack,
    stages,
    href: `/work/case-studies/${study.slug}`,
    cover,
    gallery,
    video: {
      src: mediaUrl(`/videos/work/${study.slug}.mp4`),
      poster: mediaUrl(`/videos/work/posters/${study.slug}.webp`),
      width: 1280,
      height: 720,
      durationSeconds: VIDEO_DURATION_SECONDS,
      title: `${study.title} — concept motion preview`,
      description: `Silent ${VIDEO_DURATION_SECONDS}-second explainer. It opens on concept artwork of the ${taxonomy.industry.toLowerCase()} setting, then steps through the four blueprint stages — ${stages.join(", ")} — and closes on a TECH360 end card. It is labelled as a concept preview throughout and is not footage of a real client.`,
      provenance: "motion-preview",
    },
    deliveryWeeks: relatedExample?.deliveryWeeks,
    featured: (FEATURED as readonly string[]).includes(study.slug),
  };
}

const COVER_ALT: Record<string, string> = {
  "fashion-retail-store-launch":
    "Concept artwork: a boutique owner packing a parcel in a clothing stockroom while a tablet shows an abstract order dashboard.",
  "clinic-appointment-automation":
    "Concept artwork: a clinic receptionist confirming an appointment on screen while a patient holds a phone with a reminder message.",
  "school-enquiry-pipeline":
    "Concept artwork: an admissions counsellor reviewing an enquiry pipeline on a laptop with a parent and a student.",
  "developer-sales-crm":
    "Concept artwork: a property agent with a tablet showing a buyer timeline to a couple in a high-rise show apartment.",
  "restaurant-order-pipeline":
    "Concept artwork: a chef plating at the kitchen pass beside a screen of queued orders while a delivery rider waits.",
  "logistics-live-tracking":
    "Concept artwork: a courier scanning a parcel at a dispatch hub with a route-tracking map on a monitor behind.",
  "agency-client-portal":
    "Concept artwork: two designers reviewing a gallery of brand deliverables with approval marks on a large studio monitor.",
  "firm-intake-automation":
    "Concept artwork: a professional reviewing a secure document vault on a laptop in a quiet practice office.",
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const PORTFOLIO: readonly PortfolioEntry[] = [
  ...CASE_STUDIES.map(blueprintEntry),
  ...WORK_EXAMPLES.map(systemEntry),
];

export function getPortfolioEntry(kind: PortfolioKind, slug: string): PortfolioEntry | undefined {
  return PORTFOLIO.find((entry) => entry.kind === kind && entry.slug === slug);
}

export function featuredPortfolio(): PortfolioEntry[] {
  return FEATURED.map((slug) => PORTFOLIO.find((entry) => entry.slug === slug)).filter(
    (entry): entry is PortfolioEntry => Boolean(entry),
  );
}

export interface PortfolioQuery {
  kind?: PortfolioKind | "all";
  industry?: string;
  capability?: string;
  q?: string;
}

/** Pure filter used by the explorer UI and by tests. */
export function queryPortfolio(query: PortfolioQuery, source: readonly PortfolioEntry[] = PORTFOLIO): PortfolioEntry[] {
  const needle = (query.q ?? "").trim().toLowerCase();
  return source.filter((entry) => {
    if (query.kind && query.kind !== "all" && entry.kind !== query.kind) return false;
    if (query.industry && entry.industry !== query.industry) return false;
    if (query.capability && !entry.capabilities.includes(query.capability as PortfolioCapability)) return false;
    if (needle) {
      const haystack = [
        entry.title,
        entry.summary,
        entry.industry,
        ...entry.capabilities,
        ...entry.technologies,
        ...entry.stages,
      ]
        .join(" ")
        .toLowerCase();
      return needle.split(/\s+/).every((word) => haystack.includes(word));
    }
    return true;
  });
}

/** Entries sharing industry or capability, excluding the current one. */
export function relatedPortfolio(entry: PortfolioEntry, limit = 3): PortfolioEntry[] {
  return PORTFOLIO.filter((candidate) => candidate !== entry)
    .map((candidate) => ({
      candidate,
      score:
        (candidate.industry === entry.industry ? 3 : 0) +
        candidate.capabilities.filter((capability) => entry.capabilities.includes(capability)).length +
        (candidate.kind !== entry.kind ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/** Previous / next entry of the same kind, wrapping around. */
export function adjacentPortfolio(entry: PortfolioEntry): { previous: PortfolioEntry; next: PortfolioEntry } {
  const siblings = PORTFOLIO.filter((candidate) => candidate.kind === entry.kind);
  const index = siblings.findIndex((candidate) => candidate.slug === entry.slug);
  return {
    previous: siblings[(index - 1 + siblings.length) % siblings.length],
    next: siblings[(index + 1) % siblings.length],
  };
}

/** Counts derived from data — the only numbers the portfolio displays. */
export function portfolioStats() {
  return {
    total: PORTFOLIO.length,
    systems: PORTFOLIO.filter((entry) => entry.kind === "system").length,
    blueprints: PORTFOLIO.filter((entry) => entry.kind === "blueprint").length,
    industries: new Set(PORTFOLIO.map((entry) => entry.industry)).size,
    videos: PORTFOLIO.filter((entry) => entry.video).length,
  };
}

export { BLUEPRINT_DETAILS };
