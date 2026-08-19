import { FileAudio, FileMusic, FileText, Lock, Users } from "lucide-react";
import { SongAudioPlayer } from "@/components/song-audio-player";
import { isPlayableAudio } from "@/lib/media";
import { DeleteButton } from "@/components/delete-button";
import { FileEditButton } from "@/components/file-edit-button";
import { deleteSongFileAction, updateSongFileAction } from "@/app/(app)/bands/[bandId]/songs/actions";
import { songFileVisibilityOptions as SONG_VISIBILITY_OPTIONS } from "@/lib/band-file-categories";

type SongFileItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  visibility: "PRIVATE" | "BAND";
  uploadedBy: { name: string };
  uploadedById: string;
};

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["mp3", "wav", "ogg", "m4a"].includes(ext ?? "")) return FileAudio;
  if (ext === "pdf") return FileText;
  return FileMusic;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SongFileList({
  bandId,
  songId,
  files,
  currentUserId,
  isAdmin,
  playerEnabled,
}: {
  bandId: string;
  songId: string;
  files: SongFileItem[];
  currentUserId: string;
  isAdmin: boolean;
  playerEnabled: boolean;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-muted">Noch keine Dateien hochgeladen.</p>;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const Icon = fileIcon(file.filename);
        const canDelete = isAdmin || file.uploadedById === currentUserId;
        const showPlayer = playerEnabled && isPlayableAudio(file.filename, file.mimeType);
        return (
          <div key={file.id} className="rounded-lg border border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <Icon className="h-5 w-5 shrink-0 text-muted" />
            <a
              href={`/api/song-files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              {file.filename}
            </a>
            <span className="shrink-0 text-xs text-muted">{formatSize(file.size)}</span>
            {canDelete && (
              <FileEditButton
                filename={file.filename}
                visibility={file.visibility}
                visibilityOptions={SONG_VISIBILITY_OPTIONS}
                action={updateSongFileAction.bind(null, bandId, songId, file.id)}
              />
            )}
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
              title={
                file.visibility === "PRIVATE"
                  ? `Privat · hochgeladen von ${file.uploadedBy.name}`
                  : `Für die Band sichtbar · hochgeladen von ${file.uploadedBy.name}`
              }
            >
              {file.visibility === "PRIVATE" ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {file.uploadedBy.name}
            </span>
            {canDelete && (
              <DeleteButton
                action={deleteSongFileAction.bind(null, bandId, songId, file.id)}
                label=""
                confirmMessage="Datei wirklich löschen?"
              />
            )}
          </div>
          {showPlayer && (
            <div className="mt-2">
              <SongAudioPlayer src={`/api/song-files/${file.id}`} filename={file.filename} />
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}
