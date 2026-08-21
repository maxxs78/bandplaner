/**
 * Liest ID3/Vorbis/etc.-Tags direkt aus einer hochgeladenen Datei im Speicher,
 * ohne sie vorher auf Platte zu schreiben - im Unterschied zu
 * extractEmbeddedCover() in uploads.ts, das eine bereits gespeicherte Datei
 * anhand ihres storageKey liest. Dient ausschließlich der Formular-Vorschau
 * beim Anlegen eines Songs (siehe song-form.tsx); das eigentliche Speichern
 * der Datei und ihres Covers passiert erst beim Absenden des Formulars.
 */

const ALLOWED_IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type AudioMetadataPreview = {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  bpm?: number;
  /** data:-URL, direkt als <img src> nutzbar */
  coverDataUrl?: string;
};

/**
 * Gibt null zurück, wenn die Datei nicht lesbar ist oder keine brauchbaren
 * Tags enthält - ein nicht lesbarer Tag darf das Anlegen eines Songs nie
 * blockieren, gleiches Verhalten wie extractEmbeddedCover().
 */
export async function previewAudioMetadata(file: File): Promise<AudioMetadataPreview | null> {
  try {
    // Dynamisch geladen: music-metadata ist ein reines ESM-Paket.
    const { parseBuffer } = await import("music-metadata");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const metadata = await parseBuffer(buffer, file.type || undefined);
    const { common } = metadata;

    const picture = common.picture?.find((p) => /front/i.test(p.type ?? "")) ?? common.picture?.[0];
    let coverDataUrl: string | undefined;
    if (picture) {
      const extension = ALLOWED_IMAGE_MIME_TO_EXT[picture.format];
      if (extension) {
        coverDataUrl = `data:${picture.format};base64,${Buffer.from(picture.data).toString("base64")}`;
      }
    }

    const result: AudioMetadataPreview = {
      title: common.title || undefined,
      artist: common.artist || undefined,
      album: common.album || undefined,
      year: common.year || undefined,
      genre: common.genre?.[0] || undefined,
      bpm: common.bpm ? Math.round(common.bpm) : undefined,
      coverDataUrl,
    };

    const hasAnyValue = Object.values(result).some((v) => v !== undefined);
    return hasAnyValue ? result : null;
  } catch {
    return null;
  }
}
