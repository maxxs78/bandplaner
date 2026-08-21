import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireMembership, canManageFinance } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { getEventTypeLabels } from "@/lib/event-colors";
import { getTranslations, getFormatter, getLocale } from "next-intl/server";
import {
  getFinanceEntryTypeLabels,
  financeEntryTypeBadgeVariant,
  getAllocationNoun,
  isBalanceTransactionType,
} from "@/lib/finance-entry-labels";
import { Card, Badge } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import { AllocationsForm } from "@/components/allocations-form";
import { deleteFinanceEntryAction, saveAllocationsAction, confirmAllocationAction } from "../actions";

function formatEuro(cents: number, locale: string) {
  return (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default async function FinanceEntryDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; entryId: string }>;
}) {
  const { bandId, entryId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).finance || !canManageFinance(isFinanceAdmin)) {
    redirect(`/bands/${bandId}/finance`);
  }
  const t = await getTranslations("finance");
  const tEventTypes = await getTranslations("calendar.eventTypes");
  const eventTypeLabels = getEventTypeLabels(tEventTypes);
  const financeEntryTypeLabels = getFinanceEntryTypeLabels(t);
  const format = await getFormatter();
  const locale = await getLocale();

  const entry = await prisma.financeEntry.findUnique({
    where: { id: entryId, bandId },
    include: {
      event: { select: { id: true, title: true, type: true } },
      createdBy: { select: { name: true } },
      allocations: { select: { id: true, userId: true, amountCents: true, confirmedAt: true } },
    },
  });
  if (!entry) notFound();

  const memberships = await prisma.membership.findMany({
    where: { bandId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const members = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    defaultAmountCents: entry.type === "INCOME" || entry.type === "BALANCE_PAYOUT" ? m.defaultPayoutAmountCents : null,
  }));
  const existingAllocations = Object.fromEntries(
    entry.allocations.map((a) => [a.userId, { id: a.id, amountCents: a.amountCents, confirmedAt: a.confirmedAt }])
  );

  const allocatedSum = entry.allocations.reduce((s, a) => s + a.amountCents, 0);
  const remainder = entry.amountCents - allocatedSum;
  const noun = getAllocationNoun(entry.type, t);
  const hint = isBalanceTransactionType(entry.type)
    ? t("hintBalanceType", { amount: formatEuro(entry.amountCents, locale) })
    : membership.band.financeSettlementMode === "NO_BALANCE"
      ? t("hintNoBalanceMode", { noun, amount: formatEuro(entry.amountCents, locale) })
      : t("hintRemainderToBand") +
        (remainder !== 0
          ? t("hintRemainderCurrent", { amount: formatEuro(remainder, locale) })
          : t("hintRemainderNone"));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/bands/${bandId}/finance`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToFinance")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{entry.category}</h1>
            <p className="mt-1 text-sm text-muted">
              {format.dateTime(entry.date, { dateStyle: "full" })}
              {entry.event && ` · ${entry.event.title} (${eventTypeLabels[entry.event.type]})`}
            </p>
            {entry.description && <p className="mt-1 text-sm text-foreground">{entry.description}</p>}
            <p className="mt-1 text-xs text-muted">{t("createdBy", { name: entry.createdBy.name })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={financeEntryTypeBadgeVariant[entry.type]}>{financeEntryTypeLabels[entry.type]}</Badge>
          </div>
        </div>
        <p className="mt-3 text-3xl font-semibold text-foreground">{formatEuro(entry.amountCents, locale)}</p>
        <div className="mt-4">
          <DeleteButton
            action={deleteFinanceEntryAction.bind(null, bandId, entryId)}
            label={t("deleteEntry")}
            confirmMessage={t("deleteEntryConfirm")}
          />
        </div>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground">{noun}</h2>
        <p className="mt-1 text-xs text-muted">{hint}</p>
        <div className="mt-3">
          <AllocationsForm
            action={saveAllocationsAction.bind(null, bandId, entryId)}
            confirmAction={confirmAllocationAction.bind(null, bandId)}
            entryType={entry.type}
            currentUserId={user.id}
            isFinanceAdmin={isFinanceAdmin}
            members={members}
            existingAllocations={existingAllocations}
          />
        </div>
      </Card>
    </div>
  );
}
