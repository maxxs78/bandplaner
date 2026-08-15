import Link from "next/link";
import { requireMembership, canManageBand } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { BandNav } from "@/components/band-nav";
import { BandSwitcher } from "@/components/band-switcher";
import { Avatar } from "@/components/avatar";

export default async function BandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { band: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/bands/${bandId}/members`}
          className="flex items-center gap-3 rounded-lg transition hover:opacity-80"
          title={
            canManageBand(membership.role)
              ? "Band bearbeiten (Profil, Mitglieder, Einladungen)"
              : "Band ansehen"
          }
        >
          <Avatar src={membership.band.imageUrl} name={membership.band.name} size="lg" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Band
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {membership.band.name}
            </h1>
          </div>
        </Link>
        <BandSwitcher
          bands={memberships.map((m) => m.band)}
          currentBandId={bandId}
        />
      </div>

      <div className="mt-6">
        <BandNav bandId={bandId} />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
