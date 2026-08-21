import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { PrintTrigger } from "@/components/print-trigger";

export default async function PacklistPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ packlistId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { packlistId } = await params;
  const { eventId } = await searchParams;

  const packlistMeta = await prisma.packlist.findUnique({
    where: { id: packlistId },
    select: { bandId: true },
  });
  if (!packlistMeta) notFound();

  const { membership } = await requireMembership(packlistMeta.bandId);
  if (!getEnabledFeatures(membership.band).packlists) redirect(`/bands/${packlistMeta.bandId}`);

  const packlist = await prisma.packlist.findUnique({
    where: { id: packlistId },
    include: {
      band: true,
      events: { where: { id: eventId ?? "" }, select: { title: true } },
      eventSnapshots: { where: { eventId: eventId ?? "" } },
      items: {
        orderBy: { order: "asc" },
        include: {
          equipment: { select: { name: true } },
          assignedTo: { select: { name: true } },
          eventStatuses: {
            where: { eventId: eventId ?? "" },
            include: { assignedTo: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!packlist) notFound();
  const eventTitle = eventId ? packlist.events?.[0]?.title : undefined;
  // Fuer bereits eingefrorene vergangene Termine den historischen Stand
  // drucken statt der (moeglicherweise seither veraenderten) Live-Liste.
  const frozenSnapshot = packlist.eventSnapshots?.[0];
  const frozenItems: { name: string; checked: boolean; assignedToName: string | null }[] | null = frozenSnapshot
    ? JSON.parse(frozenSnapshot.itemsJson)
    : null;

  const t = await getTranslations("packlists.detail");

  return (
    <main className="mx-auto max-w-[210mm] bg-white px-10 py-10 text-black print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 14mm 16mm;
        }
        @media print {
          html, body { background: #fff; }
        }
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
      <PrintTrigger />

      <div className="mb-6 flex items-baseline justify-between border-b-4 border-black pb-3">
        <div className="flex items-baseline gap-4">
          <h1 className="text-4xl font-extrabold tracking-tight">{packlist.name}</h1>
          {eventTitle && <span className="text-xl font-semibold text-gray-600">{eventTitle}</span>}
        </div>
        <span className="text-lg text-gray-600">{packlist.band.name}</span>
      </div>

      <ol className="space-y-1">
        {frozenItems
          ? frozenItems.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-4 border-b border-gray-200 py-3 break-inside-avoid"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-black text-lg">
                  {item.checked ? "✓" : ""}
                </span>
                <span className="flex-1 text-2xl font-semibold leading-tight break-words">{item.name}</span>
                {item.assignedToName && (
                  <span className="shrink-0 text-lg text-gray-600">{item.assignedToName}</span>
                )}
              </li>
            ))
          : packlist.items.map((item) => {
              const status = eventId ? item.eventStatuses?.[0] : null;
              const checked = eventId ? (status?.checked ?? false) : item.checked;
              const assignedTo = eventId ? status?.assignedTo : item.assignedTo;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-4 border-b border-gray-200 py-3 break-inside-avoid"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-black text-lg">
                    {checked ? "✓" : ""}
                  </span>
                  <span className="flex-1 text-2xl font-semibold leading-tight break-words">
                    {item.equipment?.name ?? item.customName}
                  </span>
                  {assignedTo && (
                    <span className="shrink-0 text-lg text-gray-600">{assignedTo.name}</span>
                  )}
                </li>
              );
            })}
      </ol>
      {(frozenItems ?? packlist.items).length === 0 && <p className="text-gray-600">{t("printEmpty")}</p>}
    </main>
  );
}
