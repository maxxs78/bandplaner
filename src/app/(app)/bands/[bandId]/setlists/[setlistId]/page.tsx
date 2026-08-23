import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Printer, Save, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { SetlistBuilder } from "@/components/setlist-builder";
import { EventContextSelector } from "@/components/event-context-selector";
import { EquipmentIconDisplaySelector } from "@/components/equipment-icon-display-selector";
import { computeSetlistNumbers, totalSetlistDurationSec, formatSetlistAsText, type SetlistDisplayItem } from "@/lib/setlist-items";
import { deleteSetlistAction, saveSetlistNoteAction, saveEquipmentIconDisplayAction, saveSetlistTechNotesAction } from "../actions";
import { DeleteButton } from "@/components/delete-button";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

export default async function SetlistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string; setlistId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { bandId, setlistId } = await params;
  const { eventId: requestedEventId } = await searchParams;
  const { user, membership } = await requireMembership(bandId);
  const canManage = canManageContent(membership.role);
  const features = getEnabledFeatures(membership.band);
  const t = await getTranslations("setlists.detail");

  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId, bandId },
    include: {
      events: { orderBy: { startsAt: "asc" } },
      items: {
        orderBy: { order: "asc" },
        include: {
          song: true,
          annotations: { where: { userId: user.id } },
          eventAnnotations: { where: { userId: user.id } },
        },
      },
      notes: { where: { userId: user.id } },
      eventNotes: { where: { userId: user.id } },
      // Unbescheidet nach Termin gefetcht (kleine Menge) - Auswahl per
      // activeEventId erst weiter unten, sobald der Termin-Kontext feststeht.
      eventSnapshots: true,
    },
  });
  if (!setlist) notFound();

  const songs = await prisma.song.findMany({
    where: { bandId, status: { notIn: ["PROPOSED", "ARCHIVED"] } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, key: true, bpm: true, status: true },
  });

  const equipmentOptions = features.equipment
    ? await prisma.equipment.findMany({
        where: equipmentVisibleInBand(bandId),
        orderBy: { name: "asc" },
        select: { id: true, name: true, icon: true, color: true, category: true },
      })
    : [];

  // Termin-Kontext: explizite Auswahl aus der URL, sonst der naechste anstehende
  // verknuepfte Termin, sonst terminlos (siehe EventContextSelector).
  const linkedEventIds = new Set(setlist.events.map((e) => e.id));
  const now = new Date();
  const upcomingEvent = setlist.events.find((e) => e.startsAt >= now);
  const activeEventId =
    requestedEventId === "none"
      ? null
      : requestedEventId && linkedEventIds.has(requestedEventId)
        ? requestedEventId
        : (upcomingEvent?.id ?? null);
  const activeEvent = activeEventId ? setlist.events.find((e) => e.id === activeEventId) : null;
  // Eingefrorener "wie gespielt"-Stand statt der Live-Liste, sobald der aktive
  // Termin vergangen ist und bereits eine Aenderung danach eingefroren wurde
  // (siehe freezePastSetlistSnapshotsIfNeeded in ../actions.ts). Ohne Snapshot
  // stimmt die Live-Liste noch exakt mit dem Stand beim Termin ueberein.
  const isPastActiveEvent = Boolean(activeEvent && activeEvent.startsAt < now);
  const frozenSnapshot = activeEventId
    ? setlist.eventSnapshots.find((s) => s.eventId === activeEventId)
    : undefined;
  const frozenItems: SetlistDisplayItem[] | null = frozenSnapshot ? JSON.parse(frozenSnapshot.itemsJson) : null;
  const frozenNumbers = frozenItems ? computeSetlistNumbers(frozenItems) : [];

  const myNote = activeEventId
    ? (setlist.eventNotes.find((n) => n.eventId === activeEventId)?.content ?? "")
    : (setlist.notes[0]?.content ?? "");
  const items = setlist.items.map((item) => ({
    ...item,
    myAnnotation: activeEventId
      ? (item.eventAnnotations.find((a) => a.eventId === activeEventId) ?? null)
      : (item.annotations[0] ?? null),
  }));

  const displayItems: SetlistDisplayItem[] =
    frozenItems ??
    setlist.items.map((item) => ({
      kind: item.kind,
      title: item.song?.title ?? item.customTitle ?? "",
      key: item.song?.key ?? null,
      bpm: item.song?.bpm ?? null,
      durationSec: item.song?.durationSec ?? item.durationSec ?? null,
      excludeFromNumbering: item.excludeFromNumbering,
    }));

  const shareText = [
    `${membership.band.name} – ${setlist.name}`,
    activeEvent ? activeEvent.title : null,
    "",
    ...formatSetlistAsText(displayItems),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const totalDurationSec = totalSetlistDurationSec(displayItems);
  const formatTotalDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <div>
        <Link
          href={`/bands/${bandId}/setlists`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToSetlists")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{setlist.name}</h1>
            {setlist.events.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                {t("linkedWithPrefix")}{" "}
                {setlist.events.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ", "}
                    <Link href={`/bands/${bandId}/calendar/${e.id}`} className="text-primary hover:underline">
                      {e.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            {canManage && setlist.events.length > 0 && (
              <p className="mt-1 text-xs text-muted">{t("sharedListHint")}</p>
            )}
            {totalDurationSec > 0 && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" />
                {t("totalDuration", { duration: formatTotalDuration(totalDurationSec) })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {features.communication && <WhatsAppShareButton text={shareText} label={t("share")} />}
            <Link href={`/print/setlists/${setlistId}`} target="_blank">
              <Button variant="secondary" size="sm">
                <Printer className="h-4 w-4" />
                {t("print")}
              </Button>
            </Link>
            <Link href={`/print/setlists/${setlistId}/tech`} target="_blank">
              <Button variant="secondary" size="sm">
                <ClipboardList className="h-4 w-4" />
                {t("printTech")}
              </Button>
            </Link>
            {canManage && (
              <DeleteButton action={deleteSetlistAction.bind(null, bandId, setlistId)} label={t("delete")} />
            )}
          </div>
        </div>
      </div>

      {setlist.events.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-foreground">{t("eventContextLabel")}</h2>
          <p className="mt-1 text-xs text-muted">{t("eventContextHint")}</p>
          <div className="mt-2">
            <EventContextSelector
              events={setlist.events}
              activeEventId={activeEventId}
              noEventLabel={t("noEventContext")}
              basePath={`/bands/${bandId}/setlists/${setlistId}`}
            />
          </div>
        </Card>
      )}

      {canManage && features.equipment && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-foreground">{t("equipmentIconDisplayLabel")}</h2>
          <p className="mt-1 text-xs text-muted">{t("equipmentIconDisplayHint")}</p>
          <div className="mt-2">
            <EquipmentIconDisplaySelector
              action={saveEquipmentIconDisplayAction.bind(null, bandId, setlistId)}
              value={setlist.equipmentIconDisplay}
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
            <ol className="mt-3 space-y-1.5">
              {frozenItems.map((item, index) => {
                if (item.kind === "SECTION") {
                  return (
                    <li key={index} className="flex items-center gap-3 px-3 py-2">
                      <div className="h-px flex-1 bg-border" />
                      {item.title && (
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                          {item.title}
                        </span>
                      )}
                      <div className="h-px flex-1 bg-border" />
                    </li>
                  );
                }
                if (item.kind === "COMMENT") {
                  return (
                    <li key={index} className="px-3 py-1 text-xs italic text-foreground">
                      {item.title}
                    </li>
                  );
                }
                return (
                  <li key={index} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="w-6 shrink-0 text-muted">
                      {frozenNumbers[index] !== null ? `${frozenNumbers[index]}.` : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
                    {item.key && <span className="shrink-0 text-xs text-muted">{item.key}</span>}
                    {item.bpm && <span className="shrink-0 text-xs text-muted">{item.bpm} BPM</span>}
                  </li>
                );
              })}
              {frozenItems.length === 0 && <p className="text-sm text-muted">{t("printEmpty")}</p>}
            </ol>
          </Card>
        ) : (
          <SetlistBuilder
            key={`${setlist.items.map((i) => i.id).join(",")}-${activeEventId ?? "none"}`}
            bandId={bandId}
            setlistId={setlistId}
            eventId={activeEventId}
            initialItems={items}
            librarySongs={songs}
            readOnly={!canManage || isPastActiveEvent}
            equipmentOptions={equipmentOptions}
            equipmentIconDisplay={setlist.equipmentIconDisplay}
          />
        )}
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">{t("myNotes")}</h2>
        <p className="mt-1 text-sm text-muted">{t("myNotesVisibility")}</p>
        <form
          action={saveSetlistNoteAction.bind(null, bandId, setlistId, activeEventId)}
          className="mt-3 space-y-3"
        >
          <Textarea
            name="content"
            rows={3}
            defaultValue={myNote}
            placeholder={t("notesPlaceholder")}
          />
          <Button type="submit" size="sm">
            <Save className="h-4 w-4" />
            {t("saveNote")}
          </Button>
        </form>
      </Card>

      {(canManage || setlist.techNotes) && (
        <Card className="mt-6">
          <h2 className="font-semibold text-foreground">{t("techNotes")}</h2>
          <p className="mt-1 text-sm text-muted">{t("techNotesVisibility")}</p>
          {canManage ? (
            <form
              action={saveSetlistTechNotesAction.bind(null, bandId, setlistId)}
              className="mt-3 space-y-3"
            >
              <Textarea
                name="techNotes"
                rows={3}
                defaultValue={setlist.techNotes ?? ""}
                placeholder={t("techNotesPlaceholder")}
              />
              <Button type="submit" size="sm">
                <Save className="h-4 w-4" />
                {t("saveNote")}
              </Button>
            </form>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{setlist.techNotes}</p>
          )}
        </Card>
      )}
    </div>
  );
}
