"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { useTranslations, useFormatter } from "next-intl";
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
  const t = useTranslations("setlists");
  const format = useFormatter();

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
      </div>

      <div>
        <Label htmlFor="eventId">{t("linkEventLabel")}</Label>
        <Select id="eventId" name="eventId" defaultValue={defaultEventId ?? ""}>
          <option value="">{t("noEvent")}</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {format.dateTime(new Date(e.startsAt), { dateStyle: "medium" })} – {e.title}
            </option>
          ))}
        </Select>
      </div>

      {setlists.length > 0 && (
        <div>
          <Label htmlFor="copyFromId">{t("copyFromLabel")}</Label>
          <Select id="copyFromId" name="copyFromId" defaultValue="">
            <option value="">{t("startEmpty")}</option>
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
        {pending ? t("creating") : t("createSubmit")}
      </Button>
    </form>
  );
}
