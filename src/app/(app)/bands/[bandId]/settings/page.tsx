import { redirect } from "next/navigation";
import { requireMembership, canManageBand } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { FeatureTogglesForm } from "@/components/feature-toggles-form";
import { BandSettingsForm } from "@/components/band-settings-form";
import { FinanceAdminsForm } from "@/components/finance-admins-form";
import { updateBandFeaturesAction, updateBandSettingsAction, updateFinanceAdminsAction } from "./actions";

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

  const [memberships, financeAdmins] = membership.band.financeEnabled
    ? await Promise.all([
        prisma.membership.findMany({
          where: { bandId },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.bandFinanceAdmin.findMany({ where: { bandId }, select: { userId: true } }),
      ])
    : [[], []];

  const members = memberships.map((m) => m.user);
  const financeAdminIds = financeAdmins.map((f) => f.userId);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Verwaltung</h1>
        <p className="mt-1 text-sm text-muted">
          Funktionen für diese Band ein- oder ausschalten. Ausgeschaltete Funktionen verschwinden aus der
          Navigation, vorhandene Daten bleiben dabei erhalten und stehen sofort wieder zur Verfügung, sobald du
          die Funktion wieder einschaltest.
        </p>
        <Card className="mt-4">
          <FeatureTogglesForm
            key={`${membership.band.equipmentEnabled}-${membership.band.packlistsEnabled}-${membership.band.financeEnabled}-${membership.band.financeSettlementMode}-${membership.band.communicationEnabled}`}
            action={updateBandFeaturesAction.bind(null, bandId)}
            initialEquipmentEnabled={membership.band.equipmentEnabled}
            initialPacklistsEnabled={membership.band.packlistsEnabled}
            initialFinanceEnabled={membership.band.financeEnabled}
            initialFinanceSettlementMode={membership.band.financeSettlementMode}
            initialCommunicationEnabled={membership.band.communicationEnabled}
          />
        </Card>
      </div>

      {membership.band.financeEnabled && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Finanzadmin:innen</h2>
          <p className="mt-1 text-sm text-muted">
            Nur diese Personen sehen die vollständige Finanzübersicht der Band und dürfen Einträge anlegen.
            Sie bekommen dadurch außerdem admin-gleiche Rechte bei Songs, Equipment, Dateien und Terminen –
            aber keinen Zugriff auf Mitgliederverwaltung oder diese Verwaltungsseite.
          </p>
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
        <h2 className="text-lg font-semibold text-foreground">Weitere Einstellungen</h2>
        <Card className="mt-4">
          <BandSettingsForm
            key={`${membership.band.defaultGuestAccessDays}-${membership.band.publicFileLinksEnabled}`}
            action={updateBandSettingsAction.bind(null, bandId)}
            initialDefaultGuestAccessDays={membership.band.defaultGuestAccessDays}
            initialPublicFileLinksEnabled={membership.band.publicFileLinksEnabled}
          />
        </Card>
      </div>
    </div>
  );
}
