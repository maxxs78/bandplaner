import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultLocale, isLocale, type Locale } from "./config";

export const LOCALE_COOKIE = "NEXT_LOCALE";

function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const preferred = header.split(",").map((part) => part.split(";")[0]!.trim().toLowerCase());
  for (const lang of preferred) {
    const base = lang.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

async function loadMessages(locale: Locale) {
  return (await import(`../messages/${locale}.json`)).default;
}

/**
 * Kein URL-Locale-Routing (kein [locale]-Segment) - bewusste Entscheidung, weil
 * bereits Kalender-Abos, Einladungs- und Datei-Freigabelinks im Umlauf sind, die
 * sonst mit umgezogen werden muessten. Ermittlungsreihenfolge: eingeloggtes
 * Konto (dauerhaft im Profil hinterlegt) > Cookie (Sprachumschalter vor dem
 * Login) > Accept-Language-Header des Browsers > Default "de".
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Explizite Uebersteuerung, z. B. `getTranslations({locale: recipient.locale})`
  // fuer E-Mail-Benachrichtigungen: die Sprache der empfangenden Person kann von
  // der Sprache der aktuellen Anfrage abweichen (z. B. Terminersteller:in DE,
  // Empfaenger:in EN) - siehe src/lib/notifications.ts.
  if (isLocale(explicitLocale)) {
    return { locale: explicitLocale, messages: await loadMessages(explicitLocale) };
  }

  const session = await auth();
  let locale: Locale | undefined;

  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { locale: true },
    });
    if (isLocale(user?.locale)) locale = user.locale;
  }

  if (!locale) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) locale = cookieLocale;
  }

  if (!locale) {
    const headerList = await headers();
    locale = parseAcceptLanguage(headerList.get("accept-language")) ?? defaultLocale;
  }

  return { locale, messages: await loadMessages(locale) };
});
