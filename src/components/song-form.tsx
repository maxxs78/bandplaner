"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/songs/actions";

const statusValues = ["PROPOSED", "NEW", "IN_PROGRESS", "STAGE_READY", "ACTIVE", "ARCHIVED"] as const;

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
    artist?: string;
    status?: string;
    lyrics?: string;
    remarks?: string;
  };
  submitLabel: string;
  /** Nur Admins dürfen den Status setzen/ändern - andere reichen Songs als Vorschlag ein. */
  canEditStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("songs");
  const td = useTranslations("songs.detail");
  const tf = useTranslations("songs.form");
  const totalDurationSec = Number(defaultValues?.durationSec) || 0;
  const defaultDurationMin = totalDurationSec ? Math.floor(totalDurationSec / 60) : undefined;
  const defaultDurationSecPart = totalDurationSec ? totalDurationSec % 60 : undefined;

  const statusLabel = (value: string) =>
    value === "ACTIVE" ? td("activeStatusFull") : t(`statusLabels.${value}`);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="title">{tf("title")}</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="key">{tf("key")}</Label>
          <Input id="key" name="key" placeholder={tf("keyPlaceholder")} defaultValue={defaultValues?.key} />
        </div>
        <div>
          <Label htmlFor="bpm">{tf("tempo")}</Label>
          <Input id="bpm" name="bpm" type="number" min={1} defaultValue={defaultValues?.bpm} />
        </div>
        <div>
          <Label htmlFor="timeSignature">{tf("timeSignature")}</Label>
          <Input id="timeSignature" name="timeSignature" placeholder="4/4" defaultValue={defaultValues?.timeSignature} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="durationMin">{tf("duration")}</Label>
          <div className="flex items-center gap-1">
            <Input
              id="durationMin"
              name="durationMin"
              type="number"
              min={0}
              placeholder={tf("durationMinPlaceholder")}
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
              placeholder={tf("durationSecPlaceholder")}
              className="w-full"
              defaultValue={defaultDurationSecPart}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="genre">{tf("genre")}</Label>
          <Input id="genre" name="genre" defaultValue={defaultValues?.genre} />
        </div>
        <div>
          <Label htmlFor="artist">{tf("artist")}</Label>
          <Input
            id="artist"
            name="artist"
            placeholder={tf("artistPlaceholder")}
            defaultValue={defaultValues?.artist}
          />
        </div>
      </div>

      {canEditStatus ? (
        <div>
          <Label htmlFor="status">{tf("status")}</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "NEW"}>
            {statusValues.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div>
          <input type="hidden" name="status" value={defaultValues?.status ?? "PROPOSED"} />
          <Label htmlFor="status">{tf("status")}</Label>
          <p className="text-sm text-muted">
            {defaultValues?.status
              ? `${statusLabel(defaultValues.status)} ${tf("statusReadonlySuffix")}`
              : tf("statusProposalHint")}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="lyrics">{tf("lyrics")}</Label>
        <Textarea id="lyrics" name="lyrics" rows={6} defaultValue={defaultValues?.lyrics} />
      </div>

      <div>
        <Label htmlFor="remarks">{tf("notes")}</Label>
        <Textarea
          id="remarks"
          name="remarks"
          rows={3}
          placeholder={tf("notesPlaceholder")}
          defaultValue={defaultValues?.remarks}
        />
        <p className="mt-1 text-xs text-muted">{tf("notesVisibility")}</p>
      </div>

      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? tf("saving") : submitLabel}
      </Button>
    </form>
  );
}
