"use server";

import { signIn } from "@/lib/auth";
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
    if (error instanceof AuthError) {
      return { error: "E-Mail oder Passwort ist falsch" };
    }
    throw error;
  }
}
