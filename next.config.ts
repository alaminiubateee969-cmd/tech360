import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Dev-server OOM mitigation: this container has ~3.9GB RAM and the kernel
  // OOM-killer was killing next-server at ~2.9GB RSS during Turbopack dev
  // compilation. This target makes Turbopack trim caches before that point.
  // (Dev only — production Cloud Run does not use Turbopack.)
  experimental: {
    turbopackMemoryLimit: 1_500_000_000,
  },
};

export default nextConfig;
