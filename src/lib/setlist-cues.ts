import { RefreshCw, Repeat, Hash, AlertCircle, type LucideIcon } from "lucide-react";

export type CueType = "RETUNE" | "INSTRUMENT_CHANGE" | "PROGRAM_CHANGE" | "CUSTOM";

export type Cue = {
  type: CueType;
  value?: string;
  /** Nur bei INSTRUMENT_CHANGE, wenn ein Equipment-Katalogeintrag gewaehlt wurde
   * statt Freitext. icon/color sind zum Anzeigezeitpunkt denormalisiert
   * mitgespeichert (siehe CueBadges), damit sie nicht bei jedem Setlist-Render
   * per Equipment-Lookup nachgeladen werden muessen. */
  equipmentId?: string;
  equipmentIcon?: string | null;
  equipmentColor?: string | null;
};

export function getCueDefinitions(
  t: (key: string) => string
): Record<CueType, { label: string; icon: LucideIcon; hasValue: boolean; valueLabel?: string; placeholder?: string }> {
  return {
    RETUNE: { label: t("retune"), icon: RefreshCw, hasValue: false },
    INSTRUMENT_CHANGE: {
      label: t("instrumentChange"),
      icon: Repeat,
      hasValue: true,
      valueLabel: t("instrumentChangeValueLabel"),
      placeholder: t("instrumentChangePlaceholder"),
    },
    PROGRAM_CHANGE: {
      label: t("programChange"),
      icon: Hash,
      hasValue: true,
      valueLabel: t("programChangeValueLabel"),
      placeholder: t("programChangePlaceholder"),
    },
    CUSTOM: {
      label: t("custom"),
      icon: AlertCircle,
      hasValue: true,
      valueLabel: t("customValueLabel"),
      placeholder: t("customPlaceholder"),
    },
  };
}

export const CUE_TYPES: CueType[] = ["RETUNE", "INSTRUMENT_CHANGE", "PROGRAM_CHANGE", "CUSTOM"];

export const COLOR_PALETTE = [
  { key: "red", value: "#ef4444" },
  { key: "orange", value: "#f97316" },
  { key: "yellow", value: "#eab308" },
  { key: "green", value: "#22c55e" },
  { key: "blue", value: "#3b82f6" },
  { key: "purple", value: "#a855f7" },
] as const;

export function parseCues(raw: string | null | undefined): Cue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Cue => c && typeof c === "object" && CUE_TYPES.includes(c.type)
    );
  } catch {
    return [];
  }
}

export function serializeCues(cues: Cue[]): string | null {
  return cues.length > 0 ? JSON.stringify(cues) : null;
}
