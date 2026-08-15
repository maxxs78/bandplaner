import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schlankes, eigenständiges Server-Bundle für den Docker-Produktionsbuild
  // (siehe Dockerfile) - lokal per `next dev` unverändert.
  output: "standalone",
  experimental: {
    // Server Actions default to a 1 MB body limit, far below the 25 MB
    // max file size allowed for song file uploads (see src/lib/uploads.ts).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
