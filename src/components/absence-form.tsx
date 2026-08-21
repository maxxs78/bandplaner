"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createAbsenceAction, type FormState } from "@/app/(app)/bands/[bandId]/availability/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export function AbsenceForm({ bandId }: { bandId: string }) {
  const boundAction = createAbsenceAction.bind(null, bandId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    boundAction,
    undefined
  );
  const t = useTranslations("absenceForm");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="startDate">{t("from")}</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="endDate">{t("to")}</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      <div className="flex-1 min-w-[160px]">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Input id="reason" name="reason" type="text" placeholder={t("reasonPlaceholder")} />
      </div>
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? t("saving") : t("submit")}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
