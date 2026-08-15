"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/equipment/actions";

export function NewPacklistForm({
  action,
  events,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  events: { id: string; title: string; startsAt: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="z. B. Packliste Sommerfest" />
      </div>

      <div>
        <Label htmlFor="eventId">Termin verknüpfen (optional)</Label>
        <Select id="eventId" name="eventId" defaultValue="">
          <option value="">Kein Termin</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(e.startsAt))} – {e.title}
            </option>
          ))}
        </Select>
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Wird erstellt…" : "Packliste erstellen"}
      </Button>
    </form>
  );
}
