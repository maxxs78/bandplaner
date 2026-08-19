import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
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
import { eventTypeLabels, eventTypeBadgeVariant } from "@/lib/event-colors";

const statusLabels: Record<string, string> = { YES: "Zusage", NO: "Absage", MAYBE: "Vielleicht" };
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

  const event = await prisma.event.findUnique({
    where: { id: eventId, bandId },
    include: {
      availabilities: { include: { user: true } },
      participants: true,
      setlists: true,
      packlists: true,
      createdBy: true,
      files: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!event) notFound();

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
    new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(event.startsAt),
    event.location || null,
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
          Zurück zum Kalender
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{event.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(
                event.startsAt
              )}{" "}
              –{" "}
              {new Intl.DateTimeFormat("de-DE", { timeStyle: "short" }).format(event.endsAt)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
          <Badge variant={eventTypeBadgeVariant[event.type]}>{eventTypeLabels[event.type]}</Badge>
        </div>
        {event.description && <p className="mt-3 text-sm text-foreground">{event.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {features.communication && <WhatsAppShareButton text={shareText} />}
          {canEdit && (
            <>
              <Link href={`/bands/${bandId}/calendar/${eventId}/edit`}>
                <Button variant="secondary" size="sm">
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
                </Button>
              </Link>
              <DeleteButton action={deleteEventAction.bind(null, bandId, eventId)} label="Termin löschen" />
            </>
          )}
        </div>
      </div>

      {myAbsence && (
        <Card className="border-warning/40 bg-warning/10 text-sm text-foreground">
          ⚠ Dieser Termin überschneidet sich mit deiner eingetragenen Abwesenheit (
          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(myAbsence.startDate)}{" "}
          –{" "}
          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(myAbsence.endDate)}
          ).
        </Card>
      )}

      {isParticipant && (
        <Card>
          <h2 className="font-semibold text-foreground">Deine Verfügbarkeit</h2>
          <div className="mt-3">
            <AvailabilityButtons
              action={respondAvailabilityAction.bind(null, bandId, eventId)}
              current={myAvailability?.status}
            />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">Rückmeldungen</h2>
        <p className="mt-1 text-sm text-muted">Betrifft {participantMembers.length} Mitglied(er).</p>
        <div className="mt-3 space-y-2">
          {relevantAvailabilities.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{a.user.name}</span>
              <Badge variant={statusVariant[a.status]}>{statusLabels[a.status]}</Badge>
            </div>
          ))}
          {noResponse.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{m.user.name}</span>
              <Badge variant="default">Ausstehend</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Setlisten</h2>
          {canManage && (
            <Link href={`/bands/${bandId}/setlists/new?eventId=${eventId}`}>
              <Button variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                Setlist
              </Button>
            </Link>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {event.setlists.length === 0 && (
            <p className="text-sm text-muted">Noch keine Setlist verknüpft.</p>
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
                    Trennen
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
                Bestehende Setlist verknüpfen…
              </option>
              {otherSetlists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.event ? ` (aktuell: ${s.event.title})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary"
            >
              Verknüpfen
            </button>
          </form>
        )}
      </Card>

      {features.packlists && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Packlisten</h2>
            {canManage && (
              <Link href={`/bands/${bandId}/equipment/packlists?eventId=${eventId}`}>
                <Button variant="secondary" size="sm">
                  <Plus className="h-4 w-4" />
                  Packliste
                </Button>
              </Link>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {event.packlists.length === 0 && (
              <p className="text-sm text-muted">Noch keine Packliste verknüpft.</p>
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
                      Trennen
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
                  Bestehende Packliste verknüpfen…
                </option>
                {otherPacklists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.event ? ` (aktuell: ${p.event.title})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary"
              >
                Verknüpfen
              </button>
            </form>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">Dateien</h2>
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
