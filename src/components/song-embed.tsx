import type { StreamingEmbed } from "@/lib/media";

const providerLabels: Record<StreamingEmbed["provider"], string> = {
  youtube: "YouTube",
  spotify: "Spotify",
};

/**
 * Bettet eine verlinkte Streaming-Quelle mit dem offiziellen Player des
 * Anbieters ein. YouTube spielt dabei das Video, Spotify liefert seinen
 * Audio-Player samt eigenem Coverbild.
 *
 * Uebungsfunktionen gibt es hier bewusst nicht - beide Anbieter erlauben keinen
 * Zugriff auf die Audiodaten, Spotify bietet gar keine Tempo-/Tonhoehensteuerung
 * und YouTube kein Transponieren.
 */
export function SongEmbed({ embed, label }: { embed: StreamingEmbed; label: string }) {
  const isYouTube = embed.provider === "youtube";

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">
        {label} · {providerLabels[embed.provider]}
      </p>
      <iframe
        src={embed.embedUrl}
        title={`${providerLabels[embed.provider]}: ${label}`}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
        allowFullScreen={isYouTube}
        referrerPolicy="strict-origin-when-cross-origin"
        className={
          isYouTube
            ? "aspect-video w-full rounded-lg border border-border"
            : "h-[152px] w-full rounded-lg border border-border"
        }
      />
    </div>
  );
}
