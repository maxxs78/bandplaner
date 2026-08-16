import type { FinanceEntryType } from "@/generated/prisma/client";

export const financeEntryTypeLabels: Record<FinanceEntryType, string> = {
  INCOME: "Einnahme",
  EXPENSE: "Ausgabe",
  BALANCE_PAYOUT: "Bandkonto-Auszahlung",
  BALANCE_DEPOSIT: "Bandkonto-Einzahlung",
};

export const financeEntryTypeBadgeVariant: Record<FinanceEntryType, "success" | "danger" | "warning" | "accent"> = {
  INCOME: "success",
  EXPENSE: "danger",
  BALANCE_PAYOUT: "warning",
  BALANCE_DEPOSIT: "accent",
};

/** Bezeichnung für die Zuordnungsliste auf der Eintrags-Detailseite. */
export function allocationNoun(type: FinanceEntryType) {
  switch (type) {
    case "INCOME":
      return "Gagen";
    case "EXPENSE":
      return "Kostenanteile";
    case "BALANCE_PAYOUT":
      return "Auszahlung";
    case "BALANCE_DEPOSIT":
      return "Einzahlung";
  }
}

/** Bezeichnung für die Position in "Meine Finanzen" (Perspektive des Mitglieds). */
export function allocationRoleLabel(type: FinanceEntryType) {
  switch (type) {
    case "INCOME":
      return "Auszahlung";
    case "EXPENSE":
      return "Kostenanteil";
    case "BALANCE_PAYOUT":
      return "Bandkonto-Auszahlung";
    case "BALANCE_DEPOSIT":
      return "Bandkonto-Einzahlung";
  }
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
