"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { ToggleRow } from "@/components/ui/toggle-row";
import type { FormState } from "@/app/(app)/bands/[bandId]/settings/actions";

export function FeatureTogglesForm({
  action,
  initialEquipmentEnabled,
  initialPacklistsEnabled,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialEquipmentEnabled: boolean;
  initialPacklistsEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [equipmentEnabled, setEquipmentEnabled] = useState(initialEquipmentEnabled);
  const [packlistsEnabled, setPacklistsEnabled] = useState(initialPacklistsEnabled);

  return (
    <form action={formAction} className="space-y-3">
      <ToggleRow
        name="equipmentEnabled"
        label="Equipment"
        description="Equipment-Katalog für die Band und einzelne Mitglieder (Instrumente, Technik, Zubehör)."
        checked={equipmentEnabled}
        onChange={setEquipmentEnabled}
      />
      <ToggleRow
        name="packlistsEnabled"
        label="Packlisten"
        description={
          equipmentEnabled
            ? "Checklisten für Proben und Gigs, gebaut aus dem Equipment-Katalog."
            : "Benötigt Equipment (siehe oben) – bleibt deaktiviert, solange Equipment aus ist."
        }
        checked={equipmentEnabled && packlistsEnabled}
        disabled={!equipmentEnabled}
        onChange={setPacklistsEnabled}
      />
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </form>
  );
}
