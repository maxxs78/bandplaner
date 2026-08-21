import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { PacklistBuilder } from "@/components/packlist-builder";
import {
  deletePacklistAction,
  removePacklistItemAction,
  togglePacklistItemAction,
  assignPacklistItemAction,
  addPacklistEquipmentAction,
  addPacklistCustomItemAction,
} from "../../actions";

export default async function PacklistDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; packlistId: string }>;
}) {
  const { bandId, packlistId } = await params;
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).packlists) redirect(`/bands/${bandId}`);
  const canManage = canManageContent(membership.role);
  const t = await getTranslations("packlists.detail");

  const packlist = await prisma.packlist.findUnique({
    where: { id: packlistId, bandId },
    include: {
      event: true,
      items: {
        orderBy: { order: "asc" },
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
              location: true,
              ownerUser: { select: { id: true, name: true } },
            },
          },
          assignedTo: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!packlist) notFound();

  const [catalog, memberships] = await Promise.all([
    prisma.equipment.findMany({
      where: equipmentVisibleInBand(bandId),
      orderBy: { name: "asc" },
      include: { ownerUser: { select: { id: true, name: true } } },
    }),
    prisma.membership.findMany({
      where: { bandId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const members = memberships.map((m) => m.user);
  const catalogEquipment = catalog.map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
    owner: e.ownerUser ? { id: e.ownerUser.id, name: e.ownerUser.name } : null,
  }));
  const items = packlist.items.map((item) => ({
    ...item,
    equipment: item.equipment
      ? {
          id: item.equipment.id,
          name: item.equipment.name,
          location: item.equipment.location,
          owner: item.equipment.ownerUser,
        }
      : null,
  }));

  return (
    <div>
      <div>
        <Link
          href={`/bands/${bandId}/equipment/packlists`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToPacklists")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{packlist.name}</h1>
            {packlist.event && (
              <p className="mt-1 text-sm text-muted">
                {t("linkedWithPrefix")}{" "}
                <Link href={`/bands/${bandId}/calendar/${packlist.event.id}`} className="text-primary hover:underline">
                  {packlist.event.title}
                </Link>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/print/packlists/${packlistId}`} target="_blank">
              <Button variant="secondary" size="sm">
                <FileDown className="h-4 w-4" />
                {t("print")}
              </Button>
            </Link>
            {canManage && (
              <DeleteButton action={deletePacklistAction.bind(null, bandId, packlistId)} label={t("delete")} />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PacklistBuilder
          key={items.map((i) => i.id).join(",")}
          initialItems={items}
          catalogEquipment={catalogEquipment}
          members={members}
          readOnly={!canManage}
          onToggle={async (itemId, checked) => {
            "use server";
            await togglePacklistItemAction(bandId, packlistId, itemId, checked);
          }}
          onAssign={async (itemId, userId) => {
            "use server";
            await assignPacklistItemAction(bandId, packlistId, itemId, userId);
          }}
          onRemove={async (itemId) => {
            "use server";
            await removePacklistItemAction(bandId, packlistId, itemId);
          }}
          onAddEquipment={async (equipmentId) => {
            "use server";
            await addPacklistEquipmentAction(bandId, packlistId, equipmentId);
          }}
          onAddCustom={async (formData) => {
            "use server";
            await addPacklistCustomItemAction(bandId, packlistId, formData);
          }}
        />
      </div>
    </div>
  );
}
