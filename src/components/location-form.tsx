"use client";

import { useActionState, useRef, useState } from "react";
import { Save, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AddressMap } from "@/components/address-map";
import type { FormState } from "@/app/(app)/bands/[bandId]/locations/actions";
import type { GeocodeCandidate } from "@/lib/geocoding";

export function LocationForm({
  action,
  defaultValues,
  submitLabel,
  geocodeAction,
  reverseGeocodeAction,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    name?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    website?: string;
    capacity?: string;
    stageAndTechNotes?: string;
    loadingAndParkingNotes?: string;
    notes?: string;
  };
  submitLabel: string;
  /** Bereits mit der Band-ID gebundene Server Actions für den Adress-Karten-Abgleich. */
  geocodeAction: (query: string) => Promise<GeocodeCandidate[]>;
  reverseGeocodeAction: (latitude: number, longitude: number) => Promise<string | null>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("locations.form");

  const addressRef = useRef<HTMLInputElement>(null);
  const [latitude, setLatitude] = useState<number | null>(
    defaultValues?.latitude ? Number(defaultValues.latitude) : null
  );
  const [longitude, setLongitude] = useState<number | null>(
    defaultValues?.longitude ? Number(defaultValues.longitude) : null
  );
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  function applyCandidate(candidate: GeocodeCandidate) {
    if (addressRef.current) addressRef.current.value = candidate.displayName;
    setLatitude(candidate.latitude);
    setLongitude(candidate.longitude);
    setCandidates(null);
  }

  async function handleSearch() {
    const query = addressRef.current?.value.trim();
    if (!query) return;
    setSearching(true);
    setCandidates(null);
    try {
      const results = await geocodeAction(query);
      setCandidates(results);
    } finally {
      setSearching(false);
    }
  }

  async function handleMapPick(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setLocating(true);
    try {
      const address = await reverseGeocodeAction(lat, lng);
      if (address && addressRef.current) addressRef.current.value = address;
    } finally {
      setLocating(false);
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="latitude" value={latitude ?? ""} />
      <input type="hidden" name="longitude" value={longitude ?? ""} />

      <div>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} />
      </div>

      <div>
        <Label htmlFor="address">{t("address")}</Label>
        <div className="flex gap-2">
          <Input
            id="address"
            name="address"
            placeholder={t("addressPlaceholder")}
            defaultValue={defaultValues?.address}
            ref={addressRef}
            className="flex-1"
          />
          <Button type="button" variant="secondary" onClick={handleSearch} disabled={searching}>
            <Search className="h-4 w-4" />
            {searching ? t("searching") : t("search")}
          </Button>
        </div>

        {candidates && (
          <Card className="mt-2 space-y-1.5 bg-surface-muted">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted">{t("noResults")}</p>
            ) : (
              candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyCandidate(c)}
                  className="block w-full truncate rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:border-primary hover:bg-surface"
                >
                  {c.displayName}
                </button>
              ))
            )}
          </Card>
        )}

        <div className="mt-2 space-y-1">
          <AddressMap latitude={latitude} longitude={longitude} onPick={handleMapPick} pinAlt={t("mapPinAlt")} />
          <p className="text-xs text-muted">{locating ? t("locating") : t("mapHint")}</p>
          {latitude != null && longitude != null && (
            <p className="text-xs text-muted">
              {t("coordinates", { lat: latitude.toFixed(5), lng: longitude.toFixed(5) })}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contactName">{t("contactName")}</Label>
          <Input id="contactName" name="contactName" defaultValue={defaultValues?.contactName} />
        </div>
        <div>
          <Label htmlFor="contactPhone">{t("contactPhone")}</Label>
          <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={defaultValues?.contactPhone} />
        </div>
        <div>
          <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultValues?.contactEmail} />
        </div>
        <div>
          <Label htmlFor="website">{t("website")}</Label>
          <Input id="website" name="website" type="url" placeholder="https://…" defaultValue={defaultValues?.website} />
        </div>
      </div>

      <div>
        <Label htmlFor="capacity">{t("capacity")}</Label>
        <Input id="capacity" name="capacity" type="number" min={1} className="max-w-[10rem]" defaultValue={defaultValues?.capacity} />
      </div>

      <div>
        <Label htmlFor="stageAndTechNotes">{t("stageAndTechNotes")}</Label>
        <Textarea
          id="stageAndTechNotes"
          name="stageAndTechNotes"
          rows={3}
          placeholder={t("stageAndTechNotesPlaceholder")}
          defaultValue={defaultValues?.stageAndTechNotes}
        />
      </div>

      <div>
        <Label htmlFor="loadingAndParkingNotes">{t("loadingAndParkingNotes")}</Label>
        <Textarea
          id="loadingAndParkingNotes"
          name="loadingAndParkingNotes"
          rows={3}
          placeholder={t("loadingAndParkingNotesPlaceholder")}
          defaultValue={defaultValues?.loadingAndParkingNotes}
        />
      </div>

      <div>
        <Label htmlFor="notes">{t("notes")}</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaultValues?.notes} />
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}
