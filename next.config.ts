import type { NextConfig } from "next";
import { resolveBuildIdentity } from "./scripts/build-identity.mjs";

const CANONICAL_ORIGIN = "https://bdtech360.com";
const buildIdentity = resolveBuildIdentity();

/**
 * Portfolio media directories (same list as PORTFOLIO_MEDIA_DIRS in
 * scripts/media/hash-portfolio-media.mjs). Exported for the cache-policy test.
 */
export const PORTFOLIO_MEDIA_SOURCES = [
  "/videos/work/:file*",
  "/images/case-studies/covers/:file*",
  "/images/work/sm/:file*",
];

/** Private API families served with `Cache-Control: no-store` (see headers()). */
export const PRIVATE_API_SOURCES = [
  "/api/admin/:path*",
  "/api/portal/:path*",
  "/api/chat/:path*",
  "/api/auth/:path*",
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  // Only public source metadata is embedded. Standalone deployments do not
  // contain .git, so reading HEAD in the health route at runtime is unreliable.
  env: {
    TECH360_BUILD_SHA: buildIdentity.commit,
    TECH360_BUILD_SOURCE_STATE: buildIdentity.sourceState,
  },
  reactStrictMode: false,
  // Next dev protects its HMR/runtime resources from foreign origins. Allow the
  // Arena preview proxy and loopback diagnostics; production is unaffected.
  allowedDevOrigins: ["127.0.0.1", "*.e2b.app"],
  async redirects() {
    return [
      // The root path is declared explicitly: for the catch-all below,
      // "/:path*" expands to an empty segment on "/" and Next.js emits
      // "https://bdtech360.com" without the trailing slash. The explicit rule
      // keeps the canonical form (and the production smoke gate) exact.
      {
        source: "/",
        has: [{ type: "host", value: "www.bdtech360.com" }],
        destination: `${CANONICAL_ORIGIN}/`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bdtech360.com" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      {
        // Hostinger terminates TLS before the Node.js process. Redirect only
        // when its trusted proxy explicitly marks the original request as HTTP.
        source: "/",
        has: [
          { type: "host", value: "bdtech360.com" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: `${CANONICAL_ORIGIN}/`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "bdtech360.com" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
      // Friendly aliases for the one role-based console. Authentication and
      // permissions are unchanged; there is no separate unguarded dashboard.
      { source: "/admin", destination: "/#/admin", permanent: false },
      { source: "/super-admin", destination: "/#/admin", permanent: false },
    ];
  },
  async headers() {
    return [
      // Private Software Factory surfaces must never be indexed: the control
      // center, the company application portal and every factory API response.
      {
        source: "/factory/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      // Every operator/admin surface, not just the factory control center.
      // `public/robots.txt` states that these paths send this header, so the
      // claim has to be true for all of them. Note this is a crawl directive,
      // never an access control — the API guards remain authoritative.
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/pipeline/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/design-kit/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/portal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/api/factory/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      // Authenticated and visitor-private APIs (operator data, client portal,
      // visitor chat transcripts, auth/session) must never be stored by a
      // browser, proxy or CDN — including their 401/403 responses. Public
      // APIs (e.g. /api/branding/public, /api/health) keep their own policy.
      ...PRIVATE_API_SOURCES.map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      })),
      // Portfolio media caching (docs/VISUAL_ASSET_MANIFEST.md §4.4).
      // Filenames here are slug-based and REPLACEABLE, so immutable caching is
      // applied only when the URL carries a content hash (`?v=<12 hex>`, from
      // src/data/portfolio-media-versions.ts — tests fail if a hash is stale).
      // Unversioned requests get a short, revalidating policy. Scoped to these
      // four media directories only: no HTML, API or other asset is affected,
      // and Next.js still serves byte ranges (206) and the correct MIME types.
      ...PORTFOLIO_MEDIA_SOURCES.flatMap((source) => [
        {
          source,
          has: [{ type: "query" as const, key: "v", value: "[0-9a-f]{12}" }],
          headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
        },
        {
          source,
          missing: [{ type: "query" as const, key: "v" }],
          headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
        },
      ]),
      // Content negotiation: the same URL serves HTML or Markdown depending on
      // `Accept` (see src/proxy.ts). Shared caches must key on that header, so
      // it is declared here — the framework rewrites `Vary` on its own
      // responses, which would otherwise drop the value set in middleware.
      {
        source: "/:path*",
        headers: [{ key: "Vary", value: "Accept" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Arena embeds the development preview cross-origin. Keep production
          // clickjacking protection intact while allowing the preview iframe.
          ...(process.env.NODE_ENV === "development" ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Do not include subdomains: automation.bdtech360.com and other
          // service hosts have separate HTTPS ownership/configuration.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
