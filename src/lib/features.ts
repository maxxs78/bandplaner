import type { Band } from "@/generated/prisma/client";

export type BandFeatureFlags = Pick<
  Band,
  "equipmentEnabled" | "packlistsEnabled" | "financeEnabled" | "communicationEnabled" | "mediaPlayerEnabled"
>;

export type EnabledFeatures = {
  equipment: boolean;
  packlists: boolean;
  finance: boolean;
  communication: boolean;
  mediaPlayer: boolean;
};

/**
 * Einzige Stelle, an der Feature-Abhängigkeiten aufgelöst werden. Alle Aufrufer
 * fragen ausschließlich diese Funktion ab, nie die rohen Band-Felder direkt -
 * so bleibt eine mehrstufige Abhängigkeit (z. B. Packlisten brauchen Equipment)
 * an einem Ort wartbar.
 */
export function getEnabledFeatures(band: BandFeatureFlags): EnabledFeatures {
  const equipment = band.equipmentEnabled;
  return {
    equipment,
    packlists: equipment && band.packlistsEnabled,
    finance: band.financeEnabled,
    communication: band.communicationEnabled,
    mediaPlayer: band.mediaPlayerEnabled,
  };
}
