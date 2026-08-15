import Link from "next/link";
import { Globe, Link2, Mail, MapPin, Music2 } from "lucide-react";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import {
  eventTypeLabels,
  eventTypeBadgeVariant,
  eventTypeColor,
  isEventFullyConfirmed,
} from "@/lib/event-colors";
import clsx from "clsx";

export default async function BandOverviewPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  const band = membership.band;

  const [upcomingEvents, songCount, setlistCount, memberCount] = await Promise.all([
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        participants: { select: { userId: true } },
        availabilities: { select: { userId: true, status: true } },
      },
    }),
    prisma.song.count({ where: { bandId, status: { not: "ARCHIVED" } } }),
    prisma.setlist.count({ where: { bandId } }),
    prisma.membership.count({ where: { bandId } }),
  ]);

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
        <h2 className="font-semibold text-foreground">Anstehende Termine</h2>
        <div className="mt-3 space-y-3">
          {upcomingEvents.length === 0 && (
            <Card className="text-sm text-muted">Keine anstehenden Termine.</Card>
          )}
          {upcomingEvents.map((event) => {
            const color = eventTypeColor(event.type);
            const allConfirmed = isEventFullyConfirmed(
              event.participants.map((p) => p.userId),
              event.availabilities
            );
            return (
              <Link key={event.id} href={`/bands/${bandId}/calendar/${event.id}`}>
                <Card
                  className={clsx(
                    "flex items-center justify-between gap-3 border-l-4 transition hover:border-primary",
                    allConfirmed && color.bgSoft
                  )}
                  style={{ borderLeftColor: color.borderVar }}
                >
                  <div>
                    <p className="font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted">
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(event.startsAt)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <Badge variant={eventTypeBadgeVariant[event.type]}>
                    {eventTypeLabels[event.type]}
                  </Badge>
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
                    Kontakt
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
                    Website
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
                    Spotify
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
                    Instagram
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
                    Facebook
                  </a>
                )}
              </div>
            )}
          </Card>
        )}
        <Link href={`/bands/${bandId}/members`}>
          <Card className="transition hover:border-primary">
            <p className="text-sm text-muted">Mitglieder</p>
            <p className="text-2xl font-semibold text-foreground">{memberCount}</p>
          </Card>
        </Link>
        <Link href={`/bands/${bandId}/songs`}>
          <Card className="transition hover:border-primary">
            <p className="text-sm text-muted">Songs im Repertoire</p>
            <p className="text-2xl font-semibold text-foreground">{songCount}</p>
          </Card>
        </Link>
        <Link href={`/bands/${bandId}/setlists`}>
          <Card className="transition hover:border-primary">
            <p className="text-sm text-muted">Setlisten</p>
            <p className="text-2xl font-semibold text-foreground">{setlistCount}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
