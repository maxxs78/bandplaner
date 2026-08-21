import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("songs");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">
        {isAdmin ? t("newTitle") : t("proposeTitle")}
      </h1>
      {!isAdmin && (
        <p className="mt-1 text-sm text-muted">{t("proposalNotice")}</p>
      )}
      <Card className="mt-4">
        <SongForm
          action={boundAction}
          submitLabel={isAdmin ? t("createSubmit") : t("proposeSubmit")}
          canEditStatus={isAdmin}
        />
      </Card>
    </div>
  );
}
