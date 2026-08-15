import { notFound, redirect } from "next/navigation";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { updateSongAction } from "../../actions";
import { SongForm } from "@/components/song-form";
import { Card } from "@/components/ui/card";

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ bandId: string; songId: string }>;
}) {
  const { bandId, songId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    redirect(`/bands/${bandId}/songs/${songId}`);
  }
  const isAdmin = canManageBand(membership.role);

  const song = await prisma.song.findUnique({ where: { id: songId, bandId } });
  if (!song) notFound();

  const boundAction = updateSongAction.bind(null, bandId, songId);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Song bearbeiten</h1>
      <Card className="mt-4">
        <SongForm
          action={boundAction}
          submitLabel="Änderungen speichern"
          canEditStatus={isAdmin}
          defaultValues={{
            title: song.title,
            key: song.key ?? "",
            bpm: song.bpm?.toString() ?? "",
            timeSignature: song.timeSignature ?? "",
            durationSec: song.durationSec?.toString() ?? "",
            genre: song.genre ?? "",
            artist: song.artist ?? "",
            status: song.status,
            lyrics: song.lyrics ?? "",
            remarks: song.remarks ?? "",
          }}
        />
      </Card>
    </div>
  );
}
