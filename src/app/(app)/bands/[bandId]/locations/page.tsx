import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { LocationForm } from "@/components/location-form";
import { createLocationAction, deleteLocationAction, geocodeAddressAction, reverseGeocodeAction } from "./actions";

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const { membership } = await requireMembership(bandId);
  const features = getEnabledFeatures(membership.band);
  if (!features.locations) redirect(`/bands/${bandId}`);
  const canManage = canManageContent(membership.role);
  const t = await getTranslations("locations");

  const locations = await prisma.location.findMany({
    where: { bandId },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      {canManage && (
        <Card className="mt-4">
          <h2 className="font-semibold text-foreground">{t("addTitle")}</h2>
          <div className="mt-3">
            <LocationForm
              action={createLocationAction.bind(null, bandId)}
              submitLabel={t("addSubmit")}
              geocodeAction={geocodeAddressAction.bind(null, bandId)}
              reverseGeocodeAction={reverseGeocodeAction.bind(null, bandId)}
            />
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {locations.length === 0 && <Card className="text-sm text-muted">{t("noneFound")}</Card>}
        {locations.map((location) => (
          <Card key={location.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{location.name}</p>
              <p className="truncate text-sm text-muted">
                {[location.address, location.capacity ? t("capacitySummary", { capacity: location.capacity }) : null]
                  .filter(Boolean)
                  .join(" · ") || t("noFurtherInfo")}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/bands/${bandId}/locations/${location.id}/edit`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                <DeleteButton
                  action={deleteLocationAction.bind(null, bandId, location.id)}
                  label=""
                  confirmMessage={t("deleteConfirm")}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
