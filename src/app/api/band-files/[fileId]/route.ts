import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGuestAccessExpired } from "@/lib/access";
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

  const bandFile = await prisma.bandFile.findUnique({ where: { id: fileId } });
  if (!bandFile) {
    return new NextResponse("Not found", { status: 404 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_bandId: { userId: session.user.id, bandId: bandFile.bandId } },
  });
  if (!membership || isGuestAccessExpired(membership)) {
    return new NextResponse("Forbidden", { status: 403 });
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
      "Cache-Control": "private, no-store",
    },
  });
}
