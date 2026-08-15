"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Label, FieldError } from "@/components/ui/input";
import { bandFileCategoryOptions, bandFileVisibilityOptions } from "@/lib/band-file-categories";
import type { FormState } from "@/app/(app)/bands/[bandId]/files/actions";

export function BandFileUpload({
  action,
  events,
  songs,
  equipment,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  events: { id: string; title: string }[];
  songs: { id: string; title: string }[];
  equipment: { id: string; name: string }[];
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
            {bandFileCategoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="visibility">Sichtbarkeit</Label>
          <Select id="visibility" name="visibility" defaultValue="INTERNAL">
            {bandFileVisibilityOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
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
        <div>
          <Label htmlFor="equipmentId">Verknüpftes Equipment</Label>
          <Select id="equipmentId" name="equipmentId" defaultValue="">
            <option value="">– keines –</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
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

/** Schlanke Variante ohne Song-/Termin-/Equipment-Auswahl - für das Hochladen direkt
 * auf der Detailseite eines Termins oder Equipment-Eintrags, wo die Verknüpfung durch
 * den Kontext bereits feststeht (in der gebundenen Server Action vorbelegt). */
export function MinimalFileUpload({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
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
            {bandFileCategoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="visibility">Sichtbarkeit</Label>
          <Select id="visibility" name="visibility" defaultValue="INTERNAL">
            {bandFileVisibilityOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
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
