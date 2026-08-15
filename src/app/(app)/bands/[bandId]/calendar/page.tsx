import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  eventTypeLabels,
  eventTypeBadgeVariant,
  eventTypeColor,
  eventPillClasses,
  isEventFullyConfirmed,
} from "@/lib/event-colors";
import clsx from "clsx";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  const canCreate = canManageContent(membership.role);
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "list";

  if (view === "month") {
    const monthDate = sp.month ? new Date(`${sp.month}-01T00:00:00`) : new Date();
    const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const [events, absences, totalMembers] = await Promise.all([
      prisma.event.findMany({
        where: { bandId, startsAt: { gte: gridStart, lte: gridEnd } },
        orderBy: { startsAt: "asc" },
        include: {
          participants: { select: { userId: true } },
          availabilities: { select: { userId: true, status: true } },
        },
      }),
      prisma.absence.findMany({
        where: { bandId, startDate: { lte: gridEnd }, endDate: { gte: gridStart } },
        select: { userId: true, startDate: true, endDate: true },
      }),
      prisma.membership.count({ where: { bandId } }),
    ]);

    const eventsByDay = new Map<string, typeof events>();
    for (const event of events) {
      const key = format(event.startsAt, "yyyy-MM-dd");
      eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
    }

    const absentCountByDay = new Map<string, number>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const absentUserIds = new Set(
        absences.filter((a) => a.startDate <= day && a.endDate >= day).map((a) => a.userId)
      );
      absentCountByDay.set(key, absentUserIds.size);
    }

    const prevMonth = format(addMonths(monthDate, -1), "yyyy-MM");
    const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");

    return (
      <div>
        <CalendarHeader bandId={bandId} view={view} canCreate={canCreate} />
        <div className="mt-4 flex items-center justify-between">
          <Link href={`/bands/${bandId}/calendar?view=month&month=${prevMonth}`}>
            <Button variant="secondary" size="sm">
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
          </Link>
          <h2 className="font-semibold text-foreground">
            {format(monthDate, "MMMM yyyy", { locale: de })}
          </h2>
          <Link href={`/bands/${bandId}/calendar?view=month&month=${nextMonth}`}>
            <Button variant="secondary" size="sm">
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {totalMembers > 0 && (
          <p className="mt-3 text-xs text-muted">
            Hintergrund zeigt Abwesenheiten: je mehr Mitglieder abwesend sind, desto intensiver die
            Färbung.
          </p>
        )}

        <div className="mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div key={d} className="bg-surface-muted px-2 py-1.5 text-center font-medium text-muted">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const absentCount = absentCountByDay.get(key) ?? 0;
            const absentRatio = totalMembers > 0 ? absentCount / totalMembers : 0;
            const cellStyle: React.CSSProperties | undefined =
              absentCount > 0
                ? {
                    backgroundColor: `color-mix(in srgb, var(--warning) ${Math.round(
                      15 + absentRatio * 65
                    )}%, var(--surface))`,
                  }
                : undefined;
            return (
              <div
                key={key}
                title={
                  absentCount > 0
                    ? `${absentCount} von ${totalMembers} Mitglied(ern) abwesend`
                    : undefined
                }
                className={clsx(
                  "min-h-[90px] p-1.5",
                  !cellStyle && "bg-surface",
                  !isSameMonth(day, monthDate) && "opacity-40"
                )}
                style={cellStyle}
              >
                <p
                  className={clsx(
                    "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isToday(day) && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {format(day, "d")}
                </p>
                <div className="space-y-1">
                  {dayEvents.map((event) => {
                    const allConfirmed = isEventFullyConfirmed(
                      event.participants.map((p) => p.userId),
                      event.availabilities
                    );
                    return (
                      <Link
                        key={event.id}
                        href={`/bands/${bandId}/calendar/${event.id}`}
                        className={clsx(
                          "block truncate rounded px-1 py-0.5 font-medium",
                          eventPillClasses(event.type, allConfirmed)
                        )}
                      >
                        {format(event.startsAt, "HH:mm")} {event.title}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: { bandId },
    orderBy: { startsAt: "asc" },
    include: {
      participants: { select: { userId: true } },
      availabilities: { select: { userId: true, status: true } },
    },
  });

  const now = new Date();
  const upcoming = events.filter((e) => e.startsAt >= now);
  const past = events.filter((e) => e.startsAt < now).reverse();

  return (
    <div>
      <CalendarHeader bandId={bandId} view={view} canCreate={canCreate} />

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="font-semibold text-foreground">Anstehend</h2>
          <div className="mt-3 space-y-2">
            {upcoming.length === 0 && (
              <Card className="text-sm text-muted">Keine anstehenden Termine.</Card>
            )}
            {upcoming.map((event) => (
              <EventRow key={event.id} bandId={bandId} event={event} />
            ))}
          </div>
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="font-semibold text-foreground">Vergangen</h2>
            <div className="mt-3 space-y-2">
              {past.map((event) => (
                <EventRow key={event.id} bandId={bandId} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CalendarHeader({
  bandId,
  view,
  canCreate,
}: {
  bandId: string;
  view: string;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-lg border border-border p-1">
        <Link href={`/bands/${bandId}/calendar?view=list`}>
          <span
            className={clsx(
              "inline-block rounded-md px-3 py-1 text-sm",
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            Liste
          </span>
        </Link>
        <Link href={`/bands/${bandId}/calendar?view=month`}>
          <span
            className={clsx(
              "inline-block rounded-md px-3 py-1 text-sm",
              view === "month" ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            Monat
          </span>
        </Link>
      </div>
      <div className="flex gap-2">
        <a href={`/api/bands/${bandId}/calendar.ics`} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm">
            <Download className="h-4 w-4" />
            ICS-Feed
          </Button>
        </a>
        {canCreate && (
          <Link href={`/bands/${bandId}/calendar/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Neuer Termin
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function EventRow({
  bandId,
  event,
}: {
  bandId: string;
  event: {
    id: string;
    title: string;
    type: string;
    startsAt: Date;
    location: string | null;
    participants: { userId: string }[];
    availabilities: { userId: string; status: string }[];
  };
}) {
  const allConfirmed = isEventFullyConfirmed(
    event.participants.map((p) => p.userId),
    event.availabilities
  );
  const color = eventTypeColor(event.type);

  return (
    <Link href={`/bands/${bandId}/calendar/${event.id}`}>
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
            {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
              event.startsAt
            )}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <Badge variant={eventTypeBadgeVariant[event.type]}>{eventTypeLabels[event.type]}</Badge>
      </Card>
    </Link>
  );
}
