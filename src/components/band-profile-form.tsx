"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/members/actions";

export function BandProfileForm({
  action,
  defaultValues,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  defaultValues: {
    name: string;
    genre?: string | null;
    bio?: string | null;
    location?: string | null;
    contactEmail?: string | null;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    spotifyUrl?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <Label htmlFor="name">Bandname</Label>
        <Input id="name" name="name" required defaultValue={defaultValues.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="genre">Genre</Label>
          <Input id="genre" name="genre" placeholder="z. B. Indie Rock" defaultValue={defaultValues.genre ?? ""} />
        </div>
        <div>
          <Label htmlFor="location">Standort</Label>
          <Input id="location" name="location" placeholder="z. B. Hamburg" defaultValue={defaultValues.location ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Kurzbeschreibung</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={defaultValues.bio ?? ""} />
      </div>

      <div>
        <Label htmlFor="contactEmail">Kontakt-E-Mail</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          placeholder="booking@band.de"
          defaultValue={defaultValues.contactEmail ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="websiteUrl">Website</Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://…"
            defaultValue={defaultValues.websiteUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="spotifyUrl">Spotify</Label>
          <Input
            id="spotifyUrl"
            name="spotifyUrl"
            type="url"
            placeholder="https://open.spotify.com/…"
            defaultValue={defaultValues.spotifyUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="instagramUrl">Instagram</Label>
          <Input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            placeholder="https://instagram.com/…"
            defaultValue={defaultValues.instagramUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="facebookUrl">Facebook</Label>
          <Input
            id="facebookUrl"
            name="facebookUrl"
            type="url"
            placeholder="https://facebook.com/…"
            defaultValue={defaultValues.facebookUrl ?? ""}
          />
        </div>
      </div>

      <FieldError>{state?.error}</FieldError>
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </form>
  );
}
