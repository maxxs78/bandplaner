import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBand } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { FeatureTogglesForm } from "@/components/feature-toggles-form";
import { BandSettingsForm } from "@/components/band-settings-form";
import { FinanceAdminsForm } from "@/components/finance-admins-form";
import { LineupRolesForm } from "@/components/lineup-roles-form";
import {
  updateBandFeaturesAction,
  updateBandSettingsAction,
  updateFinanceAdminsAction,
  updateLineupRolesAction,
} from "./actions";

export default async function BandSettingsPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    redirect(`/bands/${bandId}`);
  }

  const [memberships, financeAdmins, lineupRoles] = await Promise.all([
    prisma.membership.findMany({
      where: { bandId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    membership.band.financeEnabled
      ? prisma.bandFinanceAdmin.findMany({ where: { bandId }, select: { userId: true } })
      : Promise.resolve([]),
    prisma.bandLineupRole.findMany({
      where: { bandId },
      orderBy: { order: "asc" },
      select: { name: true, defaultAssigneeId: true },
    }),
  ]);

  const members = memberships.map((m) => m.user);
  const financeAdminIds = financeAdmins.map((f) => f.userId);
  const t = await getTranslations("bandSettings");

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("hint")}</p>
        <Card className="mt-4">
          <FeatureTogglesForm
            key={`${membership.band.equipmentEnabled}-${membership.band.packlistsEnabled}-${membership.band.financeEnabled}-${membership.band.financeSettlementMode}-${membership.band.communicationEnabled}-${membership.band.mediaPlayerEnabled}-${membership.band.keyDetectionEnabled}-${membership.band.locationsEnabled}-${membership.band.rehearsalTrackingEnabled}`}
            action={updateBandFeaturesAction.bind(null, bandId)}
            initialEquipmentEnabled={membership.band.equipmentEnabled}
            initialPacklistsEnabled={membership.band.packlistsEnabled}
            initialFinanceEnabled={membership.band.financeEnabled}
            initialFinanceSettlementMode={membership.band.financeSettlementMode}
            initialCommunicationEnabled={membership.band.communicationEnabled}
            initialMediaPlayerEnabled={membership.band.mediaPlayerEnabled}
            initialKeyDetectionEnabled={membership.band.keyDetectionEnabled}
            initialLocationsEnabled={membership.band.locationsEnabled}
            initialRehearsalTrackingEnabled={membership.band.rehearsalTrackingEnabled}
          />
        </Card>
      </div>

      {membership.band.financeEnabled && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("financeAdminsTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("financeAdminsHint")}</p>
          <Card className="mt-4">
            <FinanceAdminsForm
              key={financeAdminIds.join(",")}
              action={updateFinanceAdminsAction.bind(null, bandId)}
              members={members}
              initialFinanceAdminIds={financeAdminIds}
            />
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("moreSettingsTitle")}</h2>
        <Card className="mt-4">
          <BandSettingsForm
            key={`${membership.band.defaultGuestAccessDays}-${membership.band.publicFileLinksEnabled}`}
            action={updateBandSettingsAction.bind(null, bandId)}
            initialDefaultGuestAccessDays={membership.band.defaultGuestAccessDays}
            initialPublicFileLinksEnabled={membership.band.publicFileLinksEnabled}
          />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("lineupRoles.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("lineupRoles.hint")}</p>
        <Card className="mt-4">
          <LineupRolesForm
            key={lineupRoles.map((r) => `${r.name}-${r.defaultAssigneeId}`).join(",")}
            action={updateLineupRolesAction.bind(null, bandId)}
            initialRoles={lineupRoles.map((r) => ({ name: r.name, defaultAssigneeId: r.defaultAssigneeId }))}
            members={members}
          />
        </Card>
      </div>
    </div>
  );
}
