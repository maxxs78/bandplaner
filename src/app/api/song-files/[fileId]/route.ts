import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGuestAccessExpired, canManageBand } from "@/lib/access";
import { resolveStoredFilePath } from "@/lib/uploads";

export async function GET(
  _request: Request,
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

  let buffer: Buffer;
  try {
    buffer = await readFile(resolveStoredFilePath(songFile.storageKey));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": songFile.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(songFile.filename)}"`,
      "Content-Length": String(songFile.size),
      "Cache-Control": "private, no-store",
    },
  });
}
