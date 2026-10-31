import type { NextConfig } from "next";

const CANONICAL_ORIGIN = "https://bdtech360.com";

const nextConfig: NextConfig = {
  output: "standalone",
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
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
