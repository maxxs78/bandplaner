import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { PrintTrigger } from "@/components/print-trigger";
import { CueBadges } from "@/components/cue-badges";
import { parseCues } from "@/lib/setlist-cues";

export default async function SetlistPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ setlistId: string }>;
  searchParams: Promise<{ eventId?: string }>;
}) {
  const { setlistId } = await params;
  const { eventId } = await searchParams;

  const setlistMeta = await prisma.setlist.findUnique({
    where: { id: setlistId },
    select: { bandId: true },
  });
  if (!setlistMeta) notFound();

  const { user } = await requireMembership(setlistMeta.bandId);

  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          song: true,
          annotations: { where: { userId: user.id } },
          eventAnnotations: { where: { userId: user.id, eventId: eventId ?? "" } },
        },
      },
      events: { where: { id: eventId ?? "" }, select: { title: true } },
      eventSnapshots: { where: { eventId: eventId ?? "" } },
      band: true,
    },
  });
  if (!setlist) notFound();
  const eventTitle = eventId ? setlist.events?.[0]?.title : undefined;
  // Fuer bereits eingefrorene vergangene Termine den historischen Stand
  // drucken statt der (moeglicherweise seither veraenderten) Live-Liste.
  const frozenSnapshot = setlist.eventSnapshots?.[0];
  const frozenItems: { title: string; key: string | null; bpm: number | null; durationSec: number | null }[] | null =
    frozenSnapshot ? JSON.parse(frozenSnapshot.itemsJson) : null;

  const t = await getTranslations("setlists.detail");
  const totalDurationSec = frozenItems
    ? frozenItems.reduce((sum, item) => sum + (item.durationSec ?? 0), 0)
    : setlist.items.reduce((sum, item) => sum + (item.song?.durationSec ?? 0), 0);
  const formatTotalDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

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
          <h1 className="text-4xl font-extrabold tracking-tight">{setlist.name}</h1>
          {totalDurationSec > 0 && (
            <span className="text-xl font-semibold text-gray-600">
              {formatTotalDuration(totalDurationSec)}
            </span>
          )}
        </div>
        <span className="text-lg text-gray-600">
          {setlist.band.name}
          {eventTitle ? ` · ${eventTitle}` : ""}
        </span>
      </div>

      <ol className="space-y-1">
        {frozenItems
          ? frozenItems.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-4 border-b border-gray-200 py-3 break-inside-avoid"
                style={{ paddingLeft: "26px" }}
              >
                <span className="w-12 shrink-0 font-mono text-3xl font-bold text-gray-400">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-4xl font-extrabold leading-tight break-words">{item.title}</span>
                    {item.key && (
                      <span className="rounded-md border-2 border-black px-2.5 py-0.5 text-2xl font-bold leading-none">
                        {item.key}
                      </span>
                    )}
                    {item.bpm && (
                      <span className="rounded-md border-2 border-black px-2.5 py-0.5 text-2xl font-bold leading-none">
                        {item.bpm}
                        <span className="ml-1 text-base font-medium">BPM</span>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))
          : setlist.items.map((item, index) => {
              const annotation = eventId ? item.eventAnnotations?.[0] : item.annotations[0];
              const cues = parseCues(annotation?.cues);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-4 border-b border-gray-200 py-3 break-inside-avoid"
                  style={
                    annotation?.color
                      ? { borderLeft: `12px solid ${annotation.color}`, paddingLeft: "14px" }
                      : { paddingLeft: "26px" }
                  }
                >
                  <span className="w-12 shrink-0 font-mono text-3xl font-bold text-gray-400">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-4xl font-extrabold leading-tight break-words">
                        {item.song?.title ?? item.customTitle}
                      </span>
                      {item.song?.key && (
                        <span className="rounded-md border-2 border-black px-2.5 py-0.5 text-2xl font-bold leading-none">
                          {item.song.key}
                        </span>
                      )}
                      {item.song?.bpm && (
                        <span className="rounded-md border-2 border-black px-2.5 py-0.5 text-2xl font-bold leading-none">
                          {item.song.bpm}
                          <span className="ml-1 text-base font-medium">BPM</span>
                        </span>
                      )}
                    </div>
                    {(annotation?.note || cues.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {annotation?.note && (
                          <span className="text-xl italic text-gray-800">{annotation.note}</span>
                        )}
                        <CueBadges cues={cues} size="lg" />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
      </ol>
      {(frozenItems ?? setlist.items).length === 0 && <p className="text-gray-600">{t("printEmpty")}</p>}
    </main>
  );
}
