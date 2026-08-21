import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { createEventAction } from "../actions";
import { EventForm } from "@/components/event-form";
import { Card } from "@/components/ui/card";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    redirect(`/bands/${bandId}/calendar`);
  }
  const boundAction = createEventAction.bind(null, bandId);
  const features = getEnabledFeatures(membership.band);

  const [memberships, locations] = await Promise.all([
    prisma.membership.findMany({
      where: { bandId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    features.locations
      ? prisma.location.findMany({ where: { bandId }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const members = memberships.map((m) => m.user);
  const t = await getTranslations("calendar");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">{t("newTitle")}</h1>
      <Card className="mt-4">
        <EventForm
          action={boundAction}
          submitLabel={t("createSubmit")}
          allowRepeat
          members={members}
          currentUserId={user.id}
          locations={features.locations ? locations : undefined}
        />
      </Card>
    </div>
  );
}
