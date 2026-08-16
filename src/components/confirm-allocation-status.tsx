"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function ConfirmAllocationStatus({
  confirmedAt,
  canConfirm,
  allocationId,
  confirmAction,
}: {
  confirmedAt: Date | null;
  canConfirm: boolean;
  allocationId: string;
  confirmAction: (allocationId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  if (confirmedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="h-3.5 w-3.5" />
        bestätigt {new Intl.DateTimeFormat("de-DE", { dateStyle: "short" }).format(confirmedAt)}
      </span>
    );
  }

  if (!canConfirm) {
    return <span className="text-xs text-warning">ausstehend</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await confirmAction(allocationId);
        setPending(false);
      }}
      className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:border-primary disabled:opacity-60"
    >
      {pending ? "…" : "Bestätigen"}
    </button>
  );
}
