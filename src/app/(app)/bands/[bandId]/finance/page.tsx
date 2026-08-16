import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireMembership, canManageFinance, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { eventTypeLabels } from "@/lib/event-colors";
import { financeCategorySuggestions } from "@/lib/finance-categories";
import { computeBandBalance } from "@/lib/finance-balance";
import {
  financeEntryTypeLabels,
  financeEntryTypeBadgeVariant,
  allocationRoleLabel,
  memberReceivesAllocation,
} from "@/lib/finance-entry-labels";
import { Card, Badge } from "@/components/ui/card";
import { ConfirmAllocationStatus } from "@/components/confirm-allocation-status";
import { NewFinanceEntryForm } from "@/components/new-finance-entry-form";
import { createFinanceEntryAction, confirmAllocationAction } from "./actions";
import type { EventType, FinanceEntryType } from "@/generated/prisma/client";

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
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

  if (myAllocations.length === 0) {
    return <Card className="text-sm text-muted">Noch keine eigenen Posten erfasst.</Card>;
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
                  {allocationRoleLabel(a.financeEntry.type)}
                </Badge>
                <p className="font-medium text-foreground truncate">
                  {a.financeEntry.event?.title ?? a.financeEntry.category}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(a.financeEntry.date)}
                {a.financeEntry.event && ` · ${eventTypeLabels[a.financeEntry.event.type]}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="font-semibold text-foreground">{formatEuro(a.amountCents)}</p>
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

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground">Meine Finanzen</h1>
        <p className="mt-1 text-sm text-muted">
          Nur Finanzadmin:innen sehen die vollständige Finanzübersicht der Band. Hier siehst du deine eigenen
          Auszahlungen und Kostenanteile.
        </p>
        <div className="mt-4">
          <MyFinanceSection bandId={bandId} userId={user.id} isFinanceAdmin={isFinanceAdmin} linkToEntries={false} />
        </div>
      </div>
    );
  }

  const validEventType = eventType && eventType in eventTypeLabels ? (eventType as EventType) : undefined;

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
    { value: undefined, label: "Alle" },
    { value: "INCOME", label: "Einnahmen" },
    { value: "EXPENSE", label: "Ausgaben" },
    ...(isBandBalanceMode ? [{ value: "BALANCE", label: "Bandkonto" }] : []),
  ];

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (type) exportParams.set("type", type);
  if (eventType) exportParams.set("eventType", eventType);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Finanzen</h1>
        <Link
          href={`/api/bands/${bandId}/finance-export.csv?${exportParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary"
        >
          <Download className="h-4 w-4" />
          CSV-Export
        </Link>
      </div>

      <div className={`mt-4 grid gap-3 sm:grid-cols-3 ${isBandBalanceMode ? "lg:grid-cols-4" : ""}`}>
        <Card>
          <p className="text-sm text-muted">Einnahmen</p>
          <p className="text-xl font-semibold text-success">{formatEuro(incomeTotal)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Ausgaben</p>
          <p className="text-xl font-semibold text-danger">{formatEuro(expenseTotal)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Saldo</p>
          <p className="text-xl font-semibold text-foreground">{formatEuro(balance)}</p>
        </Card>
        {isBandBalanceMode && (
          <Card>
            <p className="text-sm text-muted">Bandkonto (gesamt)</p>
            <p className="text-xl font-semibold text-foreground">{formatEuro(bandBalance)}</p>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <h2 className="font-semibold text-foreground">Meine Finanzen</h2>
        <div className="mt-2">
          <MyFinanceSection bandId={bandId} userId={user.id} isFinanceAdmin={isFinanceAdmin} linkToEntries />
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="font-semibold text-foreground">Eintrag anlegen</h2>
        <div className="mt-3">
          <NewFinanceEntryForm
            action={createFinanceEntryAction.bind(null, bandId)}
            events={events}
            categorySuggestions={financeCategorySuggestions}
            allowBalanceTypes={isBandBalanceMode}
          />
        </div>
      </Card>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border p-3" method="get">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Von</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Bis</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Auftrittsart</label>
          <select
            name="eventType"
            defaultValue={eventType ?? ""}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            <option value="">Alle</option>
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
          Filtern
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
        {entries.length === 0 && <Card className="text-sm text-muted">Keine Einträge gefunden.</Card>}
        {entries.map((entry) => (
          <Link key={entry.id} href={`/bands/${bandId}/finance/${entry.id}`}>
            <Card className="flex items-center justify-between gap-3 transition hover:border-primary">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{entry.category}</p>
                <p className="truncate text-sm text-muted">
                  {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(entry.date)}
                  {entry.event && ` · ${entry.event.title}`}
                  {entry.description && ` · ${entry.description}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={financeEntryTypeBadgeVariant[entry.type]}>{financeEntryTypeLabels[entry.type]}</Badge>
                <p className="font-semibold text-foreground">{formatEuro(entry.amountCents)}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
