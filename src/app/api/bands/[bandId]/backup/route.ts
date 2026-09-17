import { NextResponse } from "next/server";
import { requireMembership, canManageBand } from "@/lib/access";
import { buildBandBackupArchive } from "@/lib/band-backup-export";

/**
 * Vollstaendiges Backup einer Band (alle Datensaetze + hochgeladene Dateien)
 * als Zip-Download - siehe src/lib/band-backup-export.ts fuer den Inhalt.
 * Eigene Route statt Server Action, da ein Datei-Download mit
 * Content-Disposition darueber nicht moeglich ist (analog profile/export).
 */
export async function GET(request: Request, { params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { stream, filename } = await buildBandBackupArchive(bandId, user.id);

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
