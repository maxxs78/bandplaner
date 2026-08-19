import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Printer, Save } from "lucide-react";
import { requireMembership, canManageContent } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getEnabledFeatures } from "@/lib/features";
import { SetlistBuilder } from "@/components/setlist-builder";
import { deleteSetlistAction, saveSetlistNoteAction } from "../actions";
import { DeleteButton } from "@/components/delete-button";
import { WhatsAppShareButton } from "@/components/whatsapp-share-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

export default async function SetlistDetailPage({
  params,
}: {
  params: Promise<{ bandId: string; setlistId: string }>;
}) {
  const { bandId, setlistId } = await params;
  const { user, membership } = await requireMembership(bandId);
  const canManage = canManageContent(membership.role);
  const features = getEnabledFeatures(membership.band);

  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId, bandId },
    include: {
      event: true,
      items: {
        orderBy: { order: "asc" },
        include: {
          song: true,
          annotations: { where: { userId: user.id } },
        },
      },
      notes: { where: { userId: user.id } },
    },
  });
  if (!setlist) notFound();

  const songs = await prisma.song.findMany({
    where: { bandId, status: { notIn: ["PROPOSED", "ARCHIVED"] } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, key: true, bpm: true, status: true },
  });

  const myNote = setlist.notes[0];
  const items = setlist.items.map((item) => ({
    ...item,
    myAnnotation: item.annotations[0] ?? null,
  }));

  const shareText = [
    `${membership.band.name} – ${setlist.name}`,
    setlist.event ? setlist.event.title : null,
    "",
    ...setlist.items.map((item, index) => `${index + 1}. ${item.song?.title ?? item.customTitle ?? ""}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const totalDurationSec = setlist.items.reduce((sum, item) => sum + (item.song?.durationSec ?? 0), 0);
  const formatTotalDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <div>
        <Link
          href={`/bands/${bandId}/setlists`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Setlisten
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{setlist.name}</h1>
            {setlist.event && (
              <p className="mt-1 text-sm text-muted">
                Verknüpft mit{" "}
                <Link href={`/bands/${bandId}/calendar/${setlist.event.id}`} className="text-primary hover:underline">
                  {setlist.event.title}
                </Link>
              </p>
            )}
            {totalDurationSec > 0 && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <Clock className="h-3.5 w-3.5" />
                Gesamtdauer: {formatTotalDuration(totalDurationSec)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {features.communication && <WhatsAppShareButton text={shareText} label="Teilen" />}
            <Link href={`/print/setlists/${setlistId}`} target="_blank">
              <Button variant="secondary" size="sm">
                <Printer className="h-4 w-4" />
                Drucken
              </Button>
            </Link>
            {canManage && (
              <DeleteButton action={deleteSetlistAction.bind(null, bandId, setlistId)} label="Löschen" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SetlistBuilder
          key={setlist.items.map((i) => i.id).join(",")}
          bandId={bandId}
          setlistId={setlistId}
          initialItems={items}
          librarySongs={songs}
          readOnly={!canManage}
        />
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Meine Notizen zu dieser Setlist</h2>
        <p className="mt-1 text-sm text-muted">Nur für dich sichtbar.</p>
        <form action={saveSetlistNoteAction.bind(null, bandId, setlistId)} className="mt-3 space-y-3">
          <Textarea
            name="content"
            rows={3}
            defaultValue={myNote?.content ?? ""}
            placeholder="z. B. Ablaufhinweise, Reihenfolge-Absprachen, Erinnerungen für diesen Auftritt…"
          />
          <Button type="submit" size="sm">
            <Save className="h-4 w-4" />
            Notiz speichern
          </Button>
        </form>
      </Card>
    </div>
  );
}
