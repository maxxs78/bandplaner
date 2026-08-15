import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { PrintTrigger } from "@/components/print-trigger";

export default async function PacklistPrintPage({
  params,
}: {
  params: Promise<{ packlistId: string }>;
}) {
  const { packlistId } = await params;

  const packlistMeta = await prisma.packlist.findUnique({
    where: { id: packlistId },
    select: { bandId: true },
  });
  if (!packlistMeta) notFound();

  await requireMembership(packlistMeta.bandId);

  const packlist = await prisma.packlist.findUnique({
    where: { id: packlistId },
    include: {
      band: true,
      event: true,
      items: {
        orderBy: { order: "asc" },
        include: {
          equipment: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      },
    },
  });
  if (!packlist) notFound();

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
          {packlist.event && (
            <span className="text-xl font-semibold text-gray-600">{packlist.event.title}</span>
          )}
        </div>
        <span className="text-lg text-gray-600">{packlist.band.name}</span>
      </div>

      <ol className="space-y-1">
        {packlist.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-4 border-b border-gray-200 py-3 break-inside-avoid"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-black text-lg">
              {item.checked ? "✓" : ""}
            </span>
            <span className="flex-1 text-2xl font-semibold leading-tight break-words">
              {item.equipment?.name ?? item.customName}
            </span>
            {item.assignedTo && (
              <span className="shrink-0 text-lg text-gray-600">{item.assignedTo.name}</span>
            )}
          </li>
        ))}
      </ol>
      {packlist.items.length === 0 && <p className="text-gray-600">Diese Packliste ist noch leer.</p>}
    </main>
  );
}
