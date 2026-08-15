import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { updateEventAction } from "../../actions";
import { EventForm } from "@/components/event-form";
import { Card } from "@/components/ui/card";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ bandId: string; eventId: string }>;
}) {
  const { bandId, eventId } = await params;
  const { user, membership } = await requireMembership(bandId);

  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    include: { participants: true },
  });
  if (!event) notFound();

  const canEdit =
    canManageBand(membership.role) ||
    (canManageContent(membership.role) && event.createdById === user.id);
  if (!canEdit) {
    redirect(`/bands/${bandId}/calendar/${eventId}`);
  }

  const boundAction = updateEventAction.bind(null, bandId, eventId);

  const memberships = await prisma.membership.findMany({
    where: { bandId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const members = memberships.map((m) => m.user);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Termin bearbeiten</h1>
      <Card className="mt-4">
        <EventForm
          action={boundAction}
          submitLabel="Änderungen speichern"
          members={members}
          currentUserId={user.id}
          defaultValues={{
            title: event.title,
            type: event.type,
            startsAt: format(event.startsAt, "yyyy-MM-dd'T'HH:mm"),
            endsAt: format(event.endsAt, "yyyy-MM-dd'T'HH:mm"),
            location: event.location ?? "",
            description: event.description ?? "",
            participantIds: event.participants.map((p) => p.userId),
          }}
        />
      </Card>
    </div>
  );
}
