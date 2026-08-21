"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/toggle-row";
import type { FormState } from "@/app/(app)/bands/[bandId]/settings/actions";

export function BandSettingsForm({
  action,
  initialDefaultGuestAccessDays,
  initialPublicFileLinksEnabled,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialDefaultGuestAccessDays: number | null;
  initialPublicFileLinksEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [publicFileLinksEnabled, setPublicFileLinksEnabled] = useState(initialPublicFileLinksEnabled);
  const t = useTranslations("bandSettings");
  const tForm = useTranslations("bandSettings.settingsForm");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="defaultGuestAccessDays">{tForm("guestAccessLabel")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="defaultGuestAccessDays"
            name="defaultGuestAccessDays"
            type="number"
            min={1}
            max={3650}
            placeholder={tForm("unlimited")}
            defaultValue={initialDefaultGuestAccessDays ?? ""}
            className="max-w-[8rem]"
          />
          <span className="text-sm text-muted">{tForm("days")}</span>
        </div>
        <p className="mt-1 text-xs text-muted">{tForm("guestAccessHint")}</p>
      </div>

      <ToggleRow
        name="publicFileLinksEnabled"
        label={tForm("publicFileLinks")}
        description={tForm("publicFileLinksDescription")}
        checked={publicFileLinksEnabled}
        onChange={setPublicFileLinksEnabled}
      />

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
