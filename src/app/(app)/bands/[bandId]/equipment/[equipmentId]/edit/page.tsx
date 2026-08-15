import { notFound, redirect } from "next/navigation";
import { requireMembership, canManageBand, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
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
  const { user, membership } = await requireMembership(bandId);

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId, bandId },
    include: {
      files: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!equipment) notFound();

  const canEdit =
    canManageBand(membership.role) ||
    (canManageContent(membership.role) && (equipment.ownerId === null || equipment.ownerId === user.id));
  if (!canEdit) {
    redirect(`/bands/${bandId}/equipment`);
  }
  const isAdmin = canManageBand(membership.role);

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
        <h1 className="text-xl font-semibold text-foreground">Equipment bearbeiten</h1>
        <Card className="mt-4">
          <EquipmentForm
            action={boundAction}
            members={members}
            submitLabel="Änderungen speichern"
            defaultValues={{
              name: equipment.name,
              description: equipment.description ?? "",
              location: equipment.location ?? "",
              ownerId: equipment.ownerId ?? "",
              responsibleId: equipment.responsibleId ?? "",
              category: equipment.category,
            }}
          />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground">Dateien</h2>
        <p className="mt-1 text-xs text-muted">
          Z. B. Bedienungsanleitungen, Kaufbelege oder Fotos zu diesem Equipment.
        </p>
        <div className="mt-3">
          <MinimalFileUpload action={uploadEquipmentFileAction.bind(null, bandId, equipmentId)} />
        </div>
        <div className="mt-3">
          <FileList files={files} currentUserId={user.id} isAdmin={isAdmin} />
        </div>
      </Card>
    </div>
  );
}
