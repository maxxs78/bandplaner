import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/register-form";
import { Card } from "@/components/ui/card";
import { isOpenRegistrationEnabled, isFirstAccount } from "@/lib/registration";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = callbackUrl ?? "/dashboard";

  // Das Formular zeigen wir, wenn offene Registrierung an ist, es das erste
  // Konto ueberhaupt waere, oder der Weg von einem Einladungslink herkommt.
  // Ob wirklich eine gueltige Einladung vorliegt, prueft registerAction serverseitig.
  const showForm =
    isOpenRegistrationEnabled() ||
    target.startsWith("/invite/") ||
    (await isFirstAccount());

  if (!showForm) {
    const t = await getTranslations("auth.register");
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-foreground">{t("closedTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("closedBody")}</p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
          >
            {t("loginLink")}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <RegisterForm callbackUrl={target} />
    </main>
  );
}
