import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGuestAccessExpired, canManageBand } from "@/lib/access";
import { resolveStoredFilePath } from "@/lib/uploads";

/**
 * Liefert eine Song-Datei aus. Unterstuetzt HTTP-Range-Requests (206), damit im
 * Medienplayer gesprungen werden kann - ohne das laedt der Browser bei jedem
 * Sprung die komplette Datei neu oder kann gar nicht erst spulen. Ausgeliefert
 * wird gestreamt statt komplett in den Speicher geladen, damit auch grosse
 * Audiodateien den Server nicht belasten.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const songFile = await prisma.songFile.findUnique({
    where: { id: fileId },
    include: { song: { select: { bandId: true } } },
  });
  if (!songFile) {
    return new NextResponse("Not found", { status: 404 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId: songFile.song.bandId } },
  });
  if (!membership || isGuestAccessExpired(membership)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const isAdmin = canManageBand(membership.role);
  const isOwner = songFile.uploadedById === session.user.id;
  if (songFile.visibility === "PRIVATE" && !isAdmin && !isOwner) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = resolveStoredFilePath(songFile.storageKey);
  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": songFile.mimeType,
    "Content-Disposition": `inline; filename="${encodeURIComponent(songFile.filename)}"`,
    "Accept-Ranges": "bytes",
    // Privat, aber im Browser-Cache erlaubt: sonst laedt der Player die Datei
    // bei jedem Spulvorgang komplett neu.
    "Cache-Control": "private, max-age=3600",
  };

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    // Suffix-Form ("bytes=-500") liefert die letzten n Bytes.
    const start = match[1] === "" ? Math.max(fileSize - Number(match[2]), 0) : Number(match[1]);
    const end = match[1] === "" || match[2] === "" ? fileSize - 1 : Number(match[2]);

    if (start >= fileSize || end < start) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const cappedEnd = Math.min(end, fileSize - 1);
    const stream = createReadStream(filePath, { start, end: cappedEnd });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${cappedEnd}/${fileSize}`,
        "Content-Length": String(cappedEnd - start + 1),
      },
    });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: { ...baseHeaders, "Content-Length": String(fileSize) },
  });
}
