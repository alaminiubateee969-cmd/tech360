import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Production builds must not bypass TypeScript errors. CI also runs
  // `npm run typecheck` as an explicit gate before the build.
  // Keep this configuration on documented, typed Next.js options. Runtime
  // memory limits belong in the process manager/container configuration; the
  // previous experimental `turbopackMemoryLimit` key is not supported by the
  // installed Next.js version and broke the CI typecheck.
};

export default nextConfig;
