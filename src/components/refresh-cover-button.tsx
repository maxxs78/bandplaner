"use client";

import { useState, useTransition } from "react";
import { ImageDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function RefreshCoverButton({
  action,
}: {
  action: () => Promise<{ found: boolean }>;
}) {
  const [pending, startTransition] = useTransition();
  const [notFound, setNotFound] = useState(false);
  const td = useTranslations("songs.detail");

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setNotFound(false);
          startTransition(async () => {
            const result = await action();
            if (!result.found) setNotFound(true);
          });
        }}
      >
        <ImageDown className="h-4 w-4" />
        {pending ? td("refreshInfoPending") : td("refreshInfo")}
      </Button>
      {notFound && <p className="mt-1 text-xs text-muted">{td("refreshInfoNotFound")}</p>}
    </div>
  );
}
