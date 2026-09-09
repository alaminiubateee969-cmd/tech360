/**
 * Hash navigation helpers for the single-route public site.
 * The app router (page.tsx) listens to `hashchange`, so plain anchors with
 * `href="#/..."` and programmatic `siteNavigate` both work.
 */

/** Navigate to a site hash path, e.g. siteNavigate("/services"). */
export function siteNavigate(path: string) {
  if (typeof window === "undefined") return;
  const target = path.startsWith("#") ? path.slice(1) : path;
  if (window.location.hash === `#${target}`) return;
  window.location.hash = target;
}

/** Reads the current public hash (e.g. "/services/cloud-deployment"). */
export function currentSiteHash(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.location.hash.replace(/^#/, "");
  return raw || "/";
}

/** Top-level section key from a hash path, e.g. "/services/x" -> "services". */
export function hashSection(hash: string): string {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  return parts[0] ?? "";
}
