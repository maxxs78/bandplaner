"use server";

import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";
import { getResetPasswordSchema } from "@/lib/validation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type FormState = { error?: string } | undefined;

export async function resetPasswordAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await getTranslations("auth.resetPassword");
  const token = (formData.get("token") as string | null) ?? "";

  const parsed = getResetPasswordSchema(t).safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: t("mismatch") };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { email: true } } },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: t("invalidToken") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null },
    }),
    // Der genutzte Token wird verbraucht, alle weiteren offenen Tokens dieser
    // Person werden mit entwertet (z. B. falls mehrere Reset-Mails angefordert
    // wurden) - ein Reset-Link darf danach nicht mehr einsetzbar sein.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  try {
    await signIn("credentials", {
      email: record.user.email,
      password: parsed.data.newPassword,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t("loginFailedAfterReset") };
    }
    throw error;
  }
}
