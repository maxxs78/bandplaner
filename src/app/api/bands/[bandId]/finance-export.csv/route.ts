import { NextResponse } from "next/server";
import { requireMembership, canManageFinance } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { eventTypeLabels } from "@/lib/event-colors";
import { financeEntryTypeLabels } from "@/lib/finance-entry-labels";
import type { EventType, FinanceEntryType } from "@/generated/prisma/client";

const BALANCE_TYPES: FinanceEntryType[] = ["BALANCE_PAYOUT", "BALANCE_DEPOSIT"];

function csvEscape(value: string) {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bandId: string }> }
) {
  const { bandId } = await params;
  const { membership, isFinanceAdmin } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).finance || !canManageFinance(isFinanceAdmin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const type = url.searchParams.get("type");
  const eventType = url.searchParams.get("eventType");
  const validEventType = eventType && eventType in eventTypeLabels ? (eventType as EventType) : undefined;

  const entries = await prisma.financeEntry.findMany({
    where: {
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
    },
    orderBy: { date: "asc" },
    include: { event: { select: { title: true, type: true } }, allocations: { select: { amountCents: true } } },
  });

  const header = [
    "Datum",
    "Typ",
    "Kategorie",
    "Betrag (EUR)",
    "Zugeordnet (EUR)",
    "Rest/Bandkonto (EUR)",
    "Währung",
    "Termin",
    "Auftrittsart",
    "Beschreibung",
  ];
  const rows = entries.map((e) => {
    const allocated = e.allocations.reduce((s, a) => s + a.amountCents, 0);
    return [
      new Intl.DateTimeFormat("de-DE", { dateStyle: "short" }).format(e.date),
      financeEntryTypeLabels[e.type],
      e.category,
      (e.amountCents / 100).toFixed(2),
      (allocated / 100).toFixed(2),
      ((e.amountCents - allocated) / 100).toFixed(2),
      e.currency,
      e.event?.title ?? "",
      e.event ? eventTypeLabels[e.event.type] : "",
      e.description ?? "",
    ];
  });

  const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(";")).join("\r\n");
  const bom = "﻿"; // Excel oeffnet die Datei sonst mit falscher Umlaut-Kodierung.

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finanzen-${bandId}.csv"`,
    },
  });
}
