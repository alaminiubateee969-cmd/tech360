import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Keep this configuration on documented, typed Next.js options. Runtime
  // memory limits belong in the process manager/container configuration; the
  // previous experimental `turbopackMemoryLimit` key is not supported by the
  // installed Next.js version and broke the CI typecheck.
};

export default nextConfig;
