import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { SongList } from "@/components/song-list";
import clsx from "clsx";
import type { SongStatus } from "@/generated/prisma/client";

const statusVariant: Record<string, "warning" | "accent" | "success" | "default" | "danger"> = {
  PROPOSED: "warning",
  NEW: "accent",
  IN_PROGRESS: "warning",
  STAGE_READY: "accent",
  ACTIVE: "success",
  ARCHIVED: "default",
};

export default async function SongsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { bandId } = await params;
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  const canCreate = canManageContent(membership.role);
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  const { status } = await searchParams;
  const t = await getTranslations("songs");

  const songs = await prisma.song.findMany({
    where: {
      bandId,
      // Bei "Alle" werden archivierte Songs ausgeblendet - dafür gibt es den eigenen Filter "Archiviert".
      ...(status ? { status: status as SongStatus } : { status: { not: "ARCHIVED" } }),
    },
    orderBy: { title: "asc" },
  });

  const filters = [
    { value: undefined, label: t("filterAll") },
    { value: "PROPOSED", label: t("filterProposed") },
    { value: "NEW", label: t("statusLabels.NEW") },
    { value: "IN_PROGRESS", label: t("statusLabels.IN_PROGRESS") },
    { value: "STAGE_READY", label: t("statusLabels.STAGE_READY") },
    { value: "ACTIVE", label: t("statusLabels.ACTIVE") },
    { value: "ARCHIVED", label: t("statusLabels.ARCHIVED") },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={`/bands/${bandId}/songs${f.value ? `?status=${f.value}` : ""}`}
            >
              <span
                className={clsx(
                  "inline-block rounded-md px-3 py-1 text-sm",
                  (status ?? undefined) === f.value ? "bg-primary text-primary-foreground" : "text-muted"
                )}
              >
                {f.label}
              </span>
            </Link>
          ))}
        </div>
        {canCreate && (
          <Link href={`/bands/${bandId}/songs/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {isAdmin ? t("newButton") : t("proposeButton")}
            </Button>
          </Link>
        )}
      </div>

      <SongList
        bandId={bandId}
        songs={songs.map((song) => ({
          id: song.id,
          title: song.title,
          coverUrl: song.coverUrl,
          subtitle:
            [song.artist, song.key, song.bpm ? `${song.bpm} BPM` : null, song.genre]
              .filter(Boolean)
              .join(" · ") || t("noFurtherInfo"),
          statusLabel: t(`statusLabels.${song.status}`),
          statusVariant: statusVariant[song.status],
          rejected: song.rejected && song.status === "ARCHIVED",
        }))}
        noSongsFoundText={t("noSongsFound")}
        rejectedBadgeText={t("rejectedBadge")}
        listViewLabel={t("listView")}
        gridViewLabel={t("gridView")}
      />
    </div>
  );
}
