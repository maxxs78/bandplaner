import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { PacklistBuilder } from "@/components/packlist-builder";
import { EventContextSelector } from "@/components/event-context-selector";
import { Card } from "@/components/ui/card";
import {
  deletePacklistAction,
  removePacklistItemAction,
  togglePacklistItemAction,
  assignPacklistItemAction,
  addPacklistEquipmentAction,
  addPacklistCustomItemAction,
} from "../../actions";

export default async function PacklistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string; packlistId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { bandId, packlistId } = await params;
  const { eventId: requestedEventId } = await searchParams;
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) redirect(`/bands/${bandId}`);
  const canManage = canManageContent(membership.role);
  const t = await getTranslations("packlists.detail");

  const packlist = await prisma.packlist.findUnique({
    where: { id: packlistId, bandId },
    include: {
      events: { orderBy: { startsAt: "asc" } },
      items: {
        orderBy: { order: "asc" },
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              location: true,
              ownerUser: { select: { id: true, name: true } },
            },
          },
          assignedTo: { select: { id: true, name: true } },
          eventStatuses: { include: { assignedTo: { select: { id: true, name: true } } } },
        },
      },
      // Unbeschraenkt nach Termin gefetcht (kleine Menge) - Auswahl per
      // activeEventId erst weiter unten, sobald der Termin-Kontext feststeht.
      eventSnapshots: true,
    },
  });
  if (!packlist) notFound();

  // Termin-Kontext: explizite Auswahl aus der URL, sonst der naechste anstehende
  // verknuepfte Termin, sonst terminlos (siehe EventContextSelector).
  const linkedEventIds = new Set(packlist.events.map((e) => e.id));
  const now = new Date();
  const upcomingEvent = packlist.events.find((e) => e.startsAt >= now);
  const activeEventId =
    requestedEventId === "none"
      ? null
      : requestedEventId && linkedEventIds.has(requestedEventId)
        ? requestedEventId
        : (upcomingEvent?.id ?? null);
  const activeEvent = activeEventId ? packlist.events.find((e) => e.id === activeEventId) : null;
  // Eingefrorener "wie gepackt"-Stand statt der Live-Liste, sobald der aktive
  // Termin vergangen ist und bereits eine Aenderung danach eingefroren wurde
  // (siehe freezePastPacklistSnapshotsIfNeeded in ../../actions.ts).
  const isPastActiveEvent = Boolean(activeEvent && activeEvent.startsAt < now);
  const frozenSnapshot = activeEventId
    ? packlist.eventSnapshots.find((s) => s.eventId === activeEventId)
    : undefined;
  const frozenItems: { name: string; checked: boolean; assignedToName: string | null }[] | null = frozenSnapshot
    ? JSON.parse(frozenSnapshot.itemsJson)
    : null;

  const [catalog, memberships] = await Promise.all([
    prisma.equipment.findMany({
      where: equipmentVisibleInBand(bandId),
      orderBy: { name: "asc" },
      include: { ownerUser: { select: { id: true, name: true } } },
    }),
    prisma.membership.findMany({
      where: { bandId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const members = memberships.map((m) => m.user);
  const catalogEquipment = catalog.map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
    owner: e.ownerUser ? { id: e.ownerUser.id, name: e.ownerUser.name } : null,
  }));
  const items = packlist.items.map((item) => {
    const eventStatus = activeEventId ? item.eventStatuses.find((s) => s.eventId === activeEventId) : null;
    return {
      ...item,
      checked: activeEventId ? (eventStatus?.checked ?? false) : item.checked,
      assignedTo: activeEventId ? (eventStatus?.assignedTo ?? null) : item.assignedTo,
      equipment: item.equipment
        ? {
            id: item.equipment.id,
            name: item.equipment.name,
            location: item.equipment.location,
            owner: item.equipment.ownerUser,
          }
        : null,
    };
  });

  return (
    <div>
      <div>
        <Link
          href={`/bands/${bandId}/equipment/packlists`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToPacklists")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{packlist.name}</h1>
            {packlist.events.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                {t("linkedWithPrefix")}{" "}
                {packlist.events.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ", "}
                    <Link href={`/bands/${bandId}/calendar/${e.id}`} className="text-primary hover:underline">
                      {e.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {canManage && packlist.events.length > 0 && (
              <p className="mt-1 text-xs text-muted">{t("sharedListHint")}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/print/packlists/${packlistId}`} target="_blank">
              <Button variant="secondary" size="sm">
                <FileDown className="h-4 w-4" />
                {t("print")}
              </Button>
            </Link>
            {canManage && (
              <DeleteButton action={deletePacklistAction.bind(null, bandId, packlistId)} label={t("delete")} />
            )}
          </div>
        </div>
      </div>

      {packlist.events.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-foreground">{t("eventContextLabel")}</h2>
          <p className="mt-1 text-xs text-muted">{t("eventContextHint")}</p>
          <div className="mt-2">
            <EventContextSelector
              events={packlist.events}
              activeEventId={activeEventId}
              noEventLabel={t("noEventContext")}
              basePath={`/bands/${bandId}/equipment/packlists/${packlistId}`}
            />
          </div>
        </Card>
      )}

      <div className="mt-6">
        {frozenItems ? (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{t("frozenTitle")}</h2>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                {t("frozenBadge")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{t("frozenHint")}</p>
            <div className="mt-3 space-y-1.5">
              {frozenItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${item.checked ? "border-success bg-success text-white" : "border-border"}`}
                  >
                    {item.checked && "✓"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                  {item.assignedToName && (
                    <span className="shrink-0 text-xs text-muted">{item.assignedToName}</span>
                  )}
                </div>
              ))}
              {frozenItems.length === 0 && <p className="text-sm text-muted">{t("printEmpty")}</p>}
            </div>
          </Card>
        ) : (
          <PacklistBuilder
            key={`${items.map((i) => i.id).join(",")}-${activeEventId ?? "none"}`}
            initialItems={items}
            catalogEquipment={catalogEquipment}
            members={members}
            readOnly={!canManage || isPastActiveEvent}
            onToggle={async (itemId, checked) => {
              "use server";
              await togglePacklistItemAction(bandId, packlistId, itemId, activeEventId, checked);
            }}
            onAssign={async (itemId, userId) => {
              "use server";
              await assignPacklistItemAction(bandId, packlistId, itemId, activeEventId, userId);
            }}
            onRemove={async (itemId) => {
              "use server";
              await removePacklistItemAction(bandId, packlistId, itemId);
            }}
            onAddEquipment={async (equipmentId) => {
              "use server";
              await addPacklistEquipmentAction(bandId, packlistId, equipmentId);
            }}
            onAddCustom={async (formData) => {
              "use server";
              await addPacklistCustomItemAction(bandId, packlistId, formData);
            }}
          />
        )}
      </div>
    </div>
  );
}
