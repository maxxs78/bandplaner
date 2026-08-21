"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import type { PasswordFormState } from "@/app/(app)/profile/actions";

export function ChangePasswordForm({
  action,
}: {
  action: (prevState: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("profile.changePasswordForm");

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="currentPassword">{t("current")}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="newPassword">{t("new")}</Label>
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
        <Label htmlFor="confirmPassword">{t("confirm")}</Label>
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
        {pending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
