import { RefreshCw, Repeat, Hash, AlertCircle, type LucideIcon } from "lucide-react";

export type CueType = "RETUNE" | "INSTRUMENT_CHANGE" | "PROGRAM_CHANGE" | "CUSTOM";

export type Cue = { type: CueType; value?: string };

export const CUE_DEFINITIONS: Record<
  CueType,
  { label: string; icon: LucideIcon; hasValue: boolean; valueLabel?: string; placeholder?: string }
> = {
  RETUNE: { label: "Umstimmen", icon: RefreshCw, hasValue: false },
  INSTRUMENT_CHANGE: {
    label: "Instrument wechseln",
    icon: Repeat,
    hasValue: true,
    valueLabel: "Instrument (optional)",
    placeholder: "z. B. Akustikgitarre",
  },
  PROGRAM_CHANGE: {
    label: "Programmwechsel",
    icon: Hash,
    hasValue: true,
    valueLabel: "Programm-Nr.",
    placeholder: "z. B. 12",
  },
  CUSTOM: {
    label: "Eigener Hinweis",
    icon: AlertCircle,
    hasValue: true,
    valueLabel: "Hinweis",
    placeholder: "z. B. Klick an",
  },
};

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
