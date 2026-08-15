import { redirect } from "next/navigation";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
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

  const memberships = await prisma.membership.findMany({
    where: { bandId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const members = memberships.map((m) => m.user);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Neuer Termin</h1>
      <Card className="mt-4">
        <EventForm
          action={boundAction}
          submitLabel="Termin erstellen"
          allowRepeat
          members={members}
          currentUserId={user.id}
        />
      </Card>
    </div>
  );
}
