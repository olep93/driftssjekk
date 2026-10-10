import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The PDF template reads its embedded fonts from disk at runtime, which file tracing cannot see.
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/report-template/fonts/*.woff"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
