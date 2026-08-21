"use client";

import { useMemo, useState } from "react";
import { File, FileArchive, FileAudio, FileImage, FileText, FileVideo, Globe, Lock, Users } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { DeleteButton } from "@/components/delete-button";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FileEditButton } from "@/components/file-edit-button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  getBandFileCategoryLabels,
  getBandFileCategoryOptions,
  getBandFileVisibilityOptions,
  getSongFileVisibilityOptions,
} from "@/lib/band-file-categories";

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
  /** Mehrfachverknuepfung (m:n) - eine Datei kann an mehrere Objekte je Typ gleichzeitig haengen. */
  songs?: { id: string; title: string }[];
  events?: { id: string; title: string }[];
  equipment?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  downloadHref: string;
  deleteAction: () => Promise<void>;
  updateAction?: (data: { filename: string; category?: string; visibility: string }) => Promise<void>;
  /** Nur die Verknüpfung zum aktuellen Kontext lösen (z. B. "von diesem Termin trennen"), ohne die Datei zu löschen. */
  unlinkAction?: () => Promise<void>;
};

type GroupBy = "none" | "song" | "event" | "equipment" | "location";

function groupLabels(file: FileListItem, groupBy: GroupBy): string[] {
  if (groupBy === "song") return (file.songs ?? []).map((s) => s.title);
  if (groupBy === "event") return (file.events ?? []).map((e) => e.title);
  if (groupBy === "equipment") return (file.equipment ?? []).map((e) => e.name);
  if (groupBy === "location") return (file.locations ?? []).map((l) => l.name);
  return [];
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
  locationsEnabled = false,
  publicLinksEnabled = true,
}: {
  files: FileListItem[];
  currentUserId: string;
  isAdmin: boolean;
  equipmentEnabled?: boolean;
  locationsEnabled?: boolean;
  publicLinksEnabled?: boolean;
}) {
  const t = useTranslations("bandFiles");
  const tList = useTranslations("bandFiles.list");
  const tFileUpload = useTranslations("songs.fileUpload");
  const locale = useLocale();
  const categoryLabels = getBandFileCategoryLabels(t);
  const BAND_CATEGORY_OPTIONS = getBandFileCategoryOptions(t);
  const BAND_VISIBILITY_OPTIONS = getBandFileVisibilityOptions(t);
  const songVisibilityOptions = getSongFileVisibilityOptions(tFileUpload);
  const bandVisibilityOptions = publicLinksEnabled
    ? BAND_VISIBILITY_OPTIONS
    : BAND_VISIBILITY_OPTIONS.filter((v) => v.value !== "PUBLIC");
  const visibilityMeta: Record<"PRIVATE" | "INTERNAL" | "PUBLIC", { icon: typeof Lock; label: string; title: string }> = {
    PRIVATE: { icon: Lock, label: tList("visibilityPrivate"), title: tList("visibilityPrivateTitle") },
    INTERNAL: { icon: Users, label: tList("visibilityInternal"), title: tList("visibilityInternalTitle") },
    PUBLIC: { icon: Globe, label: tList("visibilityPublic"), title: tList("visibilityPublicTitle") },
  };
  const NO_LINK_LABEL: Record<GroupBy, string> = {
    none: "",
    song: tList("noSongLink"),
    event: tList("noEventLink"),
    equipment: tList("noEquipmentLink"),
    location: tList("noLocationLink"),
  };
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return files;
    return files.filter((f) =>
      [
        f.filename,
        f.uploadedBy.name,
        ...(f.songs ?? []).map((s) => s.title),
        ...(f.events ?? []).map((e) => e.title),
        ...(f.equipment ?? []).map((e) => e.name),
        ...(f.locations ?? []).map((l) => l.name),
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query))
    );
  }, [files, search]);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, FileListItem[]>();
    for (const file of filtered) {
      const labels = groupLabels(file, groupBy);
      if (labels.length === 0) {
        const label = NO_LINK_LABEL[groupBy];
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(file);
        continue;
      }
      // Eine Datei mit mehreren Verknuepfungen desselben Typs erscheint in jeder passenden Gruppe.
      for (const label of labels) {
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(file);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [filtered, groupBy, NO_LINK_LABEL, locale]);

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
            {(file.songs ?? []).map((s) => (
              <span key={s.id}>{tList("songSuffix", { title: s.title })}</span>
            ))}
            {(file.events ?? []).map((e) => (
              <span key={e.id}>{tList("eventSuffix", { title: e.title })}</span>
            ))}
            {(file.equipment ?? []).map((e) => (
              <span key={e.id}>{tList("equipmentSuffix", { name: e.name })}</span>
            ))}
            {(file.locations ?? []).map((l) => (
              <span key={l.id}>{tList("locationSuffix", { name: l.name })}</span>
            ))}
          </p>
        </div>
        {canDelete && file.updateAction && (
          <FileEditButton
            filename={file.filename}
            category={file.kind === "band" ? file.category : undefined}
            categoryOptions={file.kind === "band" ? BAND_CATEGORY_OPTIONS : undefined}
            visibility={file.rawVisibility}
            visibilityOptions={file.kind === "band" ? bandVisibilityOptions : songVisibilityOptions}
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
        {canDelete && file.unlinkAction && (
          <DeleteButton action={file.unlinkAction} label={tList("unlink")} confirmMessage={tList("unlinkConfirm")} />
        )}
        {canDelete && (
          <DeleteButton action={file.deleteAction} label="" confirmMessage={tList("deleteConfirm")} />
        )}
      </div>
    );
  }

  return (
    <div>
      {files.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="fileSearch">{tList("search")}</Label>
            <Input
              id="fileSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tList("searchPlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="fileGroupBy">{tList("groupBy")}</Label>
            <Select id="fileGroupBy" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="none">{tList("none")}</option>
              <option value="song">{tList("song")}</option>
              <option value="event">{tList("event")}</option>
              {equipmentEnabled && <option value="equipment">{tList("equipment")}</option>}
              {locationsEnabled && <option value="location">{tList("location")}</option>}
            </Select>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {files.length === 0 ? tList("noFilesFound") : tList("noMatchSearch")}
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
