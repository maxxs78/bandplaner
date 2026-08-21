import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { equipmentVisibleInBand } from "@/lib/equipment-visibility";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { EquipmentForm } from "@/components/equipment-form";
import { EquipmentSubNav } from "@/components/equipment-sub-nav";
import { getEquipmentCategoryLabels } from "@/lib/equipment-categories";
import { createEquipmentAction, deleteEquipmentAction } from "./actions";

export default async function EquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ owner?: string }>;
}) {
  const { bandId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const features = getEnabledFeatures(membership.band);
  if (!features.equipment) redirect(`/bands/${bandId}`);
  const canManage = canManageContent(membership.role);
  const { owner } = await searchParams;
  const t = await getTranslations("equipment");
  const equipmentCategoryLabels = getEquipmentCategoryLabels(t);

  const ownerFilter =
    owner === "band"
      ? { ownerBandId: bandId }
      : owner === "mine"
        ? { ownerUserId: user.id }
        : equipmentVisibleInBand(bandId);

  const [equipment, memberships] = await Promise.all([
    prisma.equipment.findMany({
      where: ownerFilter,
      orderBy: { name: "asc" },
      include: {
        ownerUser: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
      },
    }),
    prisma.membership.findMany({
      where: { bandId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const members = memberships.map((m) => m.user);

  const filters = [
    { value: undefined, label: t("filterAll") },
    { value: "band", label: t("filterBandOwned") },
    { value: "mine", label: t("filterMine") },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <EquipmentSubNav bandId={bandId} active="catalog" showPacklists={features.packlists} />
      </div>

      {canManage && (
        <Card className="mt-4">
          <h2 className="font-semibold text-foreground">{t("addTitle")}</h2>
          <div className="mt-3">
            <EquipmentForm
              action={createEquipmentAction.bind(null, bandId)}
              members={members}
              submitLabel={t("addSubmit")}
            />
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border p-1">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={`/bands/${bandId}/equipment${f.value ? `?owner=${f.value}` : ""}`}
          >
            <span
              className={
                (owner ?? undefined) === f.value
                  ? "inline-block rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                  : "inline-block rounded-md px-3 py-1 text-sm text-muted"
              }
            >
              {f.label}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {equipment.length === 0 && (
          <Card className="text-sm text-muted">{t("noneFound")}</Card>
        )}
        {equipment.map((item) => {
          const canEdit = item.ownerUser ? item.ownerUser.id === user.id : canManage;
          return (
            <Card key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="truncate text-sm text-muted">
                  {[equipmentCategoryLabels[item.category], item.location, item.description]
                    .filter(Boolean)
                    .join(" · ") || t("noFurtherInfo")}
                  {item.responsible && t("responsiblePrefix", { name: item.responsible.name })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={item.ownerUser ? "accent" : "default"}>
                  {item.ownerUser ? item.ownerUser.name : t("bandBadge")}
                </Badge>
                {canEdit && (
                  <>
                    <Link href={`/bands/${bandId}/equipment/${item.id}/edit`}>
                      <Button variant="secondary" size="sm">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <DeleteButton
                      action={deleteEquipmentAction.bind(null, bandId, item.id)}
                      label=""
                      confirmMessage={t("deleteConfirm")}
                    />
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {members.length > 1 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Users className="h-3.5 w-3.5" />
          {t("personalEquipmentHint")}
        </p>
      )}
    </div>
  );
}
