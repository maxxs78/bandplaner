import Link from "next/link";
import {
  CalendarClock,
  CalendarCheck,
  Globe,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Music2,
  ThumbsUp,
} from "lucide-react";
import { getTranslations, getFormatter } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import {
  getEventTypeLabels,
  eventTypeBadgeVariant,
  eventTypeColor,
  isEventFullyConfirmed,
  eventLocationLabel,
} from "@/lib/event-colors";
import clsx from "clsx";

export default async function BandOverviewPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const band = membership.band;
  const canManage = canManageContent(membership.role);
  const t = await getTranslations("overview");
  const tEventTypes = await getTranslations("calendar.eventTypes");
  const eventTypeLabels = getEventTypeLabels(tEventTypes);
  const format = await getFormatter();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    upcomingEvents,
    songCount,
    setlistCount,
    memberCount,
    upcomingEventCount,
    availabilityGapEvents,
    proposals,
    songsNeedingInfo,
  ] = await Promise.all([
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        participants: { select: { userId: true } },
        availabilities: { select: { userId: true, status: true } },
        place: { select: { name: true } },
        setlists: { select: { id: true, name: true } },
      },
    }),
    prisma.song.count({ where: { bandId, status: { not: "ARCHIVED" } } }),
    prisma.setlist.count({ where: { bandId } }),
    prisma.membership.count({ where: { bandId } }),
    prisma.event.count({ where: { bandId, startsAt: { gte: now } } }),
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: now, lte: in30Days } },
      select: { id: true, availabilities: { where: { userId: user.id }, select: { id: true } } },
    }),
    prisma.song.findMany({
      where: { bandId, status: "PROPOSED" },
      select: { id: true, votes: { where: { userId: user.id }, select: { id: true } } },
    }),
    canManage
      ? prisma.song.count({
          where: { bandId, status: { not: "ARCHIVED" }, OR: [{ key: null }, { bpm: null }] },
        })
      : Promise.resolve(0),
  ]);

  const availabilityGapCount = availabilityGapEvents.filter((e) => e.availabilities.length === 0).length;
  const pendingProposalCount = proposals.filter((p) => p.votes.length === 0).length;

  const actionItems = [
    availabilityGapCount > 0 && {
      key: "availability",
      href: `/bands/${bandId}/availability`,
      icon: CalendarCheck,
      label: t("actionAvailability", { count: availabilityGapCount }),
    },
    pendingProposalCount > 0 && {
      key: "proposals",
      href: `/bands/${bandId}/songs?status=PROPOSED`,
      icon: ThumbsUp,
      label: t("actionProposals", { count: pendingProposalCount }),
    },
    canManage &&
      songsNeedingInfo > 0 && {
        key: "songInfo",
        href: `/bands/${bandId}/songs`,
        icon: ListChecks,
        label: t("actionSongInfo", { count: songsNeedingInfo }),
      },
  ].filter(Boolean) as { key: string; href: string; icon: typeof CalendarCheck; label: string }[];

  const relativeDayLabel = (date: Date) => {
    const days = Math.round((date.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
    if (days <= 0) return t("today");
    if (days === 1) return t("tomorrow");
    if (days <= 30) return t("inDays", { count: days });
    return null;
  };

  const hasProfileInfo =
    band.genre ||
    band.bio ||
    band.location ||
    band.contactEmail ||
    band.websiteUrl ||
    band.instagramUrl ||
    band.facebookUrl ||
    band.spotifyUrl;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {actionItems.length > 0 && (
          <Card className="mb-6 border-primary/40 bg-primary/5">
            <h2 className="text-sm font-semibold text-foreground">{t("actionRequired")}</h2>
            <ul className="mt-2 space-y-1.5">
              {actionItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-primary" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <h2 className="font-semibold text-foreground">{t("upcomingEvents")}</h2>
        <div className="mt-3 space-y-3">
          {upcomingEvents.length === 0 && (
            <Card className="text-sm text-muted">{t("noUpcomingEvents")}</Card>
          )}
          {upcomingEvents.map((event) => {
            const color = eventTypeColor(event.type);
            const allConfirmed = isEventFullyConfirmed(
              event.participants.map((p) => p.userId),
              event.availabilities
            );
            const confirmStatus: "new" | "partial" | "confirmed" =
              event.availabilities.length === 0
                ? "new"
                : allConfirmed
                  ? "confirmed"
                  : "partial";
            const relDay = relativeDayLabel(event.startsAt);
            return (
              <Link key={event.id} href={`/bands/${bandId}/calendar/${event.id}`}>
                <Card
                  className={clsx(
                    "flex items-center justify-between gap-3 border-l-4 transition hover:border-primary",
                    allConfirmed && color.bgSoft
                  )}
                  style={{ borderLeftColor: color.borderVar }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{event.title}</p>
                      {relDay && (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                          {relDay}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      {format.dateTime(event.startsAt, { dateStyle: "medium", timeStyle: "short" })}
                      {eventLocationLabel(event) ? ` · ${eventLocationLabel(event)}` : ""}
                    </p>
                    {event.setlists.length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <ListChecks className="h-3.5 w-3.5 shrink-0" />
                        {event.setlists.map((s) => s.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={eventTypeBadgeVariant[event.type]}>
                      {eventTypeLabels[event.type]}
                    </Badge>
                    <Badge
                      variant={
                        confirmStatus === "confirmed"
                          ? "success"
                          : confirmStatus === "partial"
                            ? "warning"
                            : "default"
                      }
                    >
                      {t(`confirmStatus.${confirmStatus}`)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {hasProfileInfo && (
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              {band.genre && <Badge variant="accent">{band.genre}</Badge>}
              {band.location && (
                <span className="inline-flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  {band.location}
                </span>
              )}
            </div>
            {band.bio && <p className="mt-3 text-sm text-foreground">{band.bio}</p>}
            {(band.contactEmail ||
              band.websiteUrl ||
              band.instagramUrl ||
              band.facebookUrl ||
              band.spotifyUrl) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {band.contactEmail && (
                  <a
                    href={`mailto:${band.contactEmail}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {t("contact")}
                  </a>
                )}
                {band.websiteUrl && (
                  <a
                    href={band.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {t("website")}
                  </a>
                )}
                {band.spotifyUrl && (
                  <a
                    href={band.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <Music2 className="h-3.5 w-3.5" />
                    {t("spotify")}
                  </a>
                )}
                {band.instagramUrl && (
                  <a
                    href={band.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {t("instagram")}
                  </a>
                )}
                {band.facebookUrl && (
                  <a
                    href={band.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {t("facebook")}
                  </a>
                )}
              </div>
            )}
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/bands/${bandId}/calendar`}>
            <Card className="h-full transition hover:border-primary">
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <CalendarClock className="h-3.5 w-3.5" />
                {t("upcomingCount")}
              </p>
              <p className="text-2xl font-semibold text-foreground">{upcomingEventCount}</p>
            </Card>
          </Link>
          <Link href={`/bands/${bandId}/members`}>
            <Card className="h-full transition hover:border-primary">
              <p className="text-sm text-muted">{t("members")}</p>
              <p className="text-2xl font-semibold text-foreground">{memberCount}</p>
            </Card>
          </Link>
          <Link href={`/bands/${bandId}/songs`}>
            <Card className="h-full transition hover:border-primary">
              <p className="text-sm text-muted">{t("songsInRepertoire")}</p>
              <p className="text-2xl font-semibold text-foreground">{songCount}</p>
            </Card>
          </Link>
          <Link href={`/bands/${bandId}/setlists`}>
            <Card className="h-full transition hover:border-primary">
              <p className="text-sm text-muted">{t("setlists")}</p>
              <p className="text-2xl font-semibold text-foreground">{setlistCount}</p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
