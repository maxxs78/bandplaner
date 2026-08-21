"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  label,
  confirmMessage,
}: {
  action: () => Promise<void>;
  label?: string;
  confirmMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("common");
  const resolvedLabel = label ?? t("delete");
  const resolvedConfirmMessage = confirmMessage ?? t("deleteConfirmDefault");

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm(resolvedConfirmMessage)) {
          startTransition(() => action());
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? t("deleting") : resolvedLabel}
    </Button>
  );
}
