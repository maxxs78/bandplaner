import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { EquipmentSubNav } from "@/components/equipment-sub-nav";
import { NewPacklistForm } from "@/components/new-packlist-form";
import { createPacklistAction } from "../actions";

export default async function PacklistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) redirect(`/bands/${bandId}/equipment`);
  const canCreate = canManageContent(membership.role);
  const { eventId } = await searchParams;
  const t = await getTranslations("packlists");

  const [packlists, events] = await Promise.all([
    prisma.packlist.findMany({
      where: { bandId },
      include: { events: true, items: { select: { checked: true } } },
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
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <EquipmentSubNav bandId={bandId} active="packlists" />
      </div>

      {canCreate && (
        <Card className="mt-4">
          <h2 className="font-semibold text-foreground">{t("newTitle")}</h2>
          <div className="mt-3">
            <NewPacklistForm
              action={createPacklistAction.bind(null, bandId)}
              events={events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() }))}
              defaultEventId={eventId}
            />
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {packlists.length === 0 && (
          <Card className="text-sm text-muted">{t("noPacklists")}</Card>
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
                    {total === 0 ? t("noEntries") : t("packedOf", { checked, total })}
                    {p.events.length > 0 ? t("linkedWith", { title: p.events.map((e) => e.title).join(", ") }) : ""}
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
