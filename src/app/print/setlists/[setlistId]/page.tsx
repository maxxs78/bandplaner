import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { PrintTrigger } from "@/components/print-trigger";
import { CueBadges, EquipmentIconStrip } from "@/components/cue-badges";
import { parseCues } from "@/lib/setlist-cues";
import { computeSetlistNumbers, totalSetlistDurationSec, type SetlistDisplayItem } from "@/lib/setlist-items";

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
  const frozenItems: SetlistDisplayItem[] | null = frozenSnapshot ? JSON.parse(frozenSnapshot.itemsJson) : null;
  const numbers = computeSetlistNumbers(
    frozenItems ?? setlist.items.map((item) => ({ kind: item.kind, excludeFromNumbering: item.excludeFromNumbering }))
  );
  const isPlayableKind = (k?: string | null) => k === "SONG" || k === "CUSTOM";
  const liveSeguedFromPrev = (index: number) => {
    const p = setlist.items[index - 1];
    return Boolean(p?.segueToNext && isPlayableKind(p.kind) && isPlayableKind(setlist.items[index]?.kind));
  };
  const liveSeguesToNext = (index: number) => {
    const cur = setlist.items[index];
    return Boolean(cur?.segueToNext && isPlayableKind(cur.kind) && isPlayableKind(setlist.items[index + 1]?.kind));
  };
  const frozenSeguedFromPrev = (index: number) => {
    const list = frozenItems ?? [];
    const p = list[index - 1];
    return Boolean(p?.segueToNext && isPlayableKind(p.kind) && isPlayableKind(list[index]?.kind));
  };
  const frozenSeguesToNext = (index: number) => {
    const list = frozenItems ?? [];
    const cur = list[index];
    return Boolean(cur?.segueToNext && isPlayableKind(cur.kind) && isPlayableKind(list[index + 1]?.kind));
  };
  // Gemeinsame Klammer um einen Segue-Lauf: durchgehender schwarzer Balken links,
  // Abstand zwischen den Songs geschlossen (space-y aufgehoben).
  const segueBracket = (linkedUp: boolean, linkedDown: boolean) =>
    linkedUp || linkedDown
      ? `border-l-[3px] border-l-black py-3 pl-3 ${linkedUp ? "-mt-1" : ""}`
      : "py-3";

  const t = await getTranslations("setlists.detail");
  const totalDurationSec = frozenItems
    ? totalSetlistDurationSec(frozenItems)
    : totalSetlistDurationSec(
        setlist.items.map((item) => ({ durationSec: item.song?.durationSec ?? item.durationSec ?? null }))
      );
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
          ? frozenItems.map((item, index) => {
              if (item.kind === "SECTION") {
                return (
                  <li key={index} className="flex items-center gap-4 py-4 break-inside-avoid">
                    <div className="h-0.5 flex-1 bg-black" />
                    {item.title && <span className="shrink-0 text-2xl font-bold uppercase tracking-wide">{item.title}</span>}
                    <div className="h-0.5 flex-1 bg-black" />
                  </li>
                );
              }
              if (item.kind === "COMMENT") {
                return (
                  <li key={index} className="py-1 text-xl italic text-gray-700 break-inside-avoid">
                    {item.title}
                  </li>
                );
              }
              const fLinkedUp = frozenSeguedFromPrev(index);
              const fLinkedDown = frozenSeguesToNext(index);
              return (
                <li
                  key={index}
                  className={`flex items-start gap-4 border-b border-gray-200 break-inside-avoid ${segueBracket(fLinkedUp, fLinkedDown)}`}
                  style={fLinkedUp || fLinkedDown ? undefined : { paddingLeft: "26px" }}
                >
                  <span className="w-12 shrink-0 font-mono text-3xl font-bold text-gray-400">
                    {fLinkedUp
                      ? "↳"
                      : numbers[index] !== null
                        ? `${numbers[index]}.`
                        : ""}
                  </span>
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
                      {item.kind === "CUSTOM" && item.durationSec && (
                        <span className="text-xl font-medium text-gray-600">
                          {Math.round(item.durationSec / 60)} Min.
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          : setlist.items.map((item, index) => {
              if (item.kind === "SECTION") {
                return (
                  <li key={item.id} className="flex items-center gap-4 py-4 break-inside-avoid">
                    <div className="h-0.5 flex-1 bg-black" />
                    {item.customTitle && (
                      <span className="shrink-0 text-2xl font-bold uppercase tracking-wide">{item.customTitle}</span>
                    )}
                    <div className="h-0.5 flex-1 bg-black" />
                  </li>
                );
              }
              if (item.kind === "COMMENT") {
                return (
                  <li key={item.id} className="py-1 text-xl italic text-gray-700 break-inside-avoid">
                    {item.customTitle}
                  </li>
                );
              }
              const annotation = eventId ? item.eventAnnotations?.[0] : item.annotations[0];
              const cues = parseCues(annotation?.cues);
              const lLinkedUp = liveSeguedFromPrev(index);
              const lLinkedDown = liveSeguesToNext(index);
              const lBracket = (lLinkedUp || lLinkedDown) && !annotation?.color;
              return (
                <li
                  key={item.id}
                  className={`flex items-start gap-4 border-b border-gray-200 break-inside-avoid py-3 ${
                    lLinkedUp ? "-mt-1" : ""
                  } ${lBracket ? "border-l-[3px] border-l-black pl-3" : ""}`}
                  style={
                    annotation?.color
                      ? { borderLeft: `12px solid ${annotation.color}`, paddingLeft: "14px" }
                      : lBracket
                        ? undefined
                        : { paddingLeft: "26px" }
                  }
                >
                  <span className="w-12 shrink-0 font-mono text-3xl font-bold text-gray-400">
                    {lLinkedUp
                      ? "↳"
                      : numbers[index] !== null
                        ? `${numbers[index]}.`
                        : ""}
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
                      {item.kind === "CUSTOM" && item.durationSec && (
                        <span className="text-xl font-medium text-gray-600">
                          {Math.round(item.durationSec / 60)} Min.
                        </span>
                      )}
                      {setlist.equipmentIconDisplay === "LARGE" && <EquipmentIconStrip cues={cues} size="xl" />}
                    </div>
                    {(annotation?.note || cues.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {annotation?.note && (
                          <span className="text-xl italic text-gray-800">{annotation.note}</span>
                        )}
                        <CueBadges
                          cues={cues}
                          size="lg"
                          showEquipmentIcon={setlist.equipmentIconDisplay === "IN_TAG"}
                        />
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
