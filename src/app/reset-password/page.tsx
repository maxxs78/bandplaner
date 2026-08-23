import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Card } from "@/components/ui/card";

async function isTokenValid(token: string | undefined) {
  if (!token) return false;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { usedAt: true, expiresAt: true },
  });
  return !!record && !record.usedAt && record.expiresAt > new Date();
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.resetPassword");
  const valid = await isTokenValid(token);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-3 text-sm text-danger">{t("invalidToken")}</p>
          <p className="mt-6 text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              {t("requestNewLink")}
            </Link>
          </p>
        </Card>
      )}
    </main>
  );
}
