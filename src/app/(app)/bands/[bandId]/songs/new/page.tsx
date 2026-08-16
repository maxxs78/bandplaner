import { redirect } from "next/navigation";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { createSongAction } from "../actions";
import { SongForm } from "@/components/song-form";
import { Card } from "@/components/ui/card";

export default async function NewSongPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    redirect(`/bands/${bandId}/songs`);
  }
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  const boundAction = createSongAction.bind(null, bandId);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">
        {isAdmin ? "Neuer Song" : "Song vorschlagen"}
      </h1>
      {!isAdmin && (
        <p className="mt-1 text-sm text-muted">
          Dein Vorschlag wird zur Abstimmung gestellt. Stimmen alle zu, wird er automatisch
          übernommen.
        </p>
      )}
      <Card className="mt-4">
        <SongForm
          action={boundAction}
          submitLabel={isAdmin ? "Song anlegen" : "Als Vorschlag einreichen"}
          canEditStatus={isAdmin}
        />
      </Card>
    </div>
  );
}
