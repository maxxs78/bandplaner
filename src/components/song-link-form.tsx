"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

export function SongLinkForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Input
        name="url"
        type="url"
        required
        placeholder="https://…"
        className="flex-1 min-w-[180px]"
      />
      <Input name="label" placeholder="Bezeichnung (optional)" className="w-auto min-w-[140px]" />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Wird hinzugefügt…" : "Hinzufügen"}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
