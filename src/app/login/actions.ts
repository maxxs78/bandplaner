"use server";

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
    if (error instanceof AccountLockedError) {
      return {
        error:
          "Zu viele fehlgeschlagene Loginversuche. Das Konto ist vorübergehend gesperrt und wird automatisch nach 2 Tagen wieder freigeschaltet.",
      };
    }
    if (error instanceof AuthError) {
      return { error: "E-Mail/Benutzername oder Passwort ist falsch" };
    }
    throw error;
  }
}
