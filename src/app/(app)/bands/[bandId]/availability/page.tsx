import Link from "next/link";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { AbsenceForm } from "@/components/absence-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteAbsenceAction } from "./actions";
import clsx from "clsx";

const statusSymbol: Record<string, { icon: string; className: string }> = {
  YES: { icon: "✓", className: "bg-success/15 text-success" },
  NO: { icon: "✗", className: "bg-danger/15 text-danger" },
  MAYBE: { icon: "?", className: "bg-warning/15 text-warning" },
};

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user } = await requireMembership(bandId);

  const [members, events, absences] = await Promise.all([
    prisma.membership.findMany({ where: { bandId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.event.findMany({
      where: { bandId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { availabilities: true, participants: true },
    }),
    prisma.absence.findMany({
      where: { bandId, endDate: { gte: new Date() } },
      include: { user: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-semibold text-foreground">Verfügbarkeits-Matrix</h2>
        <p className="mt-1 text-sm text-muted">
          Rückmeldungen für die nächsten anstehenden Termine.
        </p>
        <Card className="mt-3 overflow-x-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted">Keine anstehenden Termine.</p>
          ) : (
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border pb-2 pr-4 text-left font-medium text-muted">
                    Mitglied
                  </th>
                  {events.map((e) => (
                    <th key={e.id} className="border-b border-border px-2 pb-2 text-center font-medium text-muted">
                      <Link href={`/bands/${bandId}/calendar/${e.id}`} className="hover:text-primary">
                        {new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(e.startsAt)}
                        <br />
                        <span className="text-xs">{e.title}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="border-b border-border py-2 pr-4 text-foreground">
                      {m.user.name}
                      {m.userId === user.id && <span className="text-muted"> (du)</span>}
                    </td>
                    {events.map((e) => {
                      const isParticipant = e.participants.some((p) => p.userId === m.userId);
                      const a = e.availabilities.find((av) => av.userId === m.userId);
                      return (
                        <td key={e.id} className="border-b border-border px-2 py-2 text-center">
                          {!isParticipant ? (
                            <span className="text-muted/40" title="Nicht für diesen Termin vorgesehen">
                              n. b.
                            </span>
                          ) : a ? (
                            <span
                              className={clsx(
                                "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                                statusSymbol[a.status].className
                              )}
                            >
                              {statusSymbol[a.status].icon}
                            </span>
                          ) : (
                            <span className="text-muted">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div>
        <h2 className="font-semibold text-foreground">Persönliche Abwesenheiten</h2>
        <p className="mt-1 text-sm text-muted">
          Trage längerfristige Abwesenheiten ein (z. B. Urlaub), unabhängig von konkreten Terminen.
        </p>
        <Card className="mt-3">
          <AbsenceForm bandId={bandId} />
        </Card>

        <div className="mt-3 space-y-2">
          {absences.length === 0 && (
            <p className="text-sm text-muted">Keine eingetragenen Abwesenheiten.</p>
          )}
          {absences.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{a.user.name}</p>
                <p className="text-sm text-muted">
                  {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(a.startDate)} –{" "}
                  {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(a.endDate)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </div>
              <DeleteButton
                action={deleteAbsenceAction.bind(null, bandId, a.id)}
                label="Entfernen"
                confirmMessage="Abwesenheit wirklich entfernen?"
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
