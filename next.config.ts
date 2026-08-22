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
  webpack: (config) => {
    // Deterministische, gehashte Modul-IDs koennen bei diesem Modulgraphen
    // kollidieren: der Server-Build hat vereinzelt "use client"-Komponenten
    // (bandNav, copyLinkButton, practicePlayer) erzeugt, deren Code zwar im
    // Client-Bundle landet, aber nicht im React Client Manifest eingetragen
    // wurde ("Could not find the module ... in the React Client Manifest") -
    // reproduzierbar bei jedem Build, nicht durch Cache verursacht. Benannte
    // Modul-IDs vermeiden Hash-Kollisionen, auf Kosten minimal groesserer
    // Chunk-Bezeichner, was fuer diese App irrelevant ist.
    config.optimization.moduleIds = "named";
    return config;
  },
};

// Kein URL-Locale-Routing (kein [locale]-Segment) - die Sprache wird stattdessen
// pro Request in src/i18n/request.ts aus Profil/Cookie/Accept-Language ermittelt.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
