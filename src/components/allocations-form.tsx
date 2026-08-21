"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { ConfirmAllocationStatus } from "@/components/confirm-allocation-status";
import { memberReceivesAllocation } from "@/lib/finance-entry-labels";
import type { FormState } from "@/app/(app)/bands/[bandId]/finance/actions";
import type { FinanceEntryType } from "@/generated/prisma/client";

function toEuroString(cents: number | null | undefined) {
  return cents ? (cents / 100).toFixed(2) : "";
}

export function AllocationsForm({
  action,
  confirmAction,
  entryType,
  currentUserId,
  isFinanceAdmin,
  members,
  existingAllocations,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  confirmAction: (allocationId: string) => Promise<void>;
  entryType: FinanceEntryType;
  currentUserId: string;
  isFinanceAdmin: boolean;
  members: { id: string; name: string; defaultAmountCents: number | null }[];
  existingAllocations: Record<string, { id: string; amountCents: number; confirmedAt: Date | null }>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("finance.allocationsForm");
  // Kontrollierte Felder statt defaultValue: React setzt unkontrollierte
  // Formularfelder nach jedem Server-Action-Submit zurück (auch bei Fehlern) -
  // damit gingen bereits eingegebene Beträge nach einer fehlgeschlagenen
  // Summenprüfung verloren.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => [m.id, toEuroString(existingAllocations[m.id]?.amountCents ?? m.defaultAmountCents)])
    )
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        {members.map((m) => {
          const existing = existingAllocations[m.id];
          const canConfirm =
            existing &&
            !existing.confirmedAt &&
            (memberReceivesAllocation(entryType) ? m.id === currentUserId : isFinanceAdmin);
          return (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <Label htmlFor={`allocation_${m.id}`}>{m.name}</Label>
              <div className="flex items-center gap-2">
                {existing && (
                  <ConfirmAllocationStatus
                    confirmedAt={existing.confirmedAt}
                    canConfirm={!!canConfirm}
                    allocationId={existing.id}
                    confirmAction={confirmAction}
                  />
                )}
                <div className="flex items-center gap-1">
                  <Input
                    id={`allocation_${m.id}`}
                    name={`allocation_${m.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={amounts[m.id] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="max-w-[8rem]"
                  />
                  <span className="text-sm text-muted">€</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : t(`submitLabels.${entryType}`)}
      </Button>
    </form>
  );
}
