/**
 * Gemeinsame Nummerierungs-/Formatierungslogik fuer Setlist-Eintraege, genutzt
 * vom interaktiven Builder, der Detailseite (inkl. eingefrorener Termine) und
 * der Druck-/Teilen-Ausgabe - damit alle drei Stellen dieselben Regeln
 * anwenden, statt die Logik mehrfach leicht unterschiedlich nachzubauen.
 */

export type SetlistItemKind = "SONG" | "CUSTOM" | "COMMENT" | "SECTION";

export type SetlistDisplayItem = {
  /** Optional fuer Abwaertskompatibilitaet mit vor dieser Erweiterung eingefrorenen Schnappschuessen (siehe computeSetlistNumbers). */
  kind?: SetlistItemKind;
  title: string;
  key?: string | null;
  bpm?: number | null;
  durationSec?: number | null;
  excludeFromNumbering?: boolean;
  /** Segue/Medley: Uebergang ohne Pause zum naechsten Eintrag. Rein visuell/Text - beeinflusst die Nummerierung nicht. */
  segueToNext?: boolean;
};

/**
 * SONG zaehlt immer, CUSTOM nur ohne excludeFromNumbering, COMMENT/SECTION nie.
 * Uebersprungene Eintraege hinterlassen keine Luecke in der Zaehlung der
 * folgenden Eintraege.
 */
export function computeSetlistNumbers(
  items: { kind?: SetlistItemKind; excludeFromNumbering?: boolean }[]
): (number | null)[] {
  let n = 0;
  return items.map((item) => {
    // Vor dieser Erweiterung eingefrorene Schnappschuesse kennen "kind" noch nicht -
    // dort galt implizit jeder Eintrag als zaehlender Song-Eintrag.
    const kind = item.kind ?? "SONG";
    const numbered = kind === "SONG" || (kind === "CUSTOM" && !item.excludeFromNumbering);
    if (!numbered) return null;
    n += 1;
    return n;
  });
}

/** Gesamtspieldauer: Song-Dauer plus die optionale Dauer manueller Eintraege (z. B. Pausen). */
export function totalSetlistDurationSec(items: { durationSec?: number | null }[]): number {
  return items.reduce((sum, item) => sum + (item.durationSec ?? 0), 0);
}

const SECTION_LINE_WIDTH = 50;

/** "-------...-------" ohne Label, "----- Label -------..." mit Label. */
function formatSectionLine(label: string | null): string {
  if (!label) return "-".repeat(SECTION_LINE_WIDTH);
  const left = "-----";
  const middle = ` ${label} `;
  const rightLen = Math.max(SECTION_LINE_WIDTH - left.length - middle.length, 3);
  return `${left}${middle}${"-".repeat(rightLen)}`;
}

/**
 * Reiner Text-Export (z. B. WhatsApp-Teilen / Zwischenablage) mit Nummerierung,
 * Kommentaren und Abschnittslinien. Segued Eintraege (der vorige Eintrag hat
 * segueToNext) werden mit "  ↳ " eingerueckt, damit ein Medley als Block lesbar bleibt.
 */
export function formatSetlistAsText(items: SetlistDisplayItem[]): string[] {
  const numbers = computeSetlistNumbers(items);
  return items.map((item, index) => {
    if (item.kind === "SECTION") return formatSectionLine(item.title || null);
    if (item.kind === "COMMENT") return item.title;
    const prev = items[index - 1];
    const segued = Boolean(prev && prev.segueToNext && prev.kind !== "SECTION" && prev.kind !== "COMMENT");
    const number = numbers[index];
    const line = number !== null ? `${number}. ${item.title}` : item.title;
    return segued ? `  ↳ ${line}` : line;
  });
}
