import { NextResponse } from "next/server";
import { mkdir, rm } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";
import { randomUUID } from "crypto";
import { requireActiveUser } from "@/lib/access";
import { importBandBackupArchive } from "@/lib/band-backup-import";
import { BACKUP_STAGING_ROOT, BandBackupImportError } from "@/lib/band-backup-shared";

/**
 * Importiert ein Band-Backup als brandneue Band. Eigene Route statt Server
 * Action: ein Backup-Archiv kann mehrere GB groß sein (siehe
 * BAND_STORAGE_QUOTA_BYTES), Server Actions sind aber auf
 * next.config.ts serverActions.bodySizeLimit ("30mb") gedeckelt. Liest den
 * Request-Body deshalb direkt gestreamt in eine Temp-Datei statt ueber
 * request.formData() (das puffert den kompletten Body im Speicher).
 */
export async function POST(request: Request) {
  const user = await requireActiveUser();

  if (!request.body) {
    return NextResponse.json({ error: "Keine Datei übermittelt." }, { status: 400 });
  }

  const tempZipPath = path.join(BACKUP_STAGING_ROOT, `upload-${randomUUID()}.zip`);
  await mkdir(path.dirname(tempZipPath), { recursive: true });

  try {
    await pipeline(Readable.fromWeb(request.body as import("stream/web").ReadableStream), createWriteStream(tempZipPath));

    const result = await importBandBackupArchive(tempZipPath, user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BandBackupImportError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Band-Backup-Import fehlgeschlagen:", err);
    return NextResponse.json({ error: "Backup konnte nicht importiert werden." }, { status: 500 });
  } finally {
    // Best-effort: darf ein sonst erfolgreiches Ergebnis nie überschreiben (siehe
    // gleiche Begründung beim Staging-Cleanup in band-backup-import.ts).
    await rm(tempZipPath, { force: true }).catch(() => {});
  }
}
