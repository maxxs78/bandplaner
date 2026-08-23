/**
 * Leitet den Abrechnungsstand eines Gigs aus den bereits vorhandenen
 * FinanceEntry/FinanceAllocation-Daten ab, statt ihn als eigenen manuellen
 * Status zu pflegen (vermeidet Doppelpflege-Risiko zwischen zwei Wahrheiten).
 */
export type GigSettlementStatus = "NONE" | "OPEN" | "DONE";

export function computeGigSettlementStatus(
  financeEntries: { allocations: { confirmedAt: Date | null }[] }[]
): GigSettlementStatus {
  if (financeEntries.length === 0) return "NONE";
  // Ein Eintrag ganz ohne Zuordnungen zaehlt als offen, nicht als abgeschlossen -
  // sonst waere "jede Zuordnung ist bestaetigt" bei 0 Zuordnungen vakuos wahr.
  const allConfirmed = financeEntries.every(
    (entry) => entry.allocations.length > 0 && entry.allocations.every((a) => a.confirmedAt !== null)
  );
  return allConfirmed ? "DONE" : "OPEN";
}
