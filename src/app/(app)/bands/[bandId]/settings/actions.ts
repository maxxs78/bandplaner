"use server";

import { prisma } from "@/lib/prisma";
import { requireMembership, canManageBand } from "@/lib/access";
import { computeBandBalance } from "@/lib/finance-balance";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

export async function updateBandFeaturesAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Admins können Funktionen für die Band verwalten" };
  }

  const equipmentEnabled = formData.get("equipmentEnabled") === "on";
  const packlistsEnabled = formData.get("packlistsEnabled") === "on";
  const financeEnabled = formData.get("financeEnabled") === "on";
  const wasFinanceEnabled = membership.band.financeEnabled;
  const settlementModeRaw = formData.get("financeSettlementMode");
  const financeSettlementMode = settlementModeRaw === "BAND_BALANCE" ? "BAND_BALANCE" : "NO_BALANCE";

  if (membership.band.financeSettlementMode === "BAND_BALANCE" && financeSettlementMode === "NO_BALANCE") {
    const balance = await computeBandBalance(bandId);
    if (balance !== 0) {
      const formatted = (balance / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return {
        error: `Das Bandkonto muss erst ausgeglichen werden, bevor "Kein Bandkonto" aktiviert werden kann (aktueller Stand: ${formatted} €). Lege dazu auf der Finanzseite eine Bandkonto-Auszahlung bzw. -Einzahlung an, die den Restbetrag auf die Mitglieder verteilt.`,
      };
    }
  }

  await prisma.band.update({
    where: { id: bandId },
    data: { equipmentEnabled, packlistsEnabled, financeEnabled, financeSettlementMode },
  });

  if (financeEnabled && !wasFinanceEnabled) {
    const hasFinanceAdmin = await prisma.bandFinanceAdmin.findFirst({ where: { bandId } });
    if (!hasFinanceAdmin) {
      await prisma.bandFinanceAdmin.create({ data: { bandId, userId: membership.userId } });
    }
  }

  revalidatePath(`/bands/${bandId}`, "layout");
  return undefined;
}

export async function updateFinanceAdminsAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Admins können Finanzadmin:innen festlegen" };
  }

  const newUserIds = formData.getAll("financeAdminIds").map(String);

  if (membership.band.financeEnabled && newUserIds.length === 0) {
    return {
      error: "Die Band braucht mindestens eine:n Finanzadmin:in, solange das Finanzmodul aktiviert ist.",
    };
  }

  if (newUserIds.length > 0) {
    const validMembers = await prisma.membership.findMany({
      where: { bandId, userId: { in: newUserIds } },
      select: { userId: true },
    });
    if (validMembers.length !== newUserIds.length) {
      return { error: "Ungültige Auswahl" };
    }
  }

  await prisma.$transaction([
    prisma.bandFinanceAdmin.deleteMany({ where: { bandId, userId: { notIn: newUserIds } } }),
    ...newUserIds.map((userId) =>
      prisma.bandFinanceAdmin.upsert({
        where: { bandId_userId: { bandId, userId } },
        create: { bandId, userId },
        update: {},
      })
    ),
  ]);

  revalidatePath(`/bands/${bandId}`, "layout");
  return undefined;
}

export async function updateBandSettingsAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  if (!canManageBand(membership.role)) {
    return { error: "Nur Admins können Einstellungen für die Band verwalten" };
  }

  const daysRaw = (formData.get("defaultGuestAccessDays") as string)?.trim();
  let defaultGuestAccessDays: number | null = null;
  if (daysRaw) {
    const parsed = Number(daysRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      return { error: "Gastzugangsdauer muss eine Zahl zwischen 1 und 3650 Tagen sein" };
    }
    defaultGuestAccessDays = parsed;
  }

  const publicFileLinksEnabled = formData.get("publicFileLinksEnabled") === "on";

  await prisma.band.update({
    where: { id: bandId },
    data: { defaultGuestAccessDays, publicFileLinksEnabled },
  });

  revalidatePath(`/bands/${bandId}`, "layout");
  return undefined;
}
