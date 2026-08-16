import { redirect } from "next/navigation";
import { requireMembership, canManageBand } from "@/lib/access";
import { Card } from "@/components/ui/card";
import { FeatureTogglesForm } from "@/components/feature-toggles-form";
import { BandSettingsForm } from "@/components/band-settings-form";
import { updateBandFeaturesAction, updateBandSettingsAction } from "./actions";

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
            key={`${membership.band.equipmentEnabled}-${membership.band.packlistsEnabled}`}
            action={updateBandFeaturesAction.bind(null, bandId)}
            initialEquipmentEnabled={membership.band.equipmentEnabled}
            initialPacklistsEnabled={membership.band.packlistsEnabled}
          />
        </Card>
      </div>

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
