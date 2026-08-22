import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  updateSongAction,
  previewAudioMetadataAction,
  searchSongMetadataAction,
  fetchCandidateCoverAction,
} from "../../actions";
import { SongForm } from "@/components/song-form";
import { Card } from "@/components/ui/card";

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ bandId: string; songId: string }>;
}) {
  const { bandId, songId } = await params;
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    redirect(`/bands/${bandId}/songs/${songId}`);
  }
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);

  const song = await prisma.song.findUnique({ where: { id: songId, bandId } });
  if (!song) notFound();

  const boundAction = updateSongAction.bind(null, bandId, songId);
  const t = await getTranslations("songs");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">{t("editTitle")}</h1>
      <Card className="mt-4">
        <SongForm
          action={boundAction}
          submitLabel={t("editSubmit")}
          canEditStatus={isAdmin}
          previewMetadataAction={previewAudioMetadataAction.bind(null, bandId)}
          searchMetadataAction={searchSongMetadataAction.bind(null, bandId)}
          fetchCoverAction={fetchCandidateCoverAction.bind(null, bandId)}
          defaultValues={{
            title: song.title,
            key: song.key ?? "",
            bpm: song.bpm?.toString() ?? "",
            timeSignature: song.timeSignature ?? "",
            durationSec: song.durationSec?.toString() ?? "",
            genre: song.genre ?? "",
            artist: song.artist ?? "",
            album: song.album ?? "",
            releaseYear: song.releaseYear?.toString() ?? "",
            status: song.status,
            lyrics: song.lyrics ?? "",
            remarks: song.remarks ?? "",
          }}
        />
      </Card>
    </div>
  );
}
