import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";
import { isMailConfigured } from "@/lib/mail";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; accountDeleted?: string }>;
}) {
  const { callbackUrl, accountDeleted } = await searchParams;
  const t = await getTranslations("auth.login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {accountDeleted && (
          <Card className="mb-4 border-warning/40 bg-warning/10 text-sm text-foreground">
            {t("accountDeletedNotice")}
          </Card>
        )}
        <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} showForgotPasswordLink={isMailConfigured()} />
      </div>
    </main>
  );
}
