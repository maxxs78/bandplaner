/**
 * Erstes Modul im Projekt, das externe HTTP-APIs aufruft - folgt der in
 * src/lib/mail.ts etablierten Konvention: Konfiguration aus process.env, "nie
 * werfen, bei fehlender Konfiguration oder Fehler still degradieren", damit
 * ein API-Ausfall das manuelle Anlegen eines Songs nie blockiert.
 */

export type SongMetadataCandidate = {
  title: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  /** MusicBrainz-Recording-ID, nur zur Unterscheidung der Kandidaten im UI. */
  mbid: string;
  /** MusicBrainz-Release-ID, falls vorhanden - Grundlage für den Cover-Abruf. */
  releaseMbid?: string;
  /** Direkter Cover-Link (aktuell nur bei einem Discogs-Fallback-Treffer gesetzt). */
  coverImageUrl?: string;
};

const REFRESHABLE_SONG_FIELDS = ["artist", "album", "genre", "releaseYear", "bpm", "durationSec", "coverUrl"] as const;

/** Prüft, ob für einen Song überhaupt etwas Sinnvolles nachzuladen wäre (siehe refreshSongMetadataAction in actions.ts). */
export function hasRefreshableSongGaps(song: {
  artist?: string | null;
  album?: string | null;
  genre?: string | null;
  releaseYear?: number | null;
  bpm?: number | null;
  durationSec?: number | null;
  coverUrl?: string | null;
}): boolean {
  return REFRESHABLE_SONG_FIELDS.some((field) => !song[field]);
}

function parseYear(dateOrYear: string | undefined | null): number | undefined {
  const match = dateOrYear?.match(/^\d{4}/);
  return match ? Number(match[0]) : undefined;
}

/**
 * MusicBrainz verlangt laut ToS einen identifizierenden User-Agent pro
 * Deployment (Name + Kontakt) - deshalb bewusst kein Default-Wert im Code,
 * sondern zwingend aus der Umgebung. Ohne gesetzten Wert bleibt die
 * Online-Recherche schlicht aus, statt mit einem generischen UA das Risiko
 * einer Sperrung der IP einzugehen.
 */
export async function searchMusicBrainzCandidates(
  title: string,
  artist?: string
): Promise<SongMetadataCandidate[]> {
  const userAgent = process.env.MUSICBRAINZ_USER_AGENT;
  if (!userAgent || !title.trim()) return [];

  try {
    const query = artist?.trim()
      ? `recording:"${title.trim()}" AND artist:"${artist.trim()}"`
      : `recording:"${title.trim()}"`;
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      recordings?: {
        id: string;
        title: string;
        "artist-credit"?: { name: string }[];
        releases?: { id: string; title?: string; date?: string }[];
        tags?: { name: string }[];
      }[];
    };

    return (data.recordings ?? []).slice(0, 5).map((r) => {
      const release = r.releases?.find((rel) => rel.date) ?? r.releases?.[0];
      return {
        title: r.title,
        artist: r["artist-credit"]?.[0]?.name,
        album: release?.title,
        year: parseYear(release?.date),
        genre: r.tags?.[0]?.name,
        mbid: r.id,
        releaseMbid: release?.id,
      };
    });
  } catch {
    return [];
  }
}

const ALLOWED_COVER_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);

/** Cover Art Archive braucht keinen Key; 404 (kein Cover vorhanden) ist der Normalfall, kein Fehler. */
export async function getCoverArt(
  releaseMbid: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    // "-500" liefert eine handliche Vorschaugröße statt des oft mehrere MB großen Originals.
    const res = await fetch(`https://coverartarchive.org/release/${releaseMbid}/front-500`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!ALLOWED_COVER_CONTENT_TYPES.has(mimeType)) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

/**
 * Fallback für Genre/Cover, falls MusicBrainz keine Treffer liefert. Ohne
 * gesetzten Token übersprungen - die Discogs-Suche verlangt einen Personal
 * Access Token für authentifizierte Requests.
 */
export async function searchDiscogsGenre(
  title: string,
  artist?: string
): Promise<{ genre?: string; year?: number; coverImageUrl?: string } | null> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token || !title.trim()) return null;

  try {
    const q = artist?.trim() ? `${artist.trim()} ${title.trim()}` : title.trim();
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Bandplaner-Anlageassistent/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: { genre?: string[]; style?: string[]; year?: number; cover_image?: string }[];
    };
    const first = data.results?.[0];
    if (!first) return null;

    return {
      genre: first.genre?.[0] ?? first.style?.[0],
      year: first.year,
      coverImageUrl: first.cover_image,
    };
  } catch {
    return null;
  }
}

/** Läd Bytes einer per Discogs-Suche gefundenen Cover-URL nach - nur bei aktiver Auswahl aufgerufen. */
export async function fetchRemoteCoverBytes(
  imageUrl: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!ALLOWED_COVER_CONTENT_TYPES.has(mimeType)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

let cachedSpotifyToken: { accessToken: string; expiresAt: number } | null = null;

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedSpotifyToken && cachedSpotifyToken.expiresAt > Date.now()) {
    return cachedSpotifyToken.accessToken;
  }
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedSpotifyToken = {
      accessToken: data.access_token,
      // Etwas fruehzeitiger als das tatsaechliche Ablaufdatum erneuern, um
      // Requests kurz vor Ablauf nicht ins Leere laufen zu lassen.
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedSpotifyToken.accessToken;
  } catch {
    return null;
  }
}

/**
 * Liefert nur den Track-Link, nicht die frueher genutzten Audio-Features -
 * dieser Endpoint ist seit Ende 2024 fuer neue Apps gesperrt, die Search API
 * bleibt aber weiterhin frei nutzbar.
 */
export async function searchSpotifyLink(title: string, artist?: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret || !title.trim()) return null;

  const token = await getSpotifyToken(clientId, clientSecret);
  if (!token) return null;

  try {
    const q = artist?.trim() ? `track:${title.trim()} artist:${artist.trim()}` : title.trim();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      tracks?: { items?: { external_urls?: { spotify?: string } }[] };
    };
    return data.tracks?.items?.[0]?.external_urls?.spotify ?? null;
  } catch {
    return null;
  }
}
