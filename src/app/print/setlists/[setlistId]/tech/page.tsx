import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { PrintTrigger } from "@/components/print-trigger";
import { computeSetlistNumbers } from "@/lib/setlist-items";

function formatDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Tabellarischer, kleiner gesetzter Ausdruck fuer FOH/Licht/Technik - im
 * Unterschied zur "grossen" Setlisten-Druckansicht (page.tsx) bewusst ohne
 * eingefrorenen historischen Stand: technische Hinweise sind Referenzdaten,
 * kein "wie gespielt"-Protokoll, daher immer der Live-Stand.
 */
export default async function SetlistTechPrintPage({
  params,
}: {
  params: Promise<{ setlistId: string }>;
}) {
  const { setlistId } = await params;

  const setlistMeta = await prisma.setlist.findUnique({
    where: { id: setlistId },
    select: { bandId: true },
  });
  if (!setlistMeta) notFound();

  await requireMembership(setlistMeta.bandId);

  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId },
    include: {
      items: { orderBy: { order: "asc" }, include: { song: true } },
      band: { select: { name: true } },
    },
  });
  if (!setlist) notFound();

  const t = await getTranslations("setlists.techPrint");
  const numbers = computeSetlistNumbers(setlist.items);
  const isPlayableKind = (k?: string | null) => k === "SONG" || k === "CUSTOM";
  const seguedFromPrev = (index: number) => {
    const p = setlist.items[index - 1];
    return Boolean(p?.segueToNext && isPlayableKind(p.kind) && isPlayableKind(setlist.items[index]?.kind));
  };
  const seguesToNext = (index: number) => {
    const cur = setlist.items[index];
    return Boolean(cur?.segueToNext && isPlayableKind(cur.kind) && isPlayableKind(setlist.items[index + 1]?.kind));
  };

  return (
    <main className="mx-auto max-w-[297mm] bg-white px-8 py-8 text-black print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 12mm 14mm;
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

      <div className="mb-4 flex items-baseline justify-between border-b-2 border-black pb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">{setlist.name}</h1>
          <span className="text-sm text-gray-600">{t("titleSuffix")}</span>
        </div>
        <span className="text-sm text-gray-600">{setlist.band.name}</span>
      </div>

      {setlist.techNotes && (
        <p className="mb-4 whitespace-pre-wrap rounded border border-gray-300 bg-gray-50 p-2 text-xs">
          {setlist.techNotes}
        </p>
      )}

      {setlist.items.length === 0 ? (
        <p className="text-sm text-gray-600">{t("empty")}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="w-8 py-1 pr-2 font-semibold">{t("columnNr")}</th>
              <th className="py-1 pr-2 font-semibold">{t("columnTitle")}</th>
              <th className="w-12 py-1 pr-2 font-semibold">{t("columnKey")}</th>
              <th className="w-12 py-1 pr-2 font-semibold">{t("columnBpm")}</th>
              <th className="w-16 py-1 pr-2 font-semibold">{t("columnDuration")}</th>
              <th className="py-1 font-semibold">{t("columnNotes")}</th>
            </tr>
          </thead>
          <tbody>
            {setlist.items.map((item, index) => {
              if (item.kind === "SECTION") {
                return (
                  <tr key={item.id} className="break-inside-avoid">
                    <td colSpan={6} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide">
                      {item.customTitle || "—".repeat(20)}
                    </td>
                  </tr>
                );
              }
              if (item.kind === "COMMENT") {
                return (
                  <tr key={item.id} className="break-inside-avoid">
                    <td colSpan={6} className="py-1 text-[11px] italic text-gray-700">
                      {item.customTitle}
                    </td>
                  </tr>
                );
              }
              const notes = [item.song?.techNotes, item.techNotes].filter(Boolean).join(" · ");
              const linkedUp = seguedFromPrev(index);
              const linkedDown = seguesToNext(index);
              return (
                <tr
                  key={item.id}
                  className={`break-inside-avoid ${linkedDown ? "" : "border-b border-gray-200"}`}
                >
                  <td
                    className={`py-1 pr-2 align-top font-mono text-gray-500 ${
                      linkedUp || linkedDown ? "border-l-2 border-l-black pl-1.5" : ""
                    }`}
                  >
                    {linkedUp
                      ? "↳"
                      : numbers[index] !== null
                        ? `${numbers[index]}.`
                        : ""}
                  </td>
                  <td className="py-1 pr-2 align-top font-medium">
                    {item.song?.title ?? item.customTitle}
                  </td>
                  <td className="py-1 pr-2 align-top">{item.song?.key ?? ""}</td>
                  <td className="py-1 pr-2 align-top">{item.song?.bpm ?? ""}</td>
                  <td className="py-1 pr-2 align-top">
                    {formatDuration(item.song?.durationSec ?? item.durationSec ?? null) ?? ""}
                  </td>
                  <td className="py-1 align-top">{notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
