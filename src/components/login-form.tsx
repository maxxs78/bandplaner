"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function LoginForm({
  callbackUrl,
  showForgotPasswordLink = false,
}: {
  callbackUrl: string;
  /** Nur true, wenn ein Mailserver konfiguriert ist - ohne Versandweg waere
   * der Link ein toter Verweis auf eine Seite, die nur den Admin-Reset-Hinweis
   * zeigt (siehe forgot-password/page.tsx). */
  showForgotPasswordLink?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const t = useTranslations("auth.login");

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="text" autoComplete="username" required />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            {showForgotPasswordLink && (
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                {t("forgotPasswordLink")}
              </Link>
            )}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" disabled={pending}>
          <LogIn className="h-4 w-4" />
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-primary hover:underline"
        >
          {t("registerLink")}
        </Link>
      </p>
    </Card>
  );
}
