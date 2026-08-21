"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import type { FormState } from "@/app/(app)/bands/[bandId]/settings/actions";

export function FinanceAdminsForm({
  action,
  members,
  initialFinanceAdminIds,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  members: { id: string; name: string }[];
  initialFinanceAdminIds: string[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("bandSettings");

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        {members.map((m) => (
          <label
            key={m.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-primary"
          >
            <input
              type="checkbox"
              name="financeAdminIds"
              value={m.id}
              defaultChecked={initialFinanceAdminIds.includes(m.id)}
              className="h-4 w-4 shrink-0 accent-primary"
            />
            <p className="text-sm font-medium text-foreground">{m.name}</p>
          </label>
        ))}
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
