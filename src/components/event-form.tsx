"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/calendar/actions";

const typeOptions = [
  { value: "REHEARSAL", label: "Probe" },
  { value: "GIG", label: "Auftritt" },
  { value: "MEETING", label: "Meeting" },
  { value: "OTHER", label: "Sonstiges" },
];

/** Probe/Auftritt betreffen standardmäßig alle Mitglieder, alle anderen Terminarten nur die/den Ersteller:in. */
function defaultParticipantIds(type: string, members: { id: string }[], currentUserId: string) {
  return type === "REHEARSAL" || type === "GIG"
    ? members.map((m) => m.id)
    : [currentUserId];
}

export function EventForm({
  action,
  defaultValues,
  submitLabel,
  allowRepeat = false,
  members,
  currentUserId,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    type?: string;
    startsAt?: string;
    endsAt?: string;
    location?: string;
    description?: string;
    participantIds?: string[];
  };
  submitLabel: string;
  allowRepeat?: boolean;
  members: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [type, setType] = useState(defaultValues?.type ?? "REHEARSAL");
  const hasExplicitDefaults = defaultValues?.participantIds !== undefined;
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(defaultValues?.participantIds ?? defaultParticipantIds(type, members, currentUserId))
  );

  function handleTypeChange(newType: string) {
    setType(newType);
    // Die Terminart-Vorbelegung nur anwenden, solange noch keine explizite Teilnehmerliste
    // vorgegeben ist (Neuanlage) - beim Bearbeiten bleibt eine bereits gespeicherte Auswahl erhalten.
    if (!hasExplicitDefaults) {
      setParticipantIds(new Set(defaultParticipantIds(newType, members, currentUserId)));
    }
  }

  function toggleParticipant(id: string) {
    setParticipantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="title">Titel</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">Art</Label>
          <Select id="type" name="type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {typeOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="location">Ort</Label>
          <Input id="location" name="location" defaultValue={defaultValues?.location} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">Start</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultValues?.startsAt}
          />
        </div>
        <div>
          <Label htmlFor="endsAt">Ende</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={defaultValues?.endsAt}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={defaultValues?.description} />
      </div>

      <div>
        <Label>Teilnehmer</Label>
        <p className="mb-2 text-xs text-muted">
          Bei Probe/Auftritt standardmäßig alle Mitglieder, bei Meeting/Sonstiges nur du - hier anpassbar.
        </p>
        <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="participantIds"
                value={m.id}
                checked={participantIds.has(m.id)}
                onChange={() => toggleParticipant(m.id)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {m.name}
              {m.id === currentUserId && <span className="text-muted"> (du)</span>}
            </label>
          ))}
        </div>
      </div>

      {allowRepeat && (
        <div className="rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="repeatWeekly"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Wöchentlich wiederholen
          </label>
          {repeatWeekly && (
            <div className="mt-3">
              <Label htmlFor="repeatUntil">Wiederholen bis</Label>
              <Input id="repeatUntil" name="repeatUntil" type="date" required={repeatWeekly} />
            </div>
          )}
        </div>
      )}

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : submitLabel}
      </Button>
    </form>
  );
}
