/**
 * Vergleicht src/messages/de.json und en.json auf fehlende oder verwaiste
 * Keys. de.json gilt als Referenzsprache (dort wird zuerst geschrieben,
 * siehe AGENTS.md-Konvention der i18n-Arbeit) - fehlt ein Key in en.json,
 * ist die Übersetzung vergessen worden; existiert er nur in en.json, ist er
 * verwaist (z. B. nach dem Entfernen eines Keys in nur einer Datei).
 *
 * Manuell ausfuehren: node scripts/check-i18n-keys.mjs
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const messagesDir = path.join(root, "src", "messages");

function loadMessages(locale) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/** Flacht ein verschachteltes Nachrichtenobjekt zu einer Liste von Punkt-Pfaden ab. */
function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const de = new Set(flattenKeys(loadMessages("de")));
const en = new Set(flattenKeys(loadMessages("en")));

const missingInEn = [...de].filter((key) => !en.has(key)).sort();
const orphanedInEn = [...en].filter((key) => !de.has(key)).sort();

if (missingInEn.length === 0 && orphanedInEn.length === 0) {
  console.log(`[check-i18n-keys] OK - ${de.size} Keys in de.json, alle auch in en.json vorhanden.`);
  process.exit(0);
}

if (missingInEn.length > 0) {
  console.error(`[check-i18n-keys] Fehlend in en.json (${missingInEn.length}):`);
  for (const key of missingInEn) console.error(`  - ${key}`);
}

if (orphanedInEn.length > 0) {
  console.error(`[check-i18n-keys] Verwaist in en.json, fehlen in de.json (${orphanedInEn.length}):`);
  for (const key of orphanedInEn) console.error(`  - ${key}`);
}

process.exit(1);
