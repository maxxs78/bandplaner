"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);
  const t = useTranslations("auth.forgotPassword");

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      {state?.success ? (
        <p className="mt-6 text-sm text-foreground">{state.success}</p>
      ) : (
        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <FieldError>{state?.error}</FieldError>
          <Button type="submit" className="w-full" disabled={pending}>
            <Send className="h-4 w-4" />
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </Card>
  );
}
