import { File, FileArchive, FileAudio, FileImage, FileText, Globe, Lock, Users } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { CopyLinkButton } from "@/components/copy-link-button";

const categoryLabels: Record<string, string> = {
  NOTES: "Noten",
  CONTRACTS: "Verträge",
  PHOTOS: "Fotos",
  RECORDINGS: "Aufnahmen",
  OTHER: "Sonstiges",
};

const visibilityMeta: Record<
  "PRIVATE" | "INTERNAL" | "PUBLIC",
  { icon: typeof Lock; label: string; title: string }
> = {
  PRIVATE: { icon: Lock, label: "Privat", title: "Nur für die hochladende Person (und Admins) sichtbar" },
  INTERNAL: { icon: Users, label: "Intern", title: "Nur bandintern sichtbar" },
  PUBLIC: { icon: Globe, label: "Öffentlich", title: "Öffentlich abrufbar" },
};

export type FileListItem = {
  id: string;
  filename: string;
  size: number;
  category: string;
  visibility: "PRIVATE" | "INTERNAL" | "PUBLIC";
  shareToken?: string;
  uploadedBy: { name: string };
  uploadedById: string;
  songTitle?: string;
  eventTitle?: string;
  downloadHref: string;
  deleteAction: () => Promise<void>;
};

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["mp3", "wav", "ogg", "m4a"].includes(ext ?? "")) return FileAudio;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "")) return FileImage;
  if (ext === "zip") return FileArchive;
  if (["pdf", "doc", "docx", "xls", "xlsx", "txt", "gp", "gp3", "gp4", "gp5", "gpx"].includes(ext ?? ""))
    return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileList({
  files,
  currentUserId,
  isAdmin,
}: {
  files: FileListItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-muted">Keine Dateien gefunden.</p>;
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const Icon = fileIcon(file.filename);
        const canDelete = isAdmin || file.uploadedById === currentUserId;
        const visibility = visibilityMeta[file.visibility];
        const VisibilityIcon = visibility.icon;
        return (
          <div
            key={file.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <Icon className="h-5 w-5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <a
                href={file.downloadHref}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {file.filename}
              </a>
              <p className="truncate text-xs text-muted">
                {categoryLabels[file.category]} · {formatSize(file.size)} · {file.uploadedBy.name}
                {file.songTitle && ` · Song: ${file.songTitle}`}
                {file.eventTitle && ` · Termin: ${file.eventTitle}`}
              </p>
            </div>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
              title={visibility.title}
            >
              <VisibilityIcon className="h-3 w-3" />
              {visibility.label}
            </span>
            {file.visibility === "PUBLIC" && file.shareToken && (
              <CopyLinkButton path={`/api/band-files/public/${file.shareToken}`} />
            )}
            {canDelete && (
              <DeleteButton action={file.deleteAction} label="" confirmMessage="Datei wirklich löschen?" />
            )}
          </div>
        );
      })}
    </div>
  );
}
