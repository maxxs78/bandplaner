/**
 * Kopiert den SoundTouch-AudioWorklet-Processor nach public/, damit ihn der
 * Browser per audioWorklet.addModule() laden kann. Worklet-Module muessen als
 * eigenstaendige Datei ueber eine URL erreichbar sein und lassen sich deshalb
 * nicht wie normaler Anwendungscode importieren/bundeln.
 *
 * Laeuft als postinstall, damit die Datei zur installierten Paketversion passt,
 * statt eine Kopie im Repository zu pflegen, die still veralten kann.
 */
import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = path.join(
  root,
  "node_modules",
  "@soundtouchjs",
  "audio-worklet",
  ".dist",
  "soundtouch-processor.js"
);
const targetDir = path.join(root, "public", "audio-worklet");
const target = path.join(targetDir, "soundtouch-processor.js");

try {
  await mkdir(targetDir, { recursive: true });
  await copyFile(source, target);
  console.log("[copy-audio-worklet] soundtouch-processor.js nach public/audio-worklet/ kopiert");
} catch (error) {
  // Nicht fatal: ohne die Datei bleibt nur der Uebungsmodus unbenutzbar,
  // Installation und Build sollen deswegen nicht scheitern.
  console.warn("[copy-audio-worklet] Kopieren fehlgeschlagen:", error.message);
}
