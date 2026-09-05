import { FileAudio, FileMusic, FileText, Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { SongAudioPlayer } from "@/components/song-audio-player";
import { isPlayableAudio } from "@/lib/media";
import { DeleteButton } from "@/components/delete-button";
import { FileEditButton } from "@/components/file-edit-button";
import {
  deleteSongFileAction,
  updateSongFileAction,
  savePracticeLoopAction,
  deletePracticeLoopAction,
  updateSongClickSettingsAction,
} from "@/app/(app)/bands/[bandId]/songs/actions";
import type { PracticeLoopItem } from "@/components/practice-player";
import { getSongFileVisibilityOptions } from "@/lib/band-file-categories";

type SongFileItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  visibility: "PRIVATE" | "BAND";
  /** null, wenn das hochladende Konto inzwischen geloescht wurde (siehe deleteAccountAction) - dann ohne jeden Hinweis auf die Person angezeigt. */
  uploadedBy: { name: string } | null;
  uploadedById: string | null;
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
  keyDetectionEnabled,
  songKey,
  songBpm,
  songTimeSignature,
  songCountInBeats,
  songClickOffsetMs,
  canManageSong = false,
  practiceLoops = [],
}: {
  bandId: string;
  songId: string;
  files: SongFileItem[];
  currentUserId: string;
  isAdmin: boolean;
  playerEnabled: boolean;
  keyDetectionEnabled?: boolean;
  songKey?: string | null;
  songBpm?: number | null;
  songTimeSignature?: string | null;
  songCountInBeats?: number | null;
  songClickOffsetMs?: number | null;
  canManageSong?: boolean;
  practiceLoops?: PracticeLoopItem[];
}) {
  const t = useTranslations("songs.fileList");
  const tUpload = useTranslations("songs.fileUpload");
  if (files.length === 0) {
    return <p className="text-sm text-muted">{t("noFiles")}</p>;
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
                visibilityOptions={getSongFileVisibilityOptions(tUpload)}
                action={updateSongFileAction.bind(null, bandId, songId, file.id)}
              />
            )}
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
              title={
                file.uploadedBy
                  ? file.visibility === "PRIVATE"
                    ? t("uploadedByPrivate", { name: file.uploadedBy.name })
                    : t("uploadedByBand", { name: file.uploadedBy.name })
                  : file.visibility === "PRIVATE"
                    ? t("uploadedByPrivateUnknown")
                    : t("uploadedByBandUnknown")
              }
            >
              {file.visibility === "PRIVATE" ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Users className="h-3 w-3" />
              )}
              {file.uploadedBy?.name}
            </span>
            {canDelete && (
              <DeleteButton
                action={deleteSongFileAction.bind(null, bandId, songId, file.id)}
                label=""
                confirmMessage={t("deleteConfirm")}
              />
            )}
          </div>
          {showPlayer && (
            <div className="mt-2">
              <SongAudioPlayer
                src={`/api/song-files/${file.id}`}
                filename={file.filename}
                songKey={songKey}
                songBpm={songBpm}
                bandId={bandId}
                songId={songId}
                keyDetectionEnabled={keyDetectionEnabled}
                timeSignature={songTimeSignature}
                countInBeats={songCountInBeats}
                clickOffsetMs={songClickOffsetMs}
                canManageSong={canManageSong}
                practiceLoops={practiceLoops}
                saveLoopAction={savePracticeLoopAction.bind(null, bandId, songId)}
                deleteLoopAction={deletePracticeLoopAction.bind(null, bandId, songId)}
                saveClickSettingsAction={updateSongClickSettingsAction.bind(null, bandId, songId)}
              />
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}
