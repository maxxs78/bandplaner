#!/usr/bin/env node

// Dieses Projekt liegt auf einer per SMB gemappten Netzlaufwerk-Freigabe
// (Diskstation). Next.js' Dev-Server-Router baut seine Routen-Zuordnung aus
// einem rekursiven Verzeichnis-Scan von src/app auf (watchpack in
// node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js).
// Über SMB kann dieser Scan mehrere zehn Sekunden dauern (jeder verschachtelte
// Ordner kostet einen Netzwerk-Roundtrip), sodass neu besuchte, tief
// verschachtelte dynamische Routen (z. B. .../[id]/edit) kurz nach dem
// Serverstart mit 404 fehlschlagen, obwohl die Datei existiert.
//
// patches/next+16.3.0.patch aktiviert für diesen Watcher Polling statt
// nativer Dateisystem-Events, damit der Scan auf SMB garantiert irgendwann
// vollständig konvergiert (vorher konnte er bei unzuverlässig zugestellten
// SMB-Events dauerhaft hängen bleiben). Dieses Skript verkürzt die
// Wartezeit zusätzlich: Es schreibt nach dem Start mehrfach über ein
// Zeitfenster verteilt alle Routen-Dateien mit identischem Inhalt neu, was
// den Watcher zu einem sofortigen Re-Abgleich der bereits erfassten Pfade
// anstößt, sobald sein Scan dort angekommen ist.

import { spawn } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appDir = path.join(projectRoot, "src", "app");
const routeFileNames = new Set(["page.tsx", "page.ts", "route.ts", "layout.tsx", "layout.ts"]);
const warmupDelaysMs = [2000, 10000, 20000, 35000, 60000, 90000];

function collectRouteFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRouteFiles(full, acc);
    } else if (routeFileNames.has(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function warmRoutes(pass) {
  const files = collectRouteFiles(appDir);
  for (const file of files) {
    writeFileSync(file, readFileSync(file, "utf8"));
  }
  console.log(
    `[warm-routes] Durchlauf ${pass}/${warmupDelaysMs.length}: ${files.length} Routen-Dateien neu geschrieben.`
  );
}

const isWin = process.platform === "win32";
const child = isWin
  ? spawn("npx next dev --webpack", { cwd: projectRoot, stdio: ["inherit", "pipe", "inherit"], shell: true })
  : spawn("npx", ["next", "dev", "--webpack"], { cwd: projectRoot, stdio: ["inherit", "pipe", "inherit"] });

let scheduled = false;
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (!scheduled && /Ready in/.test(text)) {
    scheduled = true;
    warmupDelaysMs.forEach((delay, i) => setTimeout(() => warmRoutes(i + 1), delay));
  }
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
