"use client";

import { useState, useActionState } from "react";
import { Save, X } from "lucide-react";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { getEquipmentCategoryOptions } from "@/lib/equipment-categories";
import {
  EQUIPMENT_ICON_GROUPS,
  EQUIPMENT_ICON_COLOR_PALETTE,
  equipmentIconLabelKey,
  type EquipmentIconKey,
} from "@/lib/equipment-icons";
import type { FormState } from "@/app/(app)/bands/[bandId]/equipment/actions";

export function EquipmentForm({
  action,
  members,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  members: { id: string; name: string }[];
  defaultValues?: {
    name?: string;
    description?: string;
    location?: string;
    ownerId?: string;
    responsibleId?: string;
    category?: string;
    icon?: string | null;
    color?: string | null;
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("equipment.form");
  const tEquipment = useTranslations("equipment");
  const tIcons = useTranslations("equipment.icons");
  const tIconGroups = useTranslations("equipment.iconGroups");
  const equipmentCategoryOptions = getEquipmentCategoryOptions(tEquipment);
  const [icon, setIcon] = useState<EquipmentIconKey | null>(
    (defaultValues?.icon as EquipmentIconKey | null) ?? null
  );
  const [color, setColor] = useState<string | null>(defaultValues?.color ?? null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="icon" value={icon ?? ""} />
      <input type="hidden" name="color" value={icon ? (color ?? "") : ""} />

      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">{t("category")}</Label>
          <Select id="category" name="category" defaultValue={defaultValues?.category ?? "OTHER"}>
            {equipmentCategoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="location">{t("location")}</Label>
          <Input
            id="location"
            name="location"
            placeholder={t("locationPlaceholder")}
            defaultValue={defaultValues?.location}
          />
        </div>
        <div>
          <Label htmlFor="ownerId">{t("owner")}</Label>
          <Select id="ownerId" name="ownerId" defaultValue={defaultValues?.ownerId ?? ""}>
            <option value="">{t("ownerBand")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {t("ownerPersonal", { name: m.name })}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="responsibleId">{t("responsible")}</Label>
          <Select id="responsibleId" name="responsibleId" defaultValue={defaultValues?.responsibleId ?? ""}>
            <option value="">{t("responsibleDefault")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={defaultValues?.description} />
      </div>

      <div>
        <Label>{t("icon")}</Label>
        <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIcon(null)}
              title={t("iconNone")}
              className={clsx(
                "flex h-11 w-11 items-center justify-center rounded-lg border text-muted",
                icon === null
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <X className="h-5 w-5" />
            </button>
            {EQUIPMENT_ICON_GROUPS.map((group) => (
              <div key={group.labelKey} className="w-full">
                <p className="mb-1.5 mt-1 text-xs font-medium text-muted">
                  {tIconGroups(group.labelKey)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.icons.map(({ key, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      title={tIcons(equipmentIconLabelKey(key))}
                      style={icon === key && color ? { color } : undefined}
                      className={clsx(
                        "flex h-11 w-11 items-center justify-center rounded-lg border p-2 text-foreground",
                        icon === key
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Icon className="h-full w-full" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {icon && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
              <span className="text-xs text-muted">{t("color")}:</span>
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-label={t("color")}
                className={clsx(
                  "h-6 w-6 rounded-full border border-border",
                  color === null && "ring-2 ring-primary ring-offset-1 ring-offset-surface"
                )}
              />
              {EQUIPMENT_ICON_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  style={{ backgroundColor: c }}
                  className={clsx(
                    "h-6 w-6 rounded-full",
                    color === c && "ring-2 ring-primary ring-offset-1 ring-offset-surface"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
