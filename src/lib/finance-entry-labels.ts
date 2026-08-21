import type { FinanceEntryType } from "@/generated/prisma/client";

export const financeEntryTypeBadgeVariant: Record<FinanceEntryType, "success" | "danger" | "warning" | "accent"> = {
  INCOME: "success",
  EXPENSE: "danger",
  BALANCE_PAYOUT: "warning",
  BALANCE_DEPOSIT: "accent",
};

export function getFinanceEntryTypeLabels(t: (key: string) => string): Record<FinanceEntryType, string> {
  return {
    INCOME: t("types.INCOME"),
    EXPENSE: t("types.EXPENSE"),
    BALANCE_PAYOUT: t("types.BALANCE_PAYOUT"),
    BALANCE_DEPOSIT: t("types.BALANCE_DEPOSIT"),
  };
}

/** Bezeichnung für die Zuordnungsliste auf der Eintrags-Detailseite. */
export function getAllocationNoun(type: FinanceEntryType, t: (key: string) => string) {
  return t(`allocationNoun.${type}`);
}

/** Bezeichnung für die Position in "Meine Finanzen" (Perspektive des Mitglieds). */
export function getAllocationRoleLabel(type: FinanceEntryType, t: (key: string) => string) {
  return t(`allocationRoleLabel.${type}`);
}

/**
 * true = das Mitglied empfängt Geld und bestätigt selbst den Erhalt (INCOME,
 * BALANCE_PAYOUT). false = das Mitglied schuldet der Band Geld, der Finanzadmin
 * bestätigt den Zahlungseingang (EXPENSE, BALANCE_DEPOSIT).
 */
export function memberReceivesAllocation(type: FinanceEntryType) {
  return type === "INCOME" || type === "BALANCE_PAYOUT";
}

/** Bandkonto-Bewegungen müssen immer vollständig (100%) zugeordnet werden. */
export function isBalanceTransactionType(type: FinanceEntryType) {
  return type === "BALANCE_PAYOUT" || type === "BALANCE_DEPOSIT";
}
