import Link from "next/link";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { BandNav } from "@/components/band-nav";
import { BandSwitcher } from "@/components/band-switcher";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";

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

  const isAdmin = canManageBand(membership.role);
  const features = getEnabledFeatures(membership.band);
  const t = await getTranslations("bandNav");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/bands/${bandId}/members`}
          className="flex items-center gap-3 rounded-lg transition hover:opacity-80"
          title={isAdmin ? t("editTitle") : t("viewTitle")}
        >
          <Avatar src={membership.band.imageUrl} name={membership.band.name} size="lg" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("bandLabel")}
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              {membership.band.name}
            </h1>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <BandSwitcher
            bands={memberships.map((m) => m.band)}
            currentBandId={bandId}
          />
          {isAdmin && (
            <Link href={`/bands/${bandId}/settings`} title={t("settingsTitle")}>
              <Button variant="secondary" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6">
        <BandNav
          bandId={bandId}
          showEquipment={features.equipment}
          showFinance={features.finance && canManageContent(membership.role)}
          showLocations={features.locations}
        />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
