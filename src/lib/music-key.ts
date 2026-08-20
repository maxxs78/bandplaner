const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const ROOT_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Erkennt das gängige Kurzschreibweise-Format für Tonarten (z. B. "Am", "F#m",
 * "Bb"), wie es auch das Tonart-Feld der Songbibliothek als Beispiel vorgibt.
 * Deutsche Langform (z. B. "cis-Moll", "Es-Dur") wird bewusst nicht unterstützt -
 * bei nicht erkanntem Format wird die transponierte Tonart einfach nicht
 * angezeigt, statt eine falsche Note zu raten.
 */
function parseKey(raw: string): { rootSemitone: number; isMinor: boolean; preferFlats: boolean } | null {
  const match = /^\s*([A-Ga-g])(#|b)?\s*(m|min|minor)?\s*$/.exec(raw);
  if (!match) return null;

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  let rootSemitone = ROOT_SEMITONES[letter];
  if (accidental === "#") rootSemitone += 1;
  if (accidental === "b") rootSemitone -= 1;
  rootSemitone = ((rootSemitone % 12) + 12) % 12;

  return { rootSemitone, isMinor: !!match[3], preferFlats: accidental === "b" };
}

/**
 * Transponiert eine Tonart um die angegebene Anzahl Halbtöne. Gibt null zurück,
 * wenn die Eingabe nicht im unterstützten Kurzschreibweise-Format vorliegt.
 */
export function transposeKey(raw: string, semitones: number): string | null {
  const parsed = parseKey(raw);
  if (!parsed) return null;

  const names = parsed.preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const index = ((parsed.rootSemitone + semitones) % 12 + 12) % 12;
  return names[index] + (parsed.isMinor ? "m" : "");
}

/**
 * Vergleicht zwei Tonart-Angaben unabhängig von Schreibweise (z. B. "Db" == "C#m"+... nein,
 * nur Grundton+Dur/Moll zählen, "Db" == "C#"). Lässt sich eine der beiden Angaben nicht
 * parsen, gilt das bewusst als "nicht gleich" - eine unklare Eingabe soll lieber zur
 * Rückfrage führen, als fälschlich als Übereinstimmung durchzugehen.
 */
export function keysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (!pa || !pb) return false;
  return pa.rootSemitone === pb.rootSemitone && pa.isMinor === pb.isMinor;
}
