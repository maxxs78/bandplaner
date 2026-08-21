import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type ImageSubdir = "avatars" | "bands" | "songs";

export async function saveUploadedImage(
  file: File,
  subdir: ImageSubdir
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    return { error: "Nur JPG, PNG, WEBP oder GIF sind erlaubt" };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Datei darf maximal 5 MB groß sein" };
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type];
  const filename = `${randomUUID()}.${extension}`;
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return { url: `/uploads/${subdir}/${filename}` };
}

/**
 * Legt ein extern beschafftes Bild (z. B. Cover Art Archive/Discogs bei der
 * Song-Metadaten-Recherche, siehe song-metadata-lookup.ts) lokal ab, statt es
 * per Hotlink direkt einzubinden - gleiche Validierung/Größenprüfung wie
 * saveUploadedImage, nur mit Bytes+MIME-Type statt File als Quelle.
 */
export async function storeRemoteImage(
  bytes: Uint8Array,
  mimeType: string,
  subdir: ImageSubdir
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES[mimeType]) {
    return { error: "Nur JPG, PNG, WEBP oder GIF sind erlaubt" };
  }
  if (bytes.length > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Datei darf maximal 5 MB groß sein" };
  }

  const extension = ALLOWED_IMAGE_TYPES[mimeType];
  const filename = `${randomUUID()}.${extension}`;
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(bytes));

  return { url: `/uploads/${subdir}/${filename}` };
}

const ALLOWED_SONG_FILE_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".pdf",
  ".gp",
  ".gp3",
  ".gp4",
  ".gp5",
  ".gpx",
]);

const MAX_SONG_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Außerhalb von /public, damit private Dateien nicht direkt per URL abrufbar sind -
// der Zugriff läuft ausschließlich über die geschützte Download-Route.
const PRIVATE_STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function saveSongFile(
  file: File
): Promise<
  | { storageKey: string; filename: string; mimeType: string; size: number }
  | { error: string }
> {
  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_SONG_FILE_EXTENSIONS.has(extension)) {
    return {
      error:
        "Dateityp nicht erlaubt. Erlaubt: MP3, WAV, OGG, M4A, PDF, Guitar Pro (.gp, .gp3, .gp4, .gp5, .gpx)",
    };
  }
  if (file.size > MAX_SONG_FILE_SIZE_BYTES) {
    return { error: "Datei darf maximal 25 MB groß sein" };
  }

  const storedFilename = `${randomUUID()}${extension}`;
  const dir = path.join(PRIVATE_STORAGE_ROOT, "song-files");
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedFilename), buffer);

  return {
    storageKey: `song-files/${storedFilename}`,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

const ALLOWED_BAND_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".mp4",
  ".zip",
]);

// 200 MB statt 25 MB, da mit MP4-Unterstützung auch kurze Video-Mitschnitte hierüber laufen -
// bei 25 MB wäre die Video-Kategorie in der Praxis kaum nutzbar gewesen.
const MAX_BAND_FILE_SIZE_BYTES = 200 * 1024 * 1024;

/** Speicherkontingent pro Band für den zentralen Dateispeicher (BandFile + SongFile zusammen). */
export const BAND_STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export async function saveBandFile(
  file: File
): Promise<
  | { storageKey: string; filename: string; mimeType: string; size: number }
  | { error: string }
> {
  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_BAND_FILE_EXTENSIONS.has(extension)) {
    return {
      error:
        "Dateityp nicht erlaubt. Erlaubt: PDF, Word, Excel, Text, Bilder (JPG/PNG/WEBP/GIF), Audio (MP3/WAV/OGG/M4A), Video (MP4), ZIP",
    };
  }
  if (file.size > MAX_BAND_FILE_SIZE_BYTES) {
    return { error: "Datei darf maximal 200 MB groß sein" };
  }

  const storedFilename = `${randomUUID()}${extension}`;
  const dir = path.join(PRIVATE_STORAGE_ROOT, "band-files");
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedFilename), buffer);

  return {
    storageKey: `band-files/${storedFilename}`,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}

/**
 * Liest ein eingebettetes Coverbild aus den Metadaten einer Audiodatei (ID3v2
 * APIC bei MP3, entsprechende Felder bei M4A/OGG/FLAC) und legt es als Bild ab.
 * Gibt null zurueck, wenn die Datei kein Bild enthaelt oder nicht lesbar ist -
 * ein fehlendes Cover ist kein Fehler, der den Upload scheitern lassen darf.
 */
export async function extractEmbeddedCover(storageKey: string): Promise<string | null> {
  try {
    // Dynamisch geladen: music-metadata ist ein reines ESM-Paket.
    const { parseFile } = await import("music-metadata");
    const metadata = await parseFile(resolveStoredFilePath(storageKey));

    const picture = metadata.common.picture?.find((p) => /front/i.test(p.type ?? "")) ??
      metadata.common.picture?.[0];
    if (!picture) return null;

    const extension = ALLOWED_IMAGE_TYPES[picture.format];
    if (!extension) return null;
    if (picture.data.length > MAX_IMAGE_SIZE_BYTES) return null;

    const filename = `${randomUUID()}.${extension}`;
    const dir = path.join(process.cwd(), "public", "uploads", "songs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(picture.data));

    return `/uploads/songs/${filename}`;
  } catch {
    return null;
  }
}

export function resolveStoredFilePath(storageKey: string) {
  return path.join(PRIVATE_STORAGE_ROOT, storageKey);
}

export async function deleteStoredFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  try {
    await unlink(path.join(PRIVATE_STORAGE_ROOT, storageKey));
  } catch {
    // file may already be gone; ignore
  }
}

export async function deleteUploadedFile(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(process.cwd(), "public", url);
  try {
    await unlink(filePath);
  } catch {
    // file may already be gone; ignore
  }
}
