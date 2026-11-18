/**
 * Industry links from portfolio pages (delivery blueprints and project pages).
 *
 * `/industries/education` currently returns HTTP 500. That defect predates
 * this portfolio work: the education registry payload fails
 * validateIndustrySolution and the page throws while rendering. Portfolio pages
 * must not send visitors there, so this redirect map points each broken
 * industry slug at a verified working sector page with the same audience.
 *
 * Contract, enforced by tests/portfolio-industry-links.test.ts:
 *  - every redirect TARGET validates with zero issues (a working page);
 *  - every redirect SOURCE is still broken. When the education page is fixed,
 *    that test fails as a reminder to delete the entry, so links go back to
 *    /industries/education automatically.
 * No other industry is affected. Link text always names the real destination.
 */
import { getIndustry } from "@/data/site";

export const INDUSTRY_LINK_REDIRECTS: Readonly<Record<string, string>> = {
  // Empty: `education` → `schools-training` was removed once the education
  // payload was repaired (its new modules/agents/entities/portals had been
  // merged into the wrong arrays, which made /industries/education return 500).
};

export interface IndustryLink {
  /** Industry the portfolio entry belongs to (display name). */
  sourceTitle: string;
  /** Destination page title — used as the link text. */
  title: string;
  slug: string;
  href: string;
  /** True when the link points at a substitute page rather than the industry's own. */
  substituted: boolean;
}

export function portfolioIndustryLink(slug: string | undefined | null): IndustryLink | undefined {
  if (!slug) return undefined;
  const source = getIndustry(slug);
  if (!source) return undefined;
  const targetSlug = INDUSTRY_LINK_REDIRECTS[slug] ?? slug;
  const target = getIndustry(targetSlug);
  if (!target) return undefined; // suppress only this link; the text stays
  return {
    sourceTitle: source.title,
    title: target.title,
    slug: target.slug,
    href: `/industries/${target.slug}`,
    substituted: target.slug !== source.slug,
  };
}
