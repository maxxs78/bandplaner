"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { getEquipmentCategoryOptions } from "@/lib/equipment-categories";
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
  };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("equipment.form");
  const tEquipment = useTranslations("equipment");
  const equipmentCategoryOptions = getEquipmentCategoryOptions(tEquipment);

  return (
    <form action={formAction} className="space-y-4">
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

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
