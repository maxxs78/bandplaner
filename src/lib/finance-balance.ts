import { prisma } from "@/lib/prisma";

/**
 * Aktueller Bandkonto-Stand (Bandkapital), bandweit über alle Einträge - unabhängig
 * von Datums-/Typ-Filtern der Finanzseite. Einnahmen/Ausgaben tragen ihren nicht
 * zugeordneten Rest bei (siehe finance/actions.ts), Bandkonto-Auszahlungen/
 * -Einzahlungen sind immer vollständig zugeordnet und wirken direkt 1:1.
 */
export async function computeBandBalance(bandId: string): Promise<number> {
  const [incomeAgg, expenseAgg, incomeAllocAgg, expenseAllocAgg, payoutAllocAgg, depositAllocAgg] = await Promise.all([
    prisma.financeEntry.aggregate({ where: { bandId, type: "INCOME" }, _sum: { amountCents: true } }),
    prisma.financeEntry.aggregate({ where: { bandId, type: "EXPENSE" }, _sum: { amountCents: true } }),
    prisma.financeAllocation.aggregate({
      where: { financeEntry: { bandId, type: "INCOME" } },
      _sum: { amountCents: true },
    }),
    prisma.financeAllocation.aggregate({
      where: { financeEntry: { bandId, type: "EXPENSE" } },
      _sum: { amountCents: true },
    }),
    prisma.financeAllocation.aggregate({
      where: { financeEntry: { bandId, type: "BALANCE_PAYOUT" } },
      _sum: { amountCents: true },
    }),
    prisma.financeAllocation.aggregate({
      where: { financeEntry: { bandId, type: "BALANCE_DEPOSIT" } },
      _sum: { amountCents: true },
    }),
  ]);

  const incomeAllTime = incomeAgg._sum.amountCents ?? 0;
  const expenseAllTime = expenseAgg._sum.amountCents ?? 0;
  const incomeAllocated = incomeAllocAgg._sum.amountCents ?? 0;
  const expenseAllocated = expenseAllocAgg._sum.amountCents ?? 0;
  const payoutAllocated = payoutAllocAgg._sum.amountCents ?? 0;
  const depositAllocated = depositAllocAgg._sum.amountCents ?? 0;

  return incomeAllTime - incomeAllocated - (expenseAllTime - expenseAllocated) - payoutAllocated + depositAllocated;
}
