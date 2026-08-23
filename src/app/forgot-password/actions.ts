"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS, RESET_REQUEST_COOLDOWN_MS } from "@/lib/password-reset";
import { getForgotPasswordSchema } from "@/lib/validation";
import { appUrl } from "@/lib/app-url";
import { isLocale, defaultLocale } from "@/i18n/config";

export type FormState = { error?: string; success?: string } | undefined;

export async function requestPasswordResetAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await getTranslations("auth.forgotPassword");

  if (!isMailConfigured()) {
    return { error: t("notAvailable") };
  }

  const parsed = getForgotPasswordSchema(t).safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, locale: true },
  });

  // Immer dieselbe Erfolgsmeldung, unabhaengig davon ob die Adresse existiert -
  // sonst liesse sich ueber das Formular herausfinden, welche E-Mails registriert
  // sind. Aus demselben Grund kein Sonderfall fuer die Cooldown-Sperre unten.
  if (user) {
    const recentRequest = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS) } },
    });

    if (!recentRequest) {
      const rawToken = generateResetToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const locale = isLocale(user.locale) ? user.locale : defaultLocale;
      const tMail = await getTranslations({ locale, namespace: "auth.forgotPassword" });
      const link = appUrl(`/reset-password?token=${rawToken}`);
      await sendMail({
        to: user.email,
        subject: tMail("mailSubject"),
        text: `${tMail("mailBody", { name: user.name })}\n\n${link}\n\n${tMail("mailExpiry")}`,
      });
    }
  }

  return { success: t("successMessage") };
}
