export const locales = ["de", "en", "fr", "sv", "saarland"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";

/**
 * Spaß-Locales (Easter Eggs wie Saarländisch): bewusst von den "echten" Sprachen
 * getrennt gehalten - im Sprach-Dropdown durch einen Leereintrag abgesetzt
 * (siehe LocaleSwitcher), statt gleichrangig als weitere offizielle Sprache zu wirken.
 */
export const funLocales: readonly Locale[] = ["saarland"];

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  sv: "Svenska",
  saarland: "Saarländisch",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
