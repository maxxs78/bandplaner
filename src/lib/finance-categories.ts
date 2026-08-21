export const FINANCE_CATEGORY_KEYS = [
  "FEE",
  "MERCH",
  "EQUIPMENT",
  "TRAVEL",
  "REHEARSAL_ROOM",
  "CATERING",
  "OTHER",
  "BALANCE_PAYOUT",
  "BALANCE_DEPOSIT",
] as const;

/** Vorschlagsliste für Finanz-Kategorien - das Formular erlaubt zusätzlich freien Text. */
export function getFinanceCategorySuggestions(t: (key: string) => string): string[] {
  return FINANCE_CATEGORY_KEYS.map((key) => t(`categorySuggestions.${key}`));
}
