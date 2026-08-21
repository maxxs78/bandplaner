"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/config";
import { LOCALE_COOKIE } from "@/i18n/request";

/**
 * Fuer Besucher ohne Login (z. B. Login-/Registrierungsseite): setzt nur das
 * Cookie, ohne ein Konto vorauszusetzen. Bei eingeloggten Personen hat das
 * dauerhaft im Profil hinterlegte locale-Feld Vorrang (siehe updateLocaleAction
 * in src/app/(app)/actions.ts und die Ermittlungsreihenfolge in i18n/request.ts).
 */
export async function setLocaleCookieAction(locale: string) {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
