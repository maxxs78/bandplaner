import { Chromagram } from "chord-recognition";

// Krumhansl-Kessler-Tonartprofile (1982), verifizierte Standardwerte - siehe
// z. B. https://mashav.com/sha/praat/scripts/Krumhansl-Schmuckler_Key_Profiler.html.
// Index 0 = Grundton, es folgen die weiteren 11 Halbtonschritte der chromatischen Skala.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type DetectedKey = {
  label: string;
  isMinor: boolean;
  correlation: number;
  /**
   * Gesetzt, wenn die parallele Tonart (z. B. Am zu C-Dur) eine fast ebenso
   * gute Korrelation erreicht - beide teilen sich exakt dieselben Töne und
   * sind chromatisch kaum unterscheidbar. Per Testmessungen an synthetischen
   * Akkordfolgen liegt der Korrelationsabstand in solchen Fällen bei ca.
   * 0,00-0,05, bei eindeutigen Fällen dagegen bei > 0,15 - daher 0,08 als Grenze.
   */
  ambiguousWith: { label: string; correlation: number } | null;
};

/** Verschiebt ein 12er-Referenzprofil so, dass sein Grundton auf absoluter Tonhöhenklasse `root` liegt. */
function profileForRoot(profile: number[], root: number) {
  return profile.map((_, absolutePitchClass) => profile[(absolutePitchClass - root + 12) % 12]);
}

function pearsonCorrelation(a: number[], b: number[]) {
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    numerator += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : numerator / denom;
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < buffer.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

/**
 * Schätzt die Tonart per Krumhansl-Schmuckler-Verfahren: Chromagramm über den
 * gesamten Song mitteln, dann gegen die 24 (12 Dur + 12 Moll) Referenzprofile
 * korrelieren und die beste Übereinstimmung wählen.
 *
 * Bekannte Grenze des Verfahrens: Dur und die parallele Molltonart (z. B. C-Dur
 * und Am) teilen sich exakt dieselben Töne und sind chromatisch kaum zu
 * unterscheiden - das Ergebnis ist eine Näherung, kein zuverlässiger Fakt.
 *
 * Blockiert kurzzeitig den Hauptthread je Zeitscheibe, gibt die Kontrolle
 * zwischendurch aber bewusst zurück (yield), damit die Oberfläche bei einem
 * mehrminütigen Song nicht spürbar einfriert.
 */
export async function detectKey(buffer: AudioBuffer): Promise<DetectedKey | null> {
  const channelData = mixToMono(buffer);
  const frameSize = 4096;
  const chroma = new Chromagram(frameSize, buffer.sampleRate);
  const sum = new Array(12).fill(0);
  let readings = 0;

  const YIELD_EVERY_N_FRAMES = Math.max(1, Math.round((buffer.sampleRate * 2) / frameSize));
  let framesSinceYield = 0;

  for (let offset = 0; offset < channelData.length; offset += frameSize) {
    const frame = new Array<number>(frameSize);
    for (let i = 0; i < frameSize; i++) {
      frame[i] = channelData[offset + i] ?? 0;
    }
    chroma.processAudioFrame(frame);
    if (chroma.isReady()) {
      const vector = chroma.getChromagram();
      for (let i = 0; i < 12; i++) sum[i] += vector[i];
      readings += 1;
    }

    framesSinceYield += 1;
    if (framesSinceYield >= YIELD_EVERY_N_FRAMES) {
      framesSinceYield = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (readings === 0) return null;
  const averageChroma = sum.map((v) => v / readings);

  const candidates: { root: number; isMinor: boolean; correlation: number }[] = [];
  for (let root = 0; root < 12; root++) {
    candidates.push({ root, isMinor: false, correlation: pearsonCorrelation(averageChroma, profileForRoot(MAJOR_PROFILE, root)) });
    candidates.push({ root, isMinor: true, correlation: pearsonCorrelation(averageChroma, profileForRoot(MINOR_PROFILE, root)) });
  }

  let best = candidates[0];
  for (const c of candidates) {
    if (c.correlation > best.correlation) best = c;
  }

  // Parallele Tonart: gleiche Tonvorratsmenge, Grundton um 3 Halbtöne verschoben
  // (Dur -> Moll: +9 bzw. äquivalent -3; Moll -> Dur: +3).
  const partnerRoot = best.isMinor ? (best.root + 3) % 12 : (best.root + 9) % 12;
  const partnerIsMinor = !best.isMinor;
  const partner = candidates.find((c) => c.root === partnerRoot && c.isMinor === partnerIsMinor)!;

  const AMBIGUITY_THRESHOLD = 0.08;
  const ambiguousWith =
    best.correlation - partner.correlation < AMBIGUITY_THRESHOLD
      ? { label: NOTE_NAMES[partner.root] + (partner.isMinor ? "m" : ""), correlation: partner.correlation }
      : null;

  return {
    label: NOTE_NAMES[best.root] + (best.isMinor ? "m" : ""),
    isMinor: best.isMinor,
    correlation: best.correlation,
    ambiguousWith,
  };
}
