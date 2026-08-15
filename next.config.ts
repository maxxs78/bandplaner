import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1 MB body limit, far below the 25 MB
    // max file size allowed for song file uploads (see src/lib/uploads.ts).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
