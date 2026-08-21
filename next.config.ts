import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1 MB body limit, far below the 25 MB
    // max file size allowed for song file uploads (see src/lib/uploads.ts).
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

// Kein URL-Locale-Routing (kein [locale]-Segment) - die Sprache wird stattdessen
// pro Request in src/i18n/request.ts aus Profil/Cookie/Accept-Language ermittelt.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
