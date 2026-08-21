import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { Card } from "@/components/ui/card";
import { BandFileUpload } from "@/components/band-file-upload";
import { FileList, type FileListItem } from "@/components/file-list";
import { uploadBandFileAction, deleteBandFileAction, updateBandFileAction, bandFileStorageUsage } from "./actions";
import { deleteSongFileAction, updateSongFileAction } from "../songs/actions";
import { BAND_STORAGE_QUOTA_BYTES } from "@/lib/uploads";
import { BAND_FILE_CATEGORIES, getBandFileCategoryLabels } from "@/lib/band-file-categories";
import type { BandFileCategory } from "@/generated/prisma/client";
import clsx from "clsx";

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a"]);

/** Song-Dateien (Audio/PDF/Guitar Pro) haben keine eigene Kategorie - für die zentrale
 * Übersicht werden sie anhand des Dateityps auf Aufnahmen bzw. Noten abgebildet. */
function categoryForSongFile(filename: string): BandFileCategory {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext) ? "RECORDINGS" : "NOTES";
}

export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { bandId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const canUpload = canManageContent(membership.role);
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  const features = getEnabledFeatures(membership.band);
  const { category } = await searchParams;
  const t = await getTranslations("bandFiles");
  const categoryLabels = getBandFileCategoryLabels(t);
  const categoryFilters: { value: BandFileCategory | undefined; label: string }[] = [
    { value: undefined, label: t("filterAll") },
    ...BAND_FILE_CATEGORIES.map((value) => ({ value, label: categoryLabels[value] })),
  ];

  const [bandFiles, songFiles, events, songs, equipment, usedBytes] = await Promise.all([
    prisma.bandFile.findMany({
      where: { bandId, ...(category ? { category: category as BandFileCategory } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
        event: { select: { id: true, title: true } },
        song: { select: { id: true, title: true } },
        equipment: { select: { id: true, name: true } },
      },
    }),
    prisma.songFile.findMany({
      where: {
        song: { bandId },
        ...(isAdmin ? {} : { OR: [{ visibility: "BAND" }, { uploadedById: user.id }] }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
        song: { select: { id: true, title: true, bandId: true } },
      },
    }),
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true },
      take: 50,
    }),
    prisma.song.findMany({
      where: { bandId, status: { notIn: ["PROPOSED", "ARCHIVED"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.equipment.findMany({
      where: equipmentVisibleInBand(bandId),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    bandFileStorageUsage(bandId),
  ]);

  const fromBandFiles: FileListItem[] = bandFiles.map((f) => ({
    id: f.id,
    filename: f.filename,
    size: f.size,
    category: f.category,
    visibility: f.visibility,
    rawVisibility: f.visibility,
    kind: "band" as const,
    shareToken: f.shareToken,
    uploadedBy: f.uploadedBy,
    uploadedById: f.uploadedById,
    songTitle: f.song?.title,
    eventTitle: f.event?.title,
    equipmentName: f.equipment?.name,
    downloadHref: `/api/band-files/${f.id}`,
    deleteAction: deleteBandFileAction.bind(null, bandId, f.id),
    updateAction: updateBandFileAction.bind(null, bandId, f.id),
  }));

  const fromSongFiles: FileListItem[] = songFiles
    .filter((f) => !category || categoryForSongFile(f.filename) === category)
    .map((f) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      category: categoryForSongFile(f.filename),
      visibility: f.visibility === "PRIVATE" ? "PRIVATE" : "INTERNAL",
      rawVisibility: f.visibility,
      kind: "song" as const,
      uploadedBy: f.uploadedBy,
      uploadedById: f.uploadedById,
      songTitle: f.song.title,
      downloadHref: `/api/song-files/${f.id}`,
      deleteAction: deleteSongFileAction.bind(null, bandId, f.song.id, f.id),
      updateAction: updateSongFileAction.bind(null, bandId, f.song.id, f.id),
    }));

  const files = [...fromBandFiles, ...fromSongFiles].sort((a, b) => a.filename.localeCompare(b.filename));

  const usedMb = usedBytes / (1024 * 1024);
  const quotaMb = BAND_STORAGE_QUOTA_BYTES / (1024 * 1024);
  const usedPct = Math.min(100, (usedBytes / BAND_STORAGE_QUOTA_BYTES) * 100);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      <Card className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground">{t("storage")}</span>
          <span className="text-muted">
            {t("storageUsed", { used: usedMb.toFixed(0), quota: quotaMb.toFixed(0) })}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={clsx(
              "h-full rounded-full",
              usedPct > 90 ? "bg-danger" : usedPct > 70 ? "bg-warning" : "bg-primary"
            )}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </Card>

      {canUpload && (
        <Card className="mt-4">
          <h2 className="font-semibold text-foreground">{t("uploadTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("uploadHint")}</p>
          <div className="mt-3">
            <BandFileUpload
              action={uploadBandFileAction.bind(null, bandId)}
              events={events}
              songs={songs}
              equipment={features.equipment ? equipment : undefined}
              publicLinksEnabled={membership.band.publicFileLinksEnabled}
            />
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border p-1">
        {categoryFilters.map((f) => (
          <Link
            key={f.label}
            href={`/bands/${bandId}/files${f.value ? `?category=${f.value}` : ""}`}
          >
            <span
              className={clsx(
                "inline-block rounded-md px-3 py-1 text-sm",
                (category ?? undefined) === f.value ? "bg-primary text-primary-foreground" : "text-muted"
              )}
            >
              {f.label}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <FileList
          files={files}
          currentUserId={user.id}
          isAdmin={isAdmin}
          equipmentEnabled={features.equipment}
          publicLinksEnabled={membership.band.publicFileLinksEnabled}
        />
      </div>
    </div>
  );
}
