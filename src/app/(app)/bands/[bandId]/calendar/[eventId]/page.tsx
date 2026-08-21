import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { getTranslations, getFormatter } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { respondAvailabilityAction, deleteEventAction, uploadEventFileAction } from "../actions";
import { deleteBandFileAction, updateBandFileAction } from "../../files/actions";
import { linkSetlistToEventAction, unlinkSetlistFromEventAction } from "../../setlists/actions";
import { linkPacklistToEventAction, unlinkPacklistFromEventAction } from "../../equipment/actions";
import { AvailabilityButtons } from "@/components/availability-buttons";
import { DeleteButton } from "@/components/delete-button";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";
import { MinimalFileUpload } from "@/components/band-file-upload";
import { FileList, type FileListItem } from "@/components/file-list";
import { AddressMap } from "@/components/address-map";
import { getEventTypeLabels, eventTypeBadgeVariant, eventLocationLabel } from "@/lib/event-colors";

const statusVariant: Record<string, "success" | "danger" | "warning"> = {
  YES: "success",
  NO: "danger",
  MAYBE: "warning",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; eventId: string }>;
}) {
  const { bandId, eventId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const t = await getTranslations("calendar.detail");
  const tLocationForm = await getTranslations("locations.form");
  const tAvailability = await getTranslations("calendar.availability");
  const tEventTypes = await getTranslations("calendar.eventTypes");
  const eventTypeLabels = getEventTypeLabels(tEventTypes);
  const format = await getFormatter();

  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    include: {
      availabilities: { include: { user: true } },
      participants: true,
      setlists: true,
      packlists: true,
      createdBy: true,
      place: { select: { id: true, name: true, address: true, latitude: true, longitude: true } },
      files: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!event) notFound();

  const locationLabel = eventLocationLabel(event);

  const members = await prisma.membership.findMany({
    where: { bandId },
    include: { user: true },
  });

  const participantIds = new Set(event.participants.map((p) => p.userId));
  const isParticipant = participantIds.has(user.id);
  const participantMembers = members.filter((m) => participantIds.has(m.userId));
  const relevantAvailabilities = event.availabilities.filter((a) => participantIds.has(a.userId));

  const myAvailability = relevantAvailabilities.find((a) => a.userId === user.id);
  const respondedIds = new Set(relevantAvailabilities.map((a) => a.userId));
  const noResponse = participantMembers.filter((m) => !respondedIds.has(m.userId));

  const myAbsence = await prisma.absence.findFirst({
    where: {
      bandId,
      userId: user.id,
      startDate: { lte: event.endsAt },
      endDate: { gte: event.startsAt },
    },
  });

  const canManage = canManageContent(membership.role);
  const features = getEnabledFeatures(membership.band);
  const otherSetlists = canManage
    ? await prisma.setlist.findMany({
        where: { bandId, OR: [{ eventId: null }, { eventId: { not: eventId } }] },
        include: { event: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const otherPacklists =
    canManage && features.packlists
      ? await prisma.packlist.findMany({
          where: { bandId, OR: [{ eventId: null }, { eventId: { not: eventId } }] },
          include: { event: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const canEdit = canManageBandContent(membership.role, isFinanceAdmin) || (canManage && event.createdById === user.id);
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);

  const shareText = [
    `${membership.band.name}: ${event.title}`,
    format.dateTime(event.startsAt, { dateStyle: "full", timeStyle: "short" }),
    locationLabel,
  ]
    .filter(Boolean)
    .join("\n");

  const files: FileListItem[] = event.files.map((f) => ({
    id: f.id,
    filename: f.filename,
    size: f.size,
    category: f.category,
    visibility: f.visibility,
    rawVisibility: f.visibility,
    kind: "band" as const,
    shareToken: f.shareToken,
    uploadedBy: f.uploadedBy,
    uploadedById: f.uploadedById,
    downloadHref: `/api/band-files/${f.id}`,
    deleteAction: deleteBandFileAction.bind(null, bandId, f.id),
    updateAction: updateBandFileAction.bind(null, bandId, f.id),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/bands/${bandId}/calendar`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToCalendar")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {format.dateTime(event.startsAt, { dateStyle: "full", timeStyle: "short" })}{" "}
              –{" "}
              {format.dateTime(event.endsAt, { timeStyle: "short" })}
              {locationLabel && (
                <>
                  {" · "}
                  {event.place && canManage ? (
                    <Link
                      href={`/bands/${bandId}/locations/${event.place.id}/edit`}
                      className="text-foreground hover:text-primary hover:underline"
                    >
                      {locationLabel}
                    </Link>
                  ) : (
                    locationLabel
                  )}
                </>
              )}
            </p>
            {event.place?.address && <p className="text-sm text-muted">{event.place.address}</p>}
            {event.place?.latitude != null && event.place?.longitude != null && (
              <div className="mt-2 w-full max-w-xl">
                <AddressMap
                  latitude={event.place.latitude}
                  longitude={event.place.longitude}
                  interactive={false}
                  heightClassName="h-56"
                  pinAlt={tLocationForm("mapPinAlt")}
                />
              </div>
            )}
          </div>
          <Badge variant={eventTypeBadgeVariant[event.type]} className="shrink-0">
            {eventTypeLabels[event.type]}
          </Badge>
        </div>
        {event.description && <p className="mt-3 text-sm text-foreground">{event.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {features.communication && <WhatsAppShareButton text={shareText} />}
          {canEdit && (
            <>
              <Link href={`/bands/${bandId}/calendar/${eventId}/edit`}>
                <Button variant="secondary" size="sm">
                  <Pencil className="h-4 w-4" />
                  {t("editButton")}
                </Button>
              </Link>
              <DeleteButton action={deleteEventAction.bind(null, bandId, eventId)} label={t("deleteButton")} />
            </>
          )}
        </div>
      </div>

      {myAbsence && (
        <Card className="border-warning/40 bg-warning/10 text-sm text-foreground">
          {t("absenceOverlap", {
            start: format.dateTime(myAbsence.startDate, { dateStyle: "medium" }),
            end: format.dateTime(myAbsence.endDate, { dateStyle: "medium" }),
          })}
        </Card>
      )}

      {isParticipant && (
        <Card>
          <h2 className="font-semibold text-foreground">{t("yourAvailability")}</h2>
          <div className="mt-3">
            <AvailabilityButtons
              action={respondAvailabilityAction.bind(null, bandId, eventId)}
              current={myAvailability?.status}
            />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">{t("responses")}</h2>
        <p className="mt-1 text-sm text-muted">{t("affectsMembers", { count: participantMembers.length })}</p>
        <div className="mt-3 space-y-2">
          {relevantAvailabilities.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{a.user.name}</span>
              <Badge variant={statusVariant[a.status]}>{tAvailability(a.status)}</Badge>
            </div>
          ))}
          {noResponse.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{m.user.name}</span>
              <Badge variant="default">{t("pending")}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("setlists")}</h2>
          {canManage && (
            <Link href={`/bands/${bandId}/setlists/new?eventId=${eventId}`}>
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                {t("setlistButton")}
              </Button>
            </Link>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {event.setlists.length === 0 && (
            <p className="text-sm text-muted">{t("noSetlistLinked")}</p>
          )}
          {event.setlists.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <Link href={`/bands/${bandId}/setlists/${s.id}`} className="flex-1 text-foreground hover:text-primary">
                {s.name}
              </Link>
              {canManage && (
                <form action={unlinkSetlistFromEventAction.bind(null, bandId, s.id, eventId)}>
                  <button type="submit" className="text-xs text-muted hover:text-danger">
                    {t("unlink")}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
        {canManage && otherSetlists.length > 0 && (
          <form
            action={linkSetlistToEventAction.bind(null, bandId, eventId)}
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
          >
            <select
              name="setlistId"
              defaultValue=""
              required
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            >
              <option value="" disabled>
                {t("linkExistingSetlist")}
              </option>
              {otherSetlists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.event ? t("currentLabel", { title: s.event.title }) : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary"
            >
              {t("link")}
            </button>
          </form>
        )}
      </Card>

      {features.packlists && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{t("packlists")}</h2>
            {canManage && (
              <Link href={`/bands/${bandId}/equipment/packlists?eventId=${eventId}`}>
                <Button variant="secondary" size="sm">
                  <Plus className="h-4 w-4" />
                  {t("packlistButton")}
                </Button>
              </Link>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {event.packlists.length === 0 && (
              <p className="text-sm text-muted">{t("noPacklistLinked")}</p>
            )}
            {event.packlists.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <Link
                  href={`/bands/${bandId}/equipment/packlists/${p.id}`}
                  className="flex-1 text-foreground hover:text-primary"
                >
                  {p.name}
                </Link>
                {canManage && (
                  <form action={unlinkPacklistFromEventAction.bind(null, bandId, p.id, eventId)}>
                    <button type="submit" className="text-xs text-muted hover:text-danger">
                      {t("unlink")}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
          {canManage && otherPacklists.length > 0 && (
            <form
              action={linkPacklistToEventAction.bind(null, bandId, eventId)}
              className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
            >
              <select
                name="packlistId"
                defaultValue=""
                required
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                <option value="" disabled>
                  {t("linkExistingPacklist")}
                </option>
                {otherPacklists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.event ? t("currentLabel", { title: p.event.title }) : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary"
              >
                {t("link")}
              </button>
            </form>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">{t("files")}</h2>
        {canManage && (
          <div className="mt-3">
            <MinimalFileUpload
              action={uploadEventFileAction.bind(null, bandId, eventId)}
              publicLinksEnabled={membership.band.publicFileLinksEnabled}
            />
          </div>
        )}
        <div className="mt-3">
          <FileList
            files={files}
            currentUserId={user.id}
            isAdmin={isAdmin}
            equipmentEnabled={features.equipment}
            publicLinksEnabled={membership.band.publicFileLinksEnabled}
          />
        </div>
      </Card>
    </div>
  );
}
