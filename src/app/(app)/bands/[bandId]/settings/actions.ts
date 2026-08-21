"use server";

import { getTranslations, getLocale } from "next-intl/server";
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
  const t = await getTranslations("bandSettings.actions");
  if (!canManageBand(membership.role)) {
    return { error: t("onlyAdminsManageFeatures") };
  }

  const equipmentEnabled = formData.get("equipmentEnabled") === "on";
  const packlistsEnabled = formData.get("packlistsEnabled") === "on";
  const financeEnabled = formData.get("financeEnabled") === "on";
  const communicationEnabled = formData.get("communicationEnabled") === "on";
  const mediaPlayerEnabled = formData.get("mediaPlayerEnabled") === "on";
  const keyDetectionEnabled = formData.get("keyDetectionEnabled") === "on";
  const locationsEnabled = formData.get("locationsEnabled") === "on";
  const wasFinanceEnabled = membership.band.financeEnabled;
  const settlementModeRaw = formData.get("financeSettlementMode");
  const financeSettlementMode = settlementModeRaw === "BAND_BALANCE" ? "BAND_BALANCE" : "NO_BALANCE";

  if (membership.band.financeSettlementMode === "BAND_BALANCE" && financeSettlementMode === "NO_BALANCE") {
    const balance = await computeBandBalance(bandId);
    if (balance !== 0) {
      const locale = await getLocale();
      const formatted = (balance / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return { error: t("balanceMustBeSettled", { balance: formatted }) };
    }
  }

  await prisma.band.update({
    where: { id: bandId },
    data: {
      equipmentEnabled,
      packlistsEnabled,
      financeEnabled,
      financeSettlementMode,
      communicationEnabled,
      mediaPlayerEnabled,
      keyDetectionEnabled,
      locationsEnabled,
    },
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
  const t = await getTranslations("bandSettings.actions");
  if (!canManageBand(membership.role)) {
    return { error: t("onlyAdminsManageFinanceAdmins") };
  }

  const newUserIds = formData.getAll("financeAdminIds").map(String);

  if (membership.band.financeEnabled && newUserIds.length === 0) {
    return { error: t("needsAtLeastOneFinanceAdmin") };
  }

  if (newUserIds.length > 0) {
    const validMembers = await prisma.membership.findMany({
      where: { bandId, userId: { in: newUserIds } },
      select: { userId: true },
    });
    if (validMembers.length !== newUserIds.length) {
      return { error: t("invalidSelection") };
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
  const t = await getTranslations("bandSettings.actions");
  if (!canManageBand(membership.role)) {
    return { error: t("onlyAdminsManageSettings") };
  }

  const daysRaw = (formData.get("defaultGuestAccessDays") as string)?.trim();
  let defaultGuestAccessDays: number | null = null;
  if (daysRaw) {
    const parsed = Number(daysRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      return { error: t("invalidGuestAccessDays") };
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
