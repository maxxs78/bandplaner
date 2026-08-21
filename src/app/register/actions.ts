"use server";

import bcrypt from "bcryptjs";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getRegisterSchema } from "@/lib/validation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type FormState = { error?: string } | undefined;

export async function registerAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const t = await getTranslations("auth.register");

  const parsed = getRegisterSchema(t).safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t("emailTaken") };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.user.create({
    data: { name: parsed.data.name.trim(), email, passwordHash },
  });

  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t("loginFailedAfterRegister") };
    }
    throw error;
  }
}
