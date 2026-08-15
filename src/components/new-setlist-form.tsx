"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/setlists/actions";

export function NewSetlistForm({
  action,
  events,
  setlists,
  defaultEventId,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  events: { id: string; title: string; startsAt: string }[];
  setlists: { id: string; name: string }[];
  defaultEventId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="z. B. Hauptset Sommerfest" />
      </div>

      <div>
        <Label htmlFor="eventId">Termin verknüpfen (optional)</Label>
        <Select id="eventId" name="eventId" defaultValue={defaultEventId ?? ""}>
          <option value="">Kein Termin</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(e.startsAt))} – {e.title}
            </option>
          ))}
        </Select>
      </div>

      {setlists.length > 0 && (
        <div>
          <Label htmlFor="copyFromId">Als Vorlage kopieren (optional)</Label>
          <Select id="copyFromId" name="copyFromId" defaultValue="">
            <option value="">Leer beginnen</option>
            {setlists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Wird erstellt…" : "Setlist erstellen"}
      </Button>
    </form>
  );
}
