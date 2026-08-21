"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";

export type ImageFormState = { error?: string; success?: boolean } | undefined;

export function ImageUploadForm({
  action,
  removeAction,
  currentSrc,
  name,
  size = "xl",
}: {
  action: (prevState: ImageFormState, formData: FormData) => Promise<ImageFormState>;
  removeAction?: () => Promise<void>;
  currentSrc?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
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
      <Avatar src={displaySrc} name={name} size={size} />
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
          {removeAction && displaySrc && (
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
