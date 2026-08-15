import { redirect } from "next/navigation";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { createSetlistAction } from "../actions";
import { Card } from "@/components/ui/card";
import { NewSetlistForm } from "@/components/new-setlist-form";

export default async function NewSetlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) {
    redirect(`/bands/${bandId}/setlists`);
  }
  const { eventId } = await searchParams;

  const [events, setlists] = await Promise.all([
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.setlist.findMany({ where: { bandId }, orderBy: { createdAt: "desc" } }),
  ]);

  const boundAction = createSetlistAction.bind(null, bandId);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-foreground">Neue Setlist</h1>
      <Card className="mt-4">
        <NewSetlistForm
          action={boundAction}
          events={events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.toISOString() }))}
          setlists={setlists.map((s) => ({ id: s.id, name: s.name }))}
          defaultEventId={eventId}
        />
      </Card>
    </div>
  );
}
