"use client";

import { useMemo, useState } from "react";
import { File, FileArchive, FileAudio, FileImage, FileText, FileVideo, Globe, Lock, Users } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FileEditButton } from "@/components/file-edit-button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  bandFileCategoryLabels as categoryLabels,
  bandFileCategoryOptions as BAND_CATEGORY_OPTIONS,
  bandFileVisibilityOptions as BAND_VISIBILITY_OPTIONS,
  songFileVisibilityOptions as SONG_VISIBILITY_OPTIONS,
} from "@/lib/band-file-categories";

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
  /** Tatsächlicher Enum-Wert des zugrundeliegenden Datensatzes (BandFile: INTERNAL/PUBLIC, SongFile: BAND/PRIVATE) */
  rawVisibility: string;
  kind: "band" | "song";
  shareToken?: string;
  uploadedBy: { name: string };
  uploadedById: string;
  songTitle?: string;
  eventTitle?: string;
  equipmentName?: string;
  downloadHref: string;
  deleteAction: () => Promise<void>;
  updateAction?: (data: { filename: string; category?: string; visibility: string }) => Promise<void>;
};

type GroupBy = "none" | "song" | "event" | "equipment";

const NO_LINK_LABEL: Record<GroupBy, string> = {
  none: "",
  song: "Ohne Song-Verknüpfung",
  event: "Ohne Termin-Verknüpfung",
  equipment: "Ohne Equipment-Verknüpfung",
};

function groupValue(file: FileListItem, groupBy: GroupBy): string | undefined {
  if (groupBy === "song") return file.songTitle;
  if (groupBy === "event") return file.eventTitle;
  if (groupBy === "equipment") return file.equipmentName;
  return undefined;
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["mp3", "wav", "ogg", "m4a"].includes(ext ?? "")) return FileAudio;
  if (ext === "mp4") return FileVideo;
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
  equipmentEnabled = true,
  publicLinksEnabled = true,
}: {
  files: FileListItem[];
  currentUserId: string;
  isAdmin: boolean;
  equipmentEnabled?: boolean;
  publicLinksEnabled?: boolean;
}) {
  const bandVisibilityOptions = publicLinksEnabled
    ? BAND_VISIBILITY_OPTIONS
    : BAND_VISIBILITY_OPTIONS.filter((v) => v.value !== "PUBLIC");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return files;
    return files.filter((f) =>
      [f.filename, f.songTitle, f.eventTitle, f.equipmentName, f.uploadedBy.name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query))
    );
  }, [files, search]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, FileListItem[]>();
    for (const file of filtered) {
      const label = groupValue(file, groupBy) ?? NO_LINK_LABEL[groupBy];
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(file);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [filtered, groupBy]);

  function renderFile(file: FileListItem) {
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
            {file.equipmentName && ` · Equipment: ${file.equipmentName}`}
          </p>
        </div>
        {canDelete && file.updateAction && (
          <FileEditButton
            filename={file.filename}
            category={file.kind === "band" ? file.category : undefined}
            categoryOptions={file.kind === "band" ? BAND_CATEGORY_OPTIONS : undefined}
            visibility={file.rawVisibility}
            visibilityOptions={file.kind === "band" ? bandVisibilityOptions : SONG_VISIBILITY_OPTIONS}
            action={file.updateAction}
          />
        )}
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
          title={visibility.title}
        >
          <VisibilityIcon className="h-3 w-3" />
          {visibility.label}
        </span>
        {publicLinksEnabled && file.visibility === "PUBLIC" && file.shareToken && (
          <CopyLinkButton path={`/api/band-files/public/${file.shareToken}`} />
        )}
        {canDelete && (
          <DeleteButton action={file.deleteAction} label="" confirmMessage="Datei wirklich löschen?" />
        )}
      </div>
    );
  }

  return (
    <div>
      {files.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="fileSearch">Suche</Label>
            <Input
              id="fileSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dateiname, Song, Termin, Equipment…"
            />
          </div>
          <div>
            <Label htmlFor="fileGroupBy">Gruppieren nach</Label>
            <Select id="fileGroupBy" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">Keine</option>
              <option value="song">Song</option>
              <option value="event">Termin</option>
              {equipmentEnabled && <option value="equipment">Equipment</option>}
            </Select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {files.length === 0 ? "Keine Dateien gefunden." : "Kein Eintrag entspricht der Suche."}
        </p>
      ) : groups ? (
        <div className="mt-3 space-y-4">
          {groups.map(([label, groupFiles]) => (
            <div key={label}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {label} <span className="font-normal normal-case">({groupFiles.length})</span>
              </h3>
              <div className="space-y-2">{groupFiles.map(renderFile)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">{filtered.map(renderFile)}</div>
      )}
    </div>
  );
}
