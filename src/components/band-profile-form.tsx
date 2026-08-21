"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("bandMembers.form");

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div>
        <Label htmlFor="name">{t("bandName")}</Label>
        <Input id="name" name="name" required defaultValue={defaultValues.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="genre">{t("genre")}</Label>
          <Input id="genre" name="genre" placeholder={t("genrePlaceholder")} defaultValue={defaultValues.genre ?? ""} />
        </div>
        <div>
          <Label htmlFor="location">{t("location")}</Label>
          <Input id="location" name="location" placeholder={t("locationPlaceholder")} defaultValue={defaultValues.location ?? ""} />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">{t("bio")}</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={defaultValues.bio ?? ""} />
      </div>

      <div>
        <Label htmlFor="contactEmail">{t("contactEmail")}</Label>
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
          <Label htmlFor="websiteUrl">{t("website")}</Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://…"
            defaultValue={defaultValues.websiteUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="spotifyUrl">{t("spotify")}</Label>
          <Input
            id="spotifyUrl"
            name="spotifyUrl"
            type="url"
            placeholder="https://open.spotify.com/…"
            defaultValue={defaultValues.spotifyUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="instagramUrl">{t("instagram")}</Label>
          <Input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            placeholder="https://instagram.com/…"
            defaultValue={defaultValues.instagramUrl ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="facebookUrl">{t("facebook")}</Label>
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
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
