"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export function SongLinkDeleteButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("songs.link");

  return (
    <button
      type="button"
      aria-label={t("remove")}
      disabled={pending}
      className="shrink-0 text-muted hover:text-danger disabled:opacity-50"
      onClick={() => startTransition(() => action())}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
