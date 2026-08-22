import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

/**
 * Next.js liefert Dateien unter public/, die erst zur Laufzeit (nach dem
 * Build) hinzukommen, im Produktionsmodus ("next start") nicht zuverlaessig
 * aus - das betrifft genau die hier hochgeladenen/nachgeladenen Profil-,
 * Band- und Song-Coverbilder (siehe uploads.ts). Diese Route liest die Datei
 * bei jedem Request frisch von der Platte, statt sich auf Next' impliziten
 * public/-Handler zu verlassen, und wird per rewrites() in next.config.ts
 * transparent unter /uploads/* eingehaengt - bestehende, in der Datenbank
 * gespeicherte "/uploads/..."-URLs (Song.coverUrl, Band.imageUrl, User.image
 * etc.) muessen dafuer nicht angepasst werden.
 */

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  const mimeType = MIME_TYPES[path.extname(segments.at(-1) ?? "").toLowerCase()];
  if (!mimeType) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOADS_ROOT, ...segments);
  // Schutz gegen Pfad-Traversal ("..") - der aufgeloeste Pfad muss innerhalb
  // von public/uploads bleiben.
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileSize),
      // Dateinamen sind zufaellige UUIDs - der Inhalt unter einer gegebenen
      // URL aendert sich nie, langes Caching ist deshalb unbedenklich.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
