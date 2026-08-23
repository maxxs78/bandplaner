import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isMailConfigured } from "@/lib/mail";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Card } from "@/components/ui/card";

export default async function ForgotPasswordPage() {
  const mailAvailable = isMailConfigured();
  const t = await getTranslations("auth.forgotPassword");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      {mailAvailable ? (
        <ForgotPasswordForm />
      ) : (
        <Card className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-3 text-sm text-muted">{t("notAvailable")}</p>
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </Card>
      )}
    </main>
  );
}
