import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveUser, isGuestAccessExpired } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  FINANCE_ADMIN: "Finanz-Admin",
  MEMBER: "Mitglied",
  GUEST: "Gast",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ accessExpired?: string }>;
}) {
  const user = await requireActiveUser();
  const { accessExpired } = await searchParams;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      band: {
        include: {
          _count: { select: { memberships: true } },
          events: {
            where: { startsAt: { gte: new Date() } },
            orderBy: { startsAt: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      {accessExpired && (
        <Card className="mb-6 border-warning/40 bg-warning/10 text-sm text-foreground">
          Dein zeitlich begrenzter Gast-Zugriff auf diese Band ist abgelaufen.
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Meine Bands</h1>
          <p className="mt-1 text-sm text-muted">
            Willkommen zurück, {user.name}.
          </p>
        </div>
        <Link href="/bands/new">
          <Button>
            <Plus className="h-4 w-4" />
            Neue Band
          </Button>
        </Link>
      </div>

      {memberships.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="text-foreground">Du bist noch in keiner Band.</p>
          <p className="mt-1 text-sm text-muted">
            Erstelle deine erste Band oder lass dich per Einladungslink hinzufügen.
          </p>
          <Link href="/bands/new" className="mt-4 inline-block">
            <Button>
              <Plus className="h-4 w-4" />
              Band erstellen
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => {
            const expired = isGuestAccessExpired(m);
            const cardContent = (
              <Card
                className={
                  expired
                    ? "h-full opacity-60"
                    : "h-full transition hover:border-primary"
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={m.band.imageUrl} name={m.band.name} />
                    <h2 className="font-semibold text-foreground">{m.band.name}</h2>
                  </div>
                  <Badge variant={expired ? "default" : "accent"}>
                    {expired ? "Zugriff abgelaufen" : roleLabels[m.role]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {m.band._count.memberships}{" "}
                  {m.band._count.memberships === 1 ? "Mitglied" : "Mitglieder"}
                </p>
                {!expired &&
                  (m.band.events[0] ? (
                    <p className="mt-3 text-sm text-foreground">
                      Nächster Termin:{" "}
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(m.band.events[0].startsAt)}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted">Keine anstehenden Termine</p>
                  ))}
              </Card>
            );

            return expired ? (
              <div key={m.id}>{cardContent}</div>
            ) : (
              <Link key={m.id} href={`/bands/${m.bandId}`}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
