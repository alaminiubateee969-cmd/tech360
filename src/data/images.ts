import raw from "./images.json";

/**
 * Hosted real-business photography, keyed by industry / section.
 * Keys: hero, ecommerce, education, healthcare, realestate, restaurant, agency,
 * professional, marketing, localbusiness, sme, finance, retail, logistics,
 * travel, construction, manufacturing, legal, tech, about, careers.
 */
export const IMAGES = raw as Record<string, string[]>;

/** Returns the first image for a key (or undefined when the key is missing/empty). */
export function imageFor(key: string, index = 0): string | undefined {
  const list = IMAGES[key];
  if (!list || list.length === 0) return undefined;
  return list[Math.min(Math.max(index, 0), list.length - 1)];
}
