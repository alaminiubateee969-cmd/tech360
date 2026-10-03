import type { NextConfig } from "next";

const CANONICAL_ORIGIN = "https://bdtech360.com";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
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
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: `${CANONICAL_ORIGIN}/`,
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      },
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
