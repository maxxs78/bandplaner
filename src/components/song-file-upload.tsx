"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, FieldError } from "@/components/ui/input";
import { songFileVisibilityOptions } from "@/lib/band-file-categories";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

export function SongFileUpload({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <input
          type="file"
          name="file"
          required
          accept=".mp3,.wav,.ogg,.m4a,.pdf,.gp,.gp3,.gp4,.gp5,.gpx,audio/*,application/pdf"
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
        />
      </div>
      <Select name="visibility" defaultValue="BAND" className="max-w-[14rem]">
        {songFileVisibilityOptions.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" disabled={pending}>
        <Upload className="h-4 w-4" />
        {pending ? "Wird hochgeladen…" : "Hochladen"}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
