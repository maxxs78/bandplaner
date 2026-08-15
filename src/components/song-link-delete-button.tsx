"use client";

import { useTransition } from "react";
import { X } from "lucide-react";

export function SongLinkDeleteButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Link entfernen"
      disabled={pending}
      className="shrink-0 text-muted hover:text-danger disabled:opacity-50"
      onClick={() => startTransition(() => action())}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
