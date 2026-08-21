import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { updateEventAction } from "../../actions";
import { EventForm } from "@/components/event-form";
import { Card } from "@/components/ui/card";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ bandId: string; eventId: string }>;
}) {
  const { bandId, eventId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);

  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    include: { participants: true },
  });
  if (!event) notFound();

  const canEdit =
    canManageBandContent(membership.role, isFinanceAdmin) ||
    (canManageContent(membership.role) && event.createdById === user.id);
  if (!canEdit) {
    redirect(`/bands/${bandId}/calendar/${eventId}`);
  }

  const boundAction = updateEventAction.bind(null, bandId, eventId);
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
      <h1 className="text-xl font-semibold text-foreground">{t("editTitle")}</h1>
      <Card className="mt-4">
        <EventForm
          action={boundAction}
          submitLabel={t("editSubmit")}
          members={members}
          currentUserId={user.id}
          locations={features.locations ? locations : undefined}
          defaultValues={{
            title: event.title,
            type: event.type,
            startsAt: format(event.startsAt, "yyyy-MM-dd'T'HH:mm"),
            endsAt: format(event.endsAt, "yyyy-MM-dd'T'HH:mm"),
            location: event.location ?? "",
            locationId: event.locationId ?? undefined,
            description: event.description ?? "",
            participantIds: event.participants.map((p) => p.userId),
          }}
        />
      </Card>
    </div>
  );
}
