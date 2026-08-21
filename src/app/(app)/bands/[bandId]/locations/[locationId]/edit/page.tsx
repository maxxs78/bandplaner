import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { updateLocationAction, uploadLocationFileAction, geocodeAddressAction, reverseGeocodeAction } from "../../actions";
import {
  deleteBandFileAction,
  updateBandFileAction,
  linkBandFileToLocationAction,
  unlinkBandFileFromLocationAction,
} from "../../../files/actions";
import { LocationForm } from "@/components/location-form";
import { MinimalFileUpload } from "@/components/band-file-upload";
import { FileList, type FileListItem } from "@/components/file-list";
import { Card } from "@/components/ui/card";

export default async function EditLocationPage({
  params,
}: {
  params: Promise<{ bandId: string; locationId: string }>;
}) {
  const { bandId, locationId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).locations) redirect(`/bands/${bandId}`);
  if (!canManageContent(membership.role)) redirect(`/bands/${bandId}/locations`);
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);
  const t = await getTranslations("locations");
  const tFiles = await getTranslations("bandFiles.linkExisting");

  const [location, otherFiles] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId, bandId },
      include: {
        files: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: { select: { name: true } },
            songs: { select: { id: true, title: true } },
            events: { select: { id: true, title: true } },
            equipment: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.bandFile.findMany({
      where: { bandId, NOT: { locations: { some: { id: locationId } } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true },
    }),
  ]);
  if (!location) notFound();

  const boundAction = updateLocationAction.bind(null, bandId, locationId);

  const files: FileListItem[] = location.files.map((f) => ({
    id: f.id,
    filename: f.filename,
    size: f.size,
    category: f.category,
    visibility: f.visibility,
    rawVisibility: f.visibility,
    kind: "band" as const,
    shareToken: f.shareToken,
    uploadedBy: f.uploadedBy,
    uploadedById: f.uploadedById,
    songs: f.songs,
    events: f.events,
    equipment: f.equipment,
    downloadHref: `/api/band-files/${f.id}`,
    deleteAction: deleteBandFileAction.bind(null, bandId, f.id),
    updateAction: updateBandFileAction.bind(null, bandId, f.id),
    unlinkAction: unlinkBandFileFromLocationAction.bind(null, bandId, f.id, locationId),
  }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("editTitle")}</h1>
        <Card className="mt-4">
          <LocationForm
            action={boundAction}
            submitLabel={t("editSubmit")}
            geocodeAction={geocodeAddressAction.bind(null, bandId)}
            reverseGeocodeAction={reverseGeocodeAction.bind(null, bandId)}
            defaultValues={{
              name: location.name,
              address: location.address ?? "",
              latitude: location.latitude?.toString() ?? "",
              longitude: location.longitude?.toString() ?? "",
              contactName: location.contactName ?? "",
              contactPhone: location.contactPhone ?? "",
              contactEmail: location.contactEmail ?? "",
              website: location.website ?? "",
              capacity: location.capacity?.toString() ?? "",
              stageAndTechNotes: location.stageAndTechNotes ?? "",
              loadingAndParkingNotes: location.loadingAndParkingNotes ?? "",
              notes: location.notes ?? "",
            }}
          />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground">{t("files")}</h2>
        <p className="mt-1 text-xs text-muted">{t("filesDescription")}</p>
        <div className="mt-3">
          <MinimalFileUpload
            action={uploadLocationFileAction.bind(null, bandId, locationId)}
            publicLinksEnabled={membership.band.publicFileLinksEnabled}
          />
        </div>
        <div className="mt-3">
          <FileList
            files={files}
            currentUserId={user.id}
            isAdmin={isAdmin}
            publicLinksEnabled={membership.band.publicFileLinksEnabled}
          />
        </div>
        {otherFiles.length > 0 && (
          <form
            action={linkBandFileToLocationAction.bind(null, bandId, locationId)}
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
          >
            <select
              name="fileId"
              defaultValue=""
              required
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
            >
              <option value="" disabled>
                {tFiles("placeholder")}
              </option>
              {otherFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.filename}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary"
            >
              {tFiles("button")}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
