import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoredFilePath } from "@/lib/uploads";

/** Öffentlicher, nicht authentifizierter Download - nur für Dateien mit visibility=PUBLIC. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  const bandFile = await prisma.bandFile.findUnique({
    where: { shareToken },
    include: { band: { select: { publicFileLinksEnabled: true } } },
  });
  if (!bandFile || bandFile.visibility !== "PUBLIC" || !bandFile.band.publicFileLinksEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(resolveStoredFilePath(bandFile.storageKey));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": bandFile.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(bandFile.filename)}"`,
      "Content-Length": String(bandFile.size),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
