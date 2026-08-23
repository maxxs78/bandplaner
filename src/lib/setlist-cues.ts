import {
  RefreshCw,
  Repeat,
  Hash,
  AlertCircle,
  Pin,
  Timer,
  Repeat2,
  Mic2,
  Star,
  ListOrdered,
  Headphones,
  Package,
  type LucideIcon,
} from "lucide-react";

/** Spiegelt das Prisma-Enum EquipmentIconDisplay - hier als eigener Typ, damit
 * Client-Komponenten nicht den Prisma-Client importieren muessen. */
export type EquipmentIconDisplay = "IN_TAG" | "LARGE" | "HIDDEN";

export type CueType =
  | "RETUNE"
  | "INSTRUMENT_CHANGE"
  | "EQUIPMENT"
  | "PROGRAM_CHANGE"
  | "CUSTOM"
  | "CAPO"
  | "CLICK"
  | "LOOPER"
  | "BACKING_VOCAL"
  | "SOLO"
  | "COUNT_IN"
  | "IN_EAR";

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
    EQUIPMENT: {
      label: t("equipment"),
      icon: Package,
      hasValue: true,
      valueLabel: t("equipmentValueLabel"),
      placeholder: t("equipmentPlaceholder"),
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
    CAPO: {
      label: t("capo"),
      icon: Pin,
      hasValue: true,
      valueLabel: t("capoValueLabel"),
      placeholder: t("capoPlaceholder"),
    },
    CLICK: {
      label: t("click"),
      icon: Timer,
      hasValue: true,
      valueLabel: t("clickValueLabel"),
      placeholder: t("clickPlaceholder"),
    },
    LOOPER: {
      label: t("looper"),
      icon: Repeat2,
      hasValue: true,
      valueLabel: t("looperValueLabel"),
      placeholder: t("looperPlaceholder"),
    },
    BACKING_VOCAL: {
      label: t("backingVocal"),
      icon: Mic2,
      hasValue: true,
      valueLabel: t("backingVocalValueLabel"),
      placeholder: t("backingVocalPlaceholder"),
    },
    SOLO: { label: t("solo"), icon: Star, hasValue: false },
    COUNT_IN: {
      label: t("countIn"),
      icon: ListOrdered,
      hasValue: true,
      valueLabel: t("countInValueLabel"),
      placeholder: t("countInPlaceholder"),
    },
    IN_EAR: {
      label: t("inEar"),
      icon: Headphones,
      hasValue: true,
      valueLabel: t("inEarValueLabel"),
      placeholder: t("inEarPlaceholder"),
    },
  };
}

export const CUE_TYPES: CueType[] = [
  "RETUNE",
  "INSTRUMENT_CHANGE",
  "EQUIPMENT",
  "CAPO",
  "PROGRAM_CHANGE",
  "CLICK",
  "LOOPER",
  "BACKING_VOCAL",
  "SOLO",
  "COUNT_IN",
  "IN_EAR",
  "CUSTOM",
];

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
