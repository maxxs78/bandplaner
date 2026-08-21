"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageFinance } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { getAllocationNoun, isBalanceTransactionType, memberReceivesAllocation } from "@/lib/finance-entry-labels";
import { notifyUsers } from "@/lib/notifications";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FinanceEntryType } from "@/generated/prisma/client";

const FINANCE_ENTRY_TYPES: FinanceEntryType[] = ["INCOME", "EXPENSE", "BALANCE_PAYOUT", "BALANCE_DEPOSIT"];

export type FormState = { error?: string } | undefined;

function parseAmountToCents(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export async function createFinanceEntryAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const t = await getTranslations("finance.actions");
  if (!getEnabledFeatures(membership.band).finance) {
    return { error: t("disabled") };
  }
  if (!canManageFinance(isFinanceAdmin)) {
    return { error: t("onlyAdminsCreate") };
  }

  const rawType = formData.get("type");
  const type = FINANCE_ENTRY_TYPES.includes(rawType as FinanceEntryType) ? (rawType as FinanceEntryType) : "INCOME";
  if (isBalanceTransactionType(type) && membership.band.financeSettlementMode !== "BAND_BALANCE") {
    return { error: t("balanceOnlyInBandBalanceMode") };
  }
  const amountCents = parseAmountToCents(formData.get("amount"));
  if (amountCents === null || amountCents === 0) {
    return { error: t("invalidAmount") };
  }
  const category = (formData.get("category") as string)?.trim();
  if (!category) {
    return { error: t("categoryRequired") };
  }
  const dateRaw = formData.get("date") as string;
  const date = dateRaw ? new Date(dateRaw) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { error: t("invalidDate") };
  }
  const description = (formData.get("description") as string)?.trim() || null;
  const eventId = (formData.get("eventId") as string) || null;

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId, bandId }, select: { id: true } });
    if (!event) return { error: t("invalidEvent") };
  }

  const entry = await prisma.financeEntry.create({
    data: {
      bandId,
      type: type as FinanceEntryType,
      amountCents,
      category,
      description,
      date,
      eventId,
      createdById: user.id,
    },
  });

  revalidatePath(`/bands/${bandId}/finance`);
  redirect(`/bands/${bandId}/finance/${entry.id}`);
}

export async function deleteFinanceEntryAction(bandId: string, entryId: string) {
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).finance) return;
  if (!canManageFinance(isFinanceAdmin)) return;

  await prisma.financeEntry.delete({ where: { id: entryId, bandId } });
  revalidatePath(`/bands/${bandId}/finance`);
  redirect(`/bands/${bandId}/finance`);
}

export async function saveAllocationsAction(
  bandId: string,
  entryId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  const t = await getTranslations("finance.actions");
  if (!getEnabledFeatures(membership.band).finance) {
    return { error: t("disabled") };
  }
  if (!canManageFinance(isFinanceAdmin)) {
    return { error: t("onlyAdminsManageAllocations") };
  }

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId, bandId },
    include: { allocations: { select: { userId: true, amountCents: true } } },
  });
  if (!entry) return { error: t("entryNotFound") };
  const tFinance = await getTranslations("finance");
  const noun = getAllocationNoun(entry.type, tFinance);
  // Bandkonto-Bewegungen muessen immer vollstaendig zugeordnet werden - anders
  // als bei Einnahmen/Ausgaben gibt es dabei keinen "Rest fuer die Band".
  const requireFullAllocation = isBalanceTransactionType(entry.type) || membership.band.financeSettlementMode === "NO_BALANCE";

  const members = await prisma.membership.findMany({ where: { bandId }, select: { userId: true } });
  const memberIds = new Set(members.map((m) => m.userId));

  const allocations: { userId: string; amountCents: number }[] = [];
  for (const userId of memberIds) {
    const raw = formData.get(`allocation_${userId}`) as string | null;
    if (raw === null || raw.trim() === "") continue;
    const amountCents = parseAmountToCents(raw);
    if (amountCents === null) return { error: t("invalidAllocationAmount", { noun }) };
    if (amountCents > 0) allocations.push({ userId, amountCents });
  }

  const sum = allocations.reduce((total, a) => total + a.amountCents, 0);
  const sumFormatted = (sum / 100).toFixed(2);
  const total = (entry.amountCents / 100).toFixed(2);
  if (sum > entry.amountCents) {
    const diff = ((sum - entry.amountCents) / 100).toFixed(2);
    return {
      error: t("allocationExceedsTotal", { sum: sumFormatted, noun, diff, total }),
    };
  }
  if (sum !== entry.amountCents && requireFullAllocation) {
    const diff = ((entry.amountCents - sum) / 100).toFixed(2);
    const reason = isBalanceTransactionType(entry.type)
      ? t("reasonBalanceFull")
      : t("reasonNoBandBalance");
    return {
      error: t("allocationIncomplete", { sum: sumFormatted, noun, diff, total, reason }),
    };
  }

  const existingByUser = new Map(entry.allocations.map((a) => [a.userId, a.amountCents]));
  const allocationUserIds = allocations.map((a) => a.userId);
  await prisma.$transaction([
    prisma.financeAllocation.deleteMany({ where: { financeEntryId: entryId, userId: { notIn: allocationUserIds } } }),
    ...allocations.map((a) => {
      const changed = existingByUser.get(a.userId) !== a.amountCents;
      return prisma.financeAllocation.upsert({
        where: { financeEntryId_userId: { financeEntryId: entryId, userId: a.userId } },
        create: { financeEntryId: entryId, userId: a.userId, amountCents: a.amountCents },
        // Ein geaenderter Betrag entwertet eine vorherige Bestaetigung - die neue
        // Zahl wurde ja so noch nicht bestaetigt.
        update: changed ? { amountCents: a.amountCents, confirmedAt: null } : { amountCents: a.amountCents },
      });
    }),
  ]);

  // Nur wer einen neuen oder geaenderten Betrag bekommen hat wird benachrichtigt -
  // unveraenderte Zuordnungen loesen beim erneuten Speichern keine Mail aus.
  const changedUserIds = allocations
    .filter((a) => existingByUser.get(a.userId) !== a.amountCents)
    .map((a) => a.userId);
  if (changedUserIds.length > 0) {
    const receives = memberReceivesAllocation(entry.type);
    await notifyUsers({
      bandId,
      userIds: changedUserIds,
      event: "FINANCE_ALLOCATION",
      excludeUserId: membership.userId,
      namespace: "finance",
      buildMessage: (tf) => ({
        subject: tf("actions.notifySubject", { noun: getAllocationNoun(entry.type, tf), category: entry.category }),
        body: receives
          ? tf("actions.notifyBodyReceives", { category: entry.category })
          : tf("actions.notifyBodyOwes", { category: entry.category }),
      }),
      path: `/bands/${bandId}/finance`,
    });
  }

  revalidatePath(`/bands/${bandId}/finance/${entryId}`);
  return undefined;
}

/**
 * Bestaetigt eine FinanceAllocation. Wenn das Mitglied Geld empfaengt (Einnahme
 * oder Bandkonto-Auszahlung) bestaetigt es selbst den Erhalt; wenn es der Band
 * Geld schuldet (Ausgabe oder Bandkonto-Einzahlung) bestaetigt der Finanzadmin
 * den Zahlungseingang.
 */
export async function confirmAllocationAction(bandId: string, allocationId: string) {
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).finance) return;

  const allocation = await prisma.financeAllocation.findUnique({
    where: { id: allocationId },
    include: { financeEntry: { select: { bandId: true, type: true } } },
  });
  if (!allocation || allocation.financeEntry.bandId !== bandId) return;

  const canConfirm = memberReceivesAllocation(allocation.financeEntry.type)
    ? allocation.userId === user.id
    : canManageFinance(isFinanceAdmin);
  if (!canConfirm) return;

  await prisma.financeAllocation.update({
    where: { id: allocationId },
    data: { confirmedAt: new Date() },
  });
  revalidatePath(`/bands/${bandId}/finance`);
}

export async function updateDefaultPayoutAction(bandId: string, userId: string, formData: FormData) {
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).finance) return;
  if (!canManageFinance(isFinanceAdmin)) return;

  const raw = formData.get("defaultPayoutAmount") as string;
  const amountCents = raw?.trim() ? parseAmountToCents(raw) : null;

  await prisma.membership.update({
    where: { userId_bandId: { userId, bandId } },
    data: { defaultPayoutAmountCents: amountCents },
  });
  revalidatePath(`/bands/${bandId}/finance`);
}
