"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Music, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ImageFormState } from "@/components/image-upload-form";

/**
 * Wie ImageUploadForm (Avatare/Band-Bild), aber mit quadratischem statt
 * rundem Vorschaubild - passend zum Cover-Stil in Songliste/-detailansicht.
 */
export function SongCoverUploadForm({
  action,
  removeAction,
  currentSrc,
}: {
  action: (prevState: ImageFormState, formData: FormData) => Promise<ImageFormState>;
  removeAction: () => Promise<void>;
  currentSrc?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, startRemoveTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations("imageUpload");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    formRef.current?.requestSubmit();
  }

  const displaySrc = preview ?? currentSrc;

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-4">
      {displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-muted">
          <Music className="h-6 w-6" />
        </span>
      )}
      <div>
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending || removing}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {pending ? t("uploading") : t("change")}
          </Button>
          {displaySrc && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || removing}
              onClick={() => {
                setPreview(null);
                startRemoveTransition(() => removeAction());
              }}
            >
              <X className="h-4 w-4" />
              {t("remove")}
            </Button>
          )}
        </div>
        {state?.error && <p className="mt-1 text-sm text-danger">{state.error}</p>}
      </div>
    </form>
  );
}
