"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { inviteAction, type FormState } from "@/app/(app)/bands/[bandId]/members/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { Role } from "@/generated/prisma/client";

export function InviteForm({ bandId, defaultGuestUntil }: { bandId: string; defaultGuestUntil?: string }) {
  const boundAction = inviteAction.bind(null, bandId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    boundAction,
    undefined
  );
  const [role, setRole] = useState<Role>("MEMBER");
  const t = useTranslations("bandMembers.inviteForm");
  const tRoles = useTranslations("dashboard.roles");
  const roleOptions: { value: Role; label: string }[] = [
    { value: "MEMBER", label: tRoles("MEMBER") },
    { value: "ADMIN", label: tRoles("ADMIN") },
    { value: "GUEST", label: tRoles("GUEST") },
  ];

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="invite-email">{t("email")}</Label>
        <Input id="invite-email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="invite-role">{t("role")}</Label>
        <Select
          id="invite-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      {role === "GUEST" && (
        <div>
          <Label htmlFor="invite-guestUntil">{t("guestUntil")}</Label>
          <Input id="invite-guestUntil" name="guestUntil" type="date" defaultValue={defaultGuestUntil} />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        <Send className="h-4 w-4" />
        {pending ? t("sending") : t("invite")}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
        {state?.success && <p className="mt-1 text-sm text-success">{state.success}</p>}
        {role === "GUEST" && (
          <p className="mt-1 text-xs text-muted">
            {defaultGuestUntil ? t("guestHintPrefilled") : t("guestHintDefault")}
          </p>
        )}
      </div>
    </form>
  );
}
