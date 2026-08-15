"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Label, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/files/actions";

const categoryOptions = [
  { value: "NOTES", label: "Noten" },
  { value: "CONTRACTS", label: "Verträge" },
  { value: "PHOTOS", label: "Fotos" },
  { value: "RECORDINGS", label: "Aufnahmen" },
  { value: "OTHER", label: "Sonstiges" },
];

export function BandFileUpload({
  action,
  events,
  songs,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  events: { id: string; title: string }[];
  songs: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="file"
        name="file"
        required
        className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Kategorie</Label>
          <Select id="category" name="category" defaultValue="OTHER">
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="visibility">Sichtbarkeit</Label>
          <Select id="visibility" name="visibility" defaultValue="INTERNAL">
            <option value="INTERNAL">Bandintern</option>
            <option value="PUBLIC">Öffentlich (per Link teilbar)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="songId">Verknüpfter Song</Label>
          <Select id="songId" name="songId" defaultValue="">
            <option value="">– keiner –</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="eventId">Verknüpfter Termin</Label>
          <Select id="eventId" name="eventId" defaultValue="">
            <option value="">– keiner –</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="sm" disabled={pending}>
        <Upload className="h-4 w-4" />
        {pending ? "Wird hochgeladen…" : "Hochladen"}
      </Button>
    </form>
  );
}
