import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageBandContent, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { updateEquipmentAction, uploadEquipmentFileAction } from "../../actions";
import { deleteBandFileAction, updateBandFileAction } from "../../../files/actions";
import { EquipmentForm } from "@/components/equipment-form";
import { MinimalFileUpload } from "@/components/band-file-upload";
import { FileList, type FileListItem } from "@/components/file-list";
import { Card } from "@/components/ui/card";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ bandId: string; equipmentId: string }>;
}) {
  const { bandId, equipmentId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).equipment) redirect(`/bands/${bandId}`);
  const t = await getTranslations("equipment");

  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, ...equipmentVisibleInBand(bandId) },
    include: {
      files: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!equipment) notFound();

  // Band-Equipment darf jede inhalte-berechtigte Person dieser Band bearbeiten;
  // persönliches Equipment ausschließlich die besitzende Person selbst.
  const canEdit = equipment.ownerUserId
    ? equipment.ownerUserId === user.id
    : canManageContent(membership.role);
  if (!canEdit) {
    redirect(`/bands/${bandId}/equipment`);
  }
  const isAdmin = canManageBandContent(membership.role, isFinanceAdmin);

  const memberships = await prisma.membership.findMany({
    where: { bandId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const members = memberships.map((m) => m.user);

  const boundAction = updateEquipmentAction.bind(null, bandId, equipmentId);

  const files: FileListItem[] = equipment.files.map((f) => ({
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
    downloadHref: `/api/band-files/${f.id}`,
    deleteAction: deleteBandFileAction.bind(null, bandId, f.id),
    updateAction: updateBandFileAction.bind(null, bandId, f.id),
  }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("editTitle")}</h1>
        <Card className="mt-4">
          <EquipmentForm
            action={boundAction}
            members={members}
            submitLabel={t("editSubmit")}
            defaultValues={{
              name: equipment.name,
              description: equipment.description ?? "",
              location: equipment.location ?? "",
              ownerId: equipment.ownerUserId ?? "",
              responsibleId: equipment.responsibleId ?? "",
              category: equipment.category,
            }}
          />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground">{t("files")}</h2>
        <p className="mt-1 text-xs text-muted">{t("filesDescription")}</p>
        <div className="mt-3">
          <MinimalFileUpload
            action={uploadEquipmentFileAction.bind(null, bandId, equipmentId)}
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
      </Card>
    </div>
  );
}
