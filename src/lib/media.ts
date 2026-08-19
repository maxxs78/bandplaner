/** Vom Browser zuverlaessig abspielbare Audioformate (siehe saveSongFile). */
const PLAYABLE_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a"]);

export function isPlayableAudio(filename: string, mimeType: string) {
  if (mimeType.startsWith("audio/")) return true;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return PLAYABLE_AUDIO_EXTENSIONS.has(extension);
}

export type StreamingEmbed = {
  provider: "youtube" | "spotify";
  /** URL fuer das iframe des jeweiligen offiziellen Players. */
  embedUrl: string;
  /** Zeigt der eingebettete Player selbst ein Bild/Video? Dann kein eigenes Cover noetig. */
  hasOwnArtwork: boolean;
};

/**
 * Erkennt verlinkte Streaming-Quellen und liefert die Einbettungs-URL des
 * jeweiligen offiziellen Players. Bewusst nur die offiziellen Embeds - eigenes
 * Abgreifen der Audiodaten waere bei beiden Anbietern nicht zulaessig.
 *
 * Uebungsfunktionen (Tempo, Transponieren) sind hierueber technisch nicht
 * moeglich: Spotify bietet keinerlei Steuerung dieser Art, YouTube nur feste
 * Geschwindigkeitsstufen und kein Transponieren.
 */
export function detectStreamingEmbed(rawUrl: string): StreamingEmbed | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? youtubeEmbed(id, url) : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? youtubeEmbed(id, url) : null;
    }
    const embedMatch = /^\/(embed|shorts|live)\/([^/]+)/.exec(url.pathname);
    return embedMatch ? youtubeEmbed(embedMatch[2], url) : null;
  }

  if (host === "open.spotify.com") {
    // Auch lokalisierte Pfade wie /intl-de/track/<id> abdecken.
    const match = /^(?:\/intl-[a-z]{2})?\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/.exec(url.pathname);
    if (!match) return null;
    return {
      provider: "spotify",
      embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}`,
      hasOwnArtwork: true,
    };
  }

  return null;
}

function youtubeEmbed(rawId: string, url: URL): StreamingEmbed | null {
  const id = rawId.trim();
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;

  // Startzeit aus ?t=90 bzw. ?start=90 uebernehmen, falls vorhanden.
  const rawStart = url.searchParams.get("start") ?? url.searchParams.get("t");
  const startSeconds = rawStart ? parseInt(rawStart.replace(/[^0-9]/g, ""), 10) : NaN;
  const params = new URLSearchParams({ rel: "0" });
  if (Number.isFinite(startSeconds) && startSeconds > 0) {
    params.set("start", String(startSeconds));
  }

  return {
    // youtube-nocookie: setzt erst bei tatsaechlicher Wiedergabe Tracking-Cookies.
    provider: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`,
    hasOwnArtwork: true,
  };
}
