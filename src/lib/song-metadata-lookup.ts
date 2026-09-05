/**
 * Erstes Modul im Projekt, das externe HTTP-APIs aufruft - folgt der in
 * src/lib/mail.ts etablierten Konvention: Konfiguration aus process.env, "nie
 * werfen, bei fehlender Konfiguration oder Fehler still degradieren", damit
 * ein API-Ausfall das manuelle Anlegen eines Songs nie blockiert.
 */

export type MetadataSource = "musicbrainz" | "discogs" | "spotify";

export type SongMetadataCandidate = {
  /** Eindeutig ueber alle Quellen hinweg (Quelle + native ID), fuer React-Keys und Auswahl. */
  id: string;
  source: MetadataSource;
  title: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  /** MusicBrainz-Release-ID, falls vorhanden - Grundlage fuer den Cover-Abruf ueber das Cover Art Archive. */
  releaseMbid?: string;
  /** Direkter Cover-Link (Discogs/Spotify liefern ihn in der Suchantwort mit). */
  coverImageUrl?: string;
  /** Nur Spotify: Link zum Track, wird als externer Link am Song hinterlegt. */
  spotifyUrl?: string;
  /** Kleine Cover-Vorschau als data:-URL - serverseitig in searchSongMetadataAction nachgeladen. */
  coverThumbDataUrl?: string;
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
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=8`;
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

    return (data.recordings ?? []).slice(0, 6).map((r) => {
      const release = r.releases?.find((rel) => rel.date) ?? r.releases?.[0];
      return {
        id: `musicbrainz:${r.id}`,
        source: "musicbrainz" as const,
        title: r.title,
        artist: r["artist-credit"]?.[0]?.name,
        album: release?.title,
        year: parseYear(release?.date),
        genre: r.tags?.[0]?.name,
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
 * Discogs-Releasesuche. Ohne gesetzten Token uebersprungen - die Suche
 * verlangt einen Personal Access Token fuer authentifizierte Requests.
 * Discogs liefert Genre/Jahr/Cover pro Treffer direkt mit (inkl. einer
 * fertigen Thumbnail-URL), daher kein Extra-Request pro Kandidat noetig.
 */
export async function searchDiscogsCandidates(
  title: string,
  artist?: string
): Promise<SongMetadataCandidate[]> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token || !title.trim()) return [];

  try {
    const q = artist?.trim() ? `${artist.trim()} ${title.trim()}` : title.trim();
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=8&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Bandplaner-Anlageassistent/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: {
        id: number;
        title?: string;
        year?: number;
        genre?: string[];
        style?: string[];
        cover_image?: string;
        thumb?: string;
      }[];
    };

    return (data.results ?? []).slice(0, 6).map((r) => {
      // Discogs liefert den Titel meist als "Interpret - Album".
      const [rawArtist, ...rest] = (r.title ?? "").split(" - ");
      const album = rest.join(" - ").trim() || undefined;
      const cover = r.cover_image && !r.cover_image.endsWith("/spacer.gif") ? r.cover_image : undefined;
      return {
        id: `discogs:${r.id}`,
        source: "discogs" as const,
        title: album ?? title,
        artist: album ? rawArtist.trim() || artist : artist,
        album,
        year: r.year,
        genre: r.genre?.[0] ?? r.style?.[0],
        coverImageUrl: cover,
      };
    });
  } catch {
    return [];
  }
}

/** Ruecklieferung im alten Format (erster Treffer) fuer refreshSongMetadataAction / fetchCandidateCoverAction. */
export async function searchDiscogsGenre(
  title: string,
  artist?: string
): Promise<{ genre?: string; year?: number; coverImageUrl?: string } | null> {
  const first = (await searchDiscogsCandidates(title, artist))[0];
  return first ? { genre: first.genre, year: first.year, coverImageUrl: first.coverImageUrl } : null;
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
 * Spotify-Tracksuche. Keine Audio-Features (dieser Endpoint ist seit Ende
 * 2024 fuer neue Apps gesperrt), aber die Search API bleibt frei nutzbar und
 * liefert Track-Link und Album-Cover pro Treffer direkt mit, kein
 * zusaetzlicher Request pro Kandidat noetig.
 */
export async function searchSpotifyTracks(
  title: string,
  artist?: string
): Promise<SongMetadataCandidate[]> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret || !title.trim()) return [];

  const token = await getSpotifyToken(clientId, clientSecret);
  if (!token) return [];

  try {
    const q = artist?.trim() ? `track:${title.trim()} artist:${artist.trim()}` : title.trim();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=6`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      tracks?: {
        items?: {
          id: string;
          name?: string;
          external_urls?: { spotify?: string };
          artists?: { name: string }[];
          album?: { name?: string; release_date?: string; images?: { url: string }[] };
        }[];
      };
    };

    return (data.tracks?.items ?? [])
      .filter((t) => t.external_urls?.spotify)
      .slice(0, 6)
      .map((t) => {
        // Spotify liefert i. d. R. drei Groessen (640/300/64px), absteigend
        // sortiert - die mittlere reicht als Cover.
        const images = t.album?.images ?? [];
        return {
          id: `spotify:${t.id}`,
          source: "spotify" as const,
          title: t.name ?? title,
          artist: t.artists?.map((a) => a.name).join(", ") || artist,
          album: t.album?.name,
          year: parseYear(t.album?.release_date),
          coverImageUrl: images[1]?.url ?? images[0]?.url,
          spotifyUrl: t.external_urls?.spotify,
        };
      });
  } catch {
    return [];
  }
}

/** Erster Treffer im alten Format fuer refreshSongMetadataAction / fetchCandidateCoverAction. */
export async function searchSpotifyTrack(
  title: string,
  artist?: string
): Promise<{ url: string; coverImageUrl?: string } | null> {
  const first = (await searchSpotifyTracks(title, artist))[0];
  return first?.spotifyUrl ? { url: first.spotifyUrl, coverImageUrl: first.coverImageUrl } : null;
}

/**
 * Kleine Cover-Vorschau als data:-URL fuer die Ergebnisliste. Discogs/Spotify
 * bringen bereits eine Thumbnail-taugliche URL mit; fuer MusicBrainz-Treffer
 * liefert das Cover Art Archive unter "front-250" eine passende Groesse (404
 * = kein Cover, der Normalfall).
 */
export async function fetchCoverThumbDataUrl(candidate: SongMetadataCandidate): Promise<string | null> {
  const url = candidate.releaseMbid
    ? `https://coverartarchive.org/release/${candidate.releaseMbid}/front-250`
    : candidate.coverImageUrl;
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!ALLOWED_COVER_CONTENT_TYPES.has(mimeType)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Grobe Obergrenze - Thumbnails sind klein, alles darueber ist entweder
    // ein Volbild oder unerwuenscht gross fuer die Listen-Antwort.
    if (buf.byteLength > 600_000) return null;
    return `data:${mimeType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
