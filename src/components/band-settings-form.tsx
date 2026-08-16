"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
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

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="defaultGuestAccessDays">Gastzugang läuft automatisch ab nach</Label>
        <div className="flex items-center gap-2">
          <Input
            id="defaultGuestAccessDays"
            name="defaultGuestAccessDays"
            type="number"
            min={1}
            max={3650}
            placeholder="unbegrenzt"
            defaultValue={initialDefaultGuestAccessDays ?? ""}
            className="max-w-[8rem]"
          />
          <span className="text-sm text-muted">Tagen</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Befüllt bei neuen Gast-Einladungen automatisch das Ablaufdatum vor – bleibt dort weiterhin frei
          änderbar. Leer lassen für unbegrenzten Zugriff als Standard (wie bisher).
        </p>
      </div>

      <ToggleRow
        name="publicFileLinksEnabled"
        label="Öffentliche Datei-Links"
        description="Erlaubt, Dateien über einen loginfreien Link zu teilen. Bei Deaktivierung funktionieren auch bereits bestehende Links nicht mehr, bis du das hier wieder einschaltest."
        checked={publicFileLinksEnabled}
        onChange={setPublicFileLinksEnabled}
      />

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </form>
  );
}
