"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  label = "Löschen",
  confirmMessage = "Bist du sicher? Dies kann nicht rückgängig gemacht werden.",
}: {
  action: () => Promise<void>;
  label?: string;
  confirmMessage?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm(confirmMessage)) {
          startTransition(() => action());
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Wird gelöscht…" : label}
    </Button>
  );
}
