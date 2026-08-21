import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireMembership, canManageFinance, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { EVENT_TYPES, getEventTypeLabels } from "@/lib/event-colors";
import { getTranslations, getFormatter, getLocale } from "next-intl/server";
import { getFinanceCategorySuggestions } from "@/lib/finance-categories";
import { computeBandBalance } from "@/lib/finance-balance";
import {
  getFinanceEntryTypeLabels,
  financeEntryTypeBadgeVariant,
  getAllocationRoleLabel,
  memberReceivesAllocation,
} from "@/lib/finance-entry-labels";
import { Card, Badge } from "@/components/ui/card";
import { ConfirmAllocationStatus } from "@/components/confirm-allocation-status";
import { NewFinanceEntryForm } from "@/components/new-finance-entry-form";
import { createFinanceEntryAction, confirmAllocationAction } from "./actions";
import type { EventType, FinanceEntryType } from "@/generated/prisma/client";

function formatEuro(cents: number, locale: string) {
  return (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

async function MyFinanceSection({
  bandId,
  userId,
  isFinanceAdmin,
  linkToEntries,
}: {
  bandId: string;
  userId: string;
  isFinanceAdmin: boolean;
  linkToEntries: boolean;
}) {
  const myAllocations = await prisma.financeAllocation.findMany({
    where: { userId, financeEntry: { bandId } },
    orderBy: { financeEntry: { date: "desc" } },
    include: { financeEntry: { include: { event: { select: { title: true, type: true } } } } },
  });
  const t = await getTranslations("finance");
  const tEventTypes = await getTranslations("calendar.eventTypes");
  const eventTypeLabels = getEventTypeLabels(tEventTypes);
  const format = await getFormatter();
  const locale = await getLocale();

  if (myAllocations.length === 0) {
    return <Card className="text-sm text-muted">{t("noOwnEntries")}</Card>;
  }

  return (
    <div className="space-y-2">
      {myAllocations.map((a) => {
        const canConfirm = !a.confirmedAt && (memberReceivesAllocation(a.financeEntry.type) || isFinanceAdmin);
        const content = (
          <Card
            className={
              linkToEntries ? "flex items-center justify-between gap-3 transition hover:border-primary" : "flex items-center justify-between gap-3"
            }
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={financeEntryTypeBadgeVariant[a.financeEntry.type]}>
                  {getAllocationRoleLabel(a.financeEntry.type, t)}
                </Badge>
                <p className="font-medium text-foreground truncate">
                  {a.financeEntry.event?.title ?? a.financeEntry.category}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {format.dateTime(a.financeEntry.date, { dateStyle: "medium" })}
                {a.financeEntry.event && ` · ${eventTypeLabels[a.financeEntry.event.type]}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="font-semibold text-foreground">{formatEuro(a.amountCents, locale)}</p>
              <ConfirmAllocationStatus
                confirmedAt={a.confirmedAt}
                canConfirm={canConfirm}
                allocationId={a.id}
                confirmAction={confirmAllocationAction.bind(null, bandId)}
              />
            </div>
          </Card>
        );
        return linkToEntries ? (
          <Link key={a.id} href={`/bands/${bandId}/finance/${a.financeEntryId}`}>
            {content}
          </Link>
        ) : (
          <div key={a.id}>{content}</div>
        );
      })}
    </div>
  );
}

const BALANCE_TYPES: FinanceEntryType[] = ["BALANCE_PAYOUT", "BALANCE_DEPOSIT"];

export default async function FinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ bandId: string }>;
  searchParams: Promise<{ from?: string; to?: string; type?: string; eventType?: string }>;
}) {
  const { bandId } = await params;
  const { user, membership, isFinanceAdmin } = await requireMembership(bandId);
  const features = getEnabledFeatures(membership.band);
  if (!features.finance || !canManageContent(membership.role)) {
    redirect(`/bands/${bandId}`);
  }
  const canManage = canManageFinance(isFinanceAdmin);
  const { from, to, type, eventType } = await searchParams;
  const isBandBalanceMode = membership.band.financeSettlementMode === "BAND_BALANCE";
  const t = await getTranslations("finance");
  const format = await getFormatter();
  const locale = await getLocale();

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground">{t("myFinances")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminOnlyHint")}</p>
        <div className="mt-4">
          <MyFinanceSection bandId={bandId} userId={user.id} isFinanceAdmin={isFinanceAdmin} linkToEntries={false} />
        </div>
      </div>
    );
  }

  const tEventTypes = await getTranslations("calendar.eventTypes");
  const eventTypeLabels = getEventTypeLabels(tEventTypes);
  const financeEntryTypeLabels = getFinanceEntryTypeLabels(t);
  const validEventType =
    eventType && (EVENT_TYPES as readonly string[]).includes(eventType) ? (eventType as EventType) : undefined;

  const where = {
    bandId,
    ...(type === "INCOME" || type === "EXPENSE"
      ? { type: type as FinanceEntryType }
      : type === "BALANCE"
        ? { type: { in: BALANCE_TYPES } }
        : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(validEventType ? { event: { type: validEventType } } : {}),
  };

  const [entries, events, bandBalance] = await Promise.all([
    prisma.financeEntry.findMany({
      where,
      orderBy: { date: "desc" },
      include: { event: { select: { id: true, title: true, type: true } } },
    }),
    prisma.event.findMany({
      where: { bandId },
      orderBy: { startsAt: "desc" },
      select: { id: true, title: true },
      take: 100,
    }),
    // Bandkonto-Stand ist bewusst ungefiltert (gesamter Zeitraum), unabhaengig von
    // den Datums-/Typ-Filtern der Liste weiter unten.
    isBandBalanceMode ? computeBandBalance(bandId) : Promise.resolve(0),
  ]);

  const incomeTotal = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amountCents, 0);
  const expenseTotal = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amountCents, 0);
  const balance = incomeTotal - expenseTotal;

  const typeFilters = [
    { value: undefined, label: t("filterAll") },
    { value: "INCOME", label: t("filterIncome") },
    { value: "EXPENSE", label: t("filterExpense") },
    ...(isBandBalanceMode ? [{ value: "BALANCE", label: t("filterBalance") }] : []),
  ];

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (type) exportParams.set("type", type);
  if (eventType) exportParams.set("eventType", eventType);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <Link
          href={`/api/bands/${bandId}/finance-export.csv?${exportParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary"
        >
          <Download className="h-4 w-4" />
          {t("csvExport")}
        </Link>
      </div>

      <div className={`mt-4 grid gap-3 sm:grid-cols-3 ${isBandBalanceMode ? "lg:grid-cols-4" : ""}`}>
        <Card>
          <p className="text-sm text-muted">{t("income")}</p>
          <p className="text-xl font-semibold text-success">{formatEuro(incomeTotal, locale)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("expense")}</p>
          <p className="text-xl font-semibold text-danger">{formatEuro(expenseTotal, locale)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">{t("balance")}</p>
          <p className="text-xl font-semibold text-foreground">{formatEuro(balance, locale)}</p>
        </Card>
        {isBandBalanceMode && (
          <Card>
            <p className="text-sm text-muted">{t("bandBalanceTotal")}</p>
            <p className="text-xl font-semibold text-foreground">{formatEuro(bandBalance, locale)}</p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <h2 className="font-semibold text-foreground">{t("myFinances")}</h2>
        <div className="mt-2">
          <MyFinanceSection bandId={bandId} userId={user.id} isFinanceAdmin={isFinanceAdmin} linkToEntries />
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="font-semibold text-foreground">{t("createEntryTitle")}</h2>
        <div className="mt-3">
          <NewFinanceEntryForm
            action={createFinanceEntryAction.bind(null, bandId)}
            events={events}
            categorySuggestions={getFinanceCategorySuggestions(t)}
            allowBalanceTypes={isBandBalanceMode}
          />
        </div>
      </Card>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border p-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t("from")}</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t("to")}</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t("eventTypeLabel")}</label>
          <select
            name="eventType"
            defaultValue={eventType ?? ""}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">{t("filterAll")}</option>
            {Object.entries(eventTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          {t("filter")}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border p-1">
        {typeFilters.map((f) => {
          const qp = new URLSearchParams();
          if (f.value) qp.set("type", f.value);
          if (from) qp.set("from", from);
          if (to) qp.set("to", to);
          if (eventType) qp.set("eventType", eventType);
          const qs = qp.toString();
          return (
            <Link key={f.label} href={`/bands/${bandId}/finance${qs ? `?${qs}` : ""}`}>
              <span
                className={
                  (type ?? undefined) === f.value
                    ? "inline-block rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                    : "inline-block rounded-md px-3 py-1 text-sm text-muted"
                }
              >
                {f.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {entries.length === 0 && <Card className="text-sm text-muted">{t("noEntriesFound")}</Card>}
        {entries.map((entry) => (
          <Link key={entry.id} href={`/bands/${bandId}/finance/${entry.id}`}>
            <Card className="flex items-center justify-between gap-3 transition hover:border-primary">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{entry.category}</p>
                <p className="truncate text-sm text-muted">
                  {format.dateTime(entry.date, { dateStyle: "medium" })}
                  {entry.event && ` · ${entry.event.title}`}
                  {entry.description && ` · ${entry.description}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={financeEntryTypeBadgeVariant[entry.type]}>{financeEntryTypeLabels[entry.type]}</Badge>
                <p className="font-semibold text-foreground">{formatEuro(entry.amountCents, locale)}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
