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

export type ImageSubdir = "avatars" | "bands";

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
  ".zip",
]);

const MAX_BAND_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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
        "Dateityp nicht erlaubt. Erlaubt: PDF, Word, Excel, Text, Bilder (JPG/PNG/WEBP/GIF), Audio (MP3/WAV/OGG/M4A), ZIP",
    };
  }
  if (file.size > MAX_BAND_FILE_SIZE_BYTES) {
    return { error: "Datei darf maximal 25 MB groß sein" };
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
