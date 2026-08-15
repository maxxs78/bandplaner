"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { inviteAction, type FormState } from "@/app/(app)/bands/[bandId]/members/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import type { Role } from "@/generated/prisma/client";

const roleOptions: { value: Role; label: string }[] = [
  { value: "MEMBER", label: "Mitglied" },
  { value: "FINANCE_ADMIN", label: "Finanz-Administrator" },
  { value: "ADMIN", label: "Administrator" },
  { value: "GUEST", label: "Gast" },
];

export function InviteForm({ bandId }: { bandId: string }) {
  const boundAction = inviteAction.bind(null, bandId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    boundAction,
    undefined
  );
  const [role, setRole] = useState<Role>("MEMBER");

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="invite-email">E-Mail-Adresse</Label>
        <Input id="invite-email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="invite-role">Rolle</Label>
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
          <Label htmlFor="invite-guestUntil">Zugriff bis (optional)</Label>
          <Input id="invite-guestUntil" name="guestUntil" type="date" />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        <Send className="h-4 w-4" />
        {pending ? "Wird gesendet…" : "Einladen"}
      </Button>
      <div className="w-full">
        <FieldError>{state?.error}</FieldError>
        {state?.success && <p className="mt-1 text-sm text-success">{state.success}</p>}
        {role === "GUEST" && (
          <p className="mt-1 text-xs text-muted">
            Ohne Datum hat der Gast unbegrenzten Zugriff.
          </p>
        )}
      </div>
    </form>
  );
}
