"use server";

import { getTranslations } from "next-intl/server";
import { signIn, AccountLockedError } from "@/lib/auth";
import { AuthError } from "next-auth";

export type FormState = { error?: string } | undefined;

export async function loginAction(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    const t = await getTranslations("auth.login");
    if (error instanceof AccountLockedError) {
      return { error: t("accountLocked") };
    }
    if (error instanceof AuthError) {
      return { error: t("invalidCredentials") };
    }
    throw error;
  }
}
