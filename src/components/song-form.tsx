"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

const statusOptions = [
  { value: "PROPOSED", label: "Vorschlag" },
  { value: "NEW", label: "Neu" },
  { value: "IN_PROGRESS", label: "In Erarbeitung" },
  { value: "STAGE_READY", label: "Bühnenreif" },
  { value: "ACTIVE", label: "Im aktiven Repertoire" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const statusLabels: Record<string, string> = Object.fromEntries(
  statusOptions.map((s) => [s.value, s.label])
);

export function SongForm({
  action,
  defaultValues,
  submitLabel,
  canEditStatus = true,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    key?: string;
    bpm?: string;
    timeSignature?: string;
    durationSec?: string;
    genre?: string;
    status?: string;
    lyrics?: string;
    remarks?: string;
  };
  submitLabel: string;
  /** Nur Admins dürfen den Status setzen/ändern - andere reichen Songs als Vorschlag ein. */
  canEditStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const totalDurationSec = Number(defaultValues?.durationSec) || 0;
  const defaultDurationMin = totalDurationSec ? Math.floor(totalDurationSec / 60) : undefined;
  const defaultDurationSecPart = totalDurationSec ? totalDurationSec % 60 : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="title">Titel</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="key">Tonart</Label>
          <Input id="key" name="key" placeholder="z. B. Am" defaultValue={defaultValues?.key} />
        </div>
        <div>
          <Label htmlFor="bpm">Tempo (BPM)</Label>
          <Input id="bpm" name="bpm" type="number" min={1} defaultValue={defaultValues?.bpm} />
        </div>
        <div>
          <Label htmlFor="timeSignature">Taktart</Label>
          <Input id="timeSignature" name="timeSignature" placeholder="4/4" defaultValue={defaultValues?.timeSignature} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="durationMin">Dauer (min:sek)</Label>
          <div className="flex items-center gap-1">
            <Input
              id="durationMin"
              name="durationMin"
              type="number"
              min={0}
              placeholder="min"
              className="w-full"
              defaultValue={defaultDurationMin}
            />
            <span className="text-muted">:</span>
            <Input
              id="durationSecPart"
              name="durationSecPart"
              type="number"
              min={0}
              max={59}
              placeholder="sek"
              className="w-full"
              defaultValue={defaultDurationSecPart}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="genre">Genre</Label>
          <Input id="genre" name="genre" defaultValue={defaultValues?.genre} />
        </div>
      </div>

      {canEditStatus ? (
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "NEW"}>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div>
          <input type="hidden" name="status" value={defaultValues?.status ?? "PROPOSED"} />
          <Label htmlFor="status">Status</Label>
          <p className="text-sm text-muted">
            {defaultValues?.status
              ? `${statusLabels[defaultValues.status] ?? defaultValues.status} (nur Admins können den Status ändern)`
              : "Wird als Vorschlag eingereicht und muss von der Band abgestimmt werden."}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="lyrics">Songtext</Label>
        <Textarea id="lyrics" name="lyrics" rows={6} defaultValue={defaultValues?.lyrics} />
      </div>

      <div>
        <Label htmlFor="remarks">Notizen</Label>
        <Textarea
          id="remarks"
          name="remarks"
          rows={3}
          placeholder="z. B. Live-Version, Sonderarrangement…"
          defaultValue={defaultValues?.remarks}
        />
        <p className="mt-1 text-xs text-muted">Für die ganze Band sichtbar.</p>
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : submitLabel}
      </Button>
    </form>
  );
}
