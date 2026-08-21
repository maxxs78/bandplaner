"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

export function SongLinkForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("songs.link");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input
        name="url"
        type="url"
        required
        placeholder={t("urlPlaceholder")}
        className="flex-1 min-w-[180px]"
      />
      <Input name="label" placeholder={t("labelPlaceholder")} className="w-auto min-w-[140px]" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? t("adding") : t("add")}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
