"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createAbsenceAction, type FormState } from "@/app/(app)/bands/[bandId]/availability/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";

export function AbsenceForm({ bandId }: { bandId: string }) {
  const boundAction = createAbsenceAction.bind(null, bandId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    boundAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="startDate">Von</Label>
        <Input id="startDate" name="startDate" type="date" required />
      </div>
      <div>
        <Label htmlFor="endDate">Bis</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      <div className="flex-1 min-w-[160px]">
        <Label htmlFor="reason">Grund (optional)</Label>
        <Input id="reason" name="reason" type="text" placeholder="z. B. Urlaub" />
      </div>
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : "Eintragen"}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
