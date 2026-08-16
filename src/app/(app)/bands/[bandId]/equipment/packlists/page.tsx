import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { EquipmentSubNav } from "@/components/equipment-sub-nav";
import { NewPacklistForm } from "@/components/new-packlist-form";
import { createPacklistAction } from "../actions";

export default async function PacklistsPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) redirect(`/bands/${bandId}/equipment`);
  const canCreate = canManageContent(membership.role);

  const [packlists, events] = await Promise.all([
    prisma.packlist.findMany({
      where: { bandId },
      include: { event: true, items: { select: { checked: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true },
      take: 50,
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Packlisten</h1>
        <EquipmentSubNav bandId={bandId} active="packlists" />
      </div>

      {canCreate && (
        <Card className="mt-4">
          <h2 className="font-semibold text-foreground">Neue Packliste</h2>
          <div className="mt-3">
            <NewPacklistForm
              action={createPacklistAction.bind(null, bandId)}
              events={events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() }))}
            />
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {packlists.length === 0 && (
          <Card className="text-sm text-muted">Noch keine Packlisten.</Card>
        )}
        {packlists.map((p) => {
          const total = p.items.length;
          const checked = p.items.filter((i) => i.checked).length;
          return (
            <Link key={p.id} href={`/bands/${bandId}/equipment/packlists/${p.id}`}>
              <Card className="flex items-center justify-between transition hover:border-primary">
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-sm text-muted">
                    {total === 0 ? "Keine Einträge" : `${checked} von ${total} gepackt`}
                    {p.event ? ` · verknüpft mit „${p.event.title}“` : ""}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
