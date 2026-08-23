"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/calendar/actions";

const typeValues = ["REHEARSAL", "GIG", "MEETING", "OTHER"] as const;
const gigStatusValues = ["INQUIRY", "CONFIRMED", "CANCELLED", "DONE"] as const;

const TEXT_LOCATION = "";
const NEW_LOCATION = "__new_location__";

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
  locations,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    type?: string;
    startsAt?: string;
    endsAt?: string;
    location?: string;
    locationId?: string;
    description?: string;
    participantIds?: string[];
    arrivalAt?: string;
    soundcheckAt?: string;
    technicalRequirements?: string;
    gigStatus?: string;
  };
  submitLabel: string;
  allowRepeat?: boolean;
  members: { id: string; name: string }[];
  currentUserId: string;
  /** Nur übergeben, wenn das Orte-Feature für die Band aktiv ist - sonst bleibt es beim einfachen Freitextfeld. */
  locations?: { id: string; name: string; address: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [type, setType] = useState(defaultValues?.type ?? "REHEARSAL");
  const hasExplicitDefaults = defaultValues?.participantIds !== undefined;
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    () => new Set(defaultValues?.participantIds ?? defaultParticipantIds(type, members, currentUserId))
  );
  const t = useTranslations("event");
  const tEventTypes = useTranslations("calendar.eventTypes");

  const [locationChoice, setLocationChoice] = useState(defaultValues?.locationId ?? TEXT_LOCATION);
  const locationMode =
    locationChoice === NEW_LOCATION ? "new" : locationChoice === TEXT_LOCATION ? "text" : "existing";
  const selectedLocation = locations?.find((l) => l.id === locationChoice);

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
        <Label htmlFor="title">{t("title")}</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">{t("type")}</Label>
          <Select id="type" name="type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {typeValues.map((value) => (
              <option key={value} value={value}>
                {tEventTypes(value)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="location">{t("location")}</Label>
          {locations ? (
            <>
              <Select
                id="location"
                value={locationChoice}
                onChange={(e) => setLocationChoice(e.target.value)}
              >
                <option value={TEXT_LOCATION}>{t("locationModeText")}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
                <option value={NEW_LOCATION}>{t("locationModeNew")}</option>
              </Select>
              <input type="hidden" name="locationMode" value={locationMode} />

              {locationMode === "text" && (
                <Input
                  name="location"
                  placeholder={t("locationPlaceholder")}
                  defaultValue={defaultValues?.location}
                  className="mt-2"
                />
              )}
              {locationMode === "existing" && (
                <>
                  <input type="hidden" name="locationId" value={locationChoice} />
                  {selectedLocation?.address && (
                    <p className="mt-1 text-xs text-muted">{selectedLocation.address}</p>
                  )}
                </>
              )}
              {locationMode === "new" && (
                <div className="mt-2 space-y-2 rounded-lg border border-border p-2">
                  <Input name="newLocationName" placeholder={t("newLocationNamePlaceholder")} required />
                  <Input name="newLocationAddress" placeholder={t("newLocationAddressPlaceholder")} />
                </div>
              )}
            </>
          ) : (
            <Input id="location" name="location" defaultValue={defaultValues?.location} />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">{t("start")}</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultValues?.startsAt}
          />
        </div>
        <div>
          <Label htmlFor="endsAt">{t("end")}</Label>
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
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={defaultValues?.description} />
      </div>

      {type === "GIG" && (
        <div className="space-y-4 rounded-lg border border-border p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="arrivalAt">{t("gig.arrivalAt")}</Label>
              <Input id="arrivalAt" name="arrivalAt" type="datetime-local" defaultValue={defaultValues?.arrivalAt} />
            </div>
            <div>
              <Label htmlFor="soundcheckAt">{t("gig.soundcheckAt")}</Label>
              <Input
                id="soundcheckAt"
                name="soundcheckAt"
                type="datetime-local"
                defaultValue={defaultValues?.soundcheckAt}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="gigStatus">{t("gig.status")}</Label>
            <Select id="gigStatus" name="gigStatus" defaultValue={defaultValues?.gigStatus ?? "INQUIRY"}>
              {gigStatusValues.map((value) => (
                <option key={value} value={value}>
                  {t(`gig.statusValues.${value}`)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="technicalRequirements">{t("gig.technicalRequirements")}</Label>
            <Textarea
              id="technicalRequirements"
              name="technicalRequirements"
              rows={2}
              placeholder={t("gig.technicalRequirementsPlaceholder")}
              defaultValue={defaultValues?.technicalRequirements}
            />
          </div>
        </div>
      )}

      <div>
        <Label>{t("participants")}</Label>
        <p className="mb-2 text-xs text-muted">{t("participantsHint")}</p>
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
              {m.id === currentUserId && <span className="text-muted">{t("you")}</span>}
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
            {t("repeatWeekly")}
          </label>
          {repeatWeekly && (
            <div className="mt-3">
              <Label htmlFor="repeatUntil">{t("repeatUntil")}</Label>
              <Input id="repeatUntil" name="repeatUntil" type="date" required={repeatWeekly} />
            </div>
          )}
        </div>
      )}

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
