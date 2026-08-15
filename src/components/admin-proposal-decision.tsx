"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminProposalDecision({
  onApprove,
  onReject,
}: {
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => onApprove())}
      >
        <Check className="h-4 w-4" />
        Vorschlag annehmen
      </Button>
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => onReject())}
      >
        <X className="h-4 w-4" />
        Vorschlag ablehnen
      </Button>
    </div>
  );
}
