"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import type { PasswordFormState } from "@/app/(app)/profile/actions";

export function ChangePasswordForm({
  action,
}: {
  action: (prevState: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <FieldError>{state?.error}</FieldError>
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Wird gespeichert…" : "Passwort ändern"}
      </Button>
    </form>
  );
}
