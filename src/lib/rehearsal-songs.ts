import { prisma } from "@/lib/prisma";

/**
 * Proben-Tracking (Modul Band.rehearsalTrackingEnabled). Die "an einem
 * Probentermin geuebten Songs" sind die Vereinigung aus:
 *  - explizit zugeordneten Songs (Modell RehearsalSong)
 *  - Songs aus Setlisten, die mit dem (Proben-)Termin verknuepft sind
 * Die abgeleiteten Eintraege werden nicht gespeichert - sie ergeben sich bei
 * jeder Abfrage neu. Explizit gewinnt (behaelt seine Notiz).
 */

export type RehearsalSongEntry = {
  songId: string;
  title: string;
  source: "explicit" | "setlist";
  note: string | null;
};

export async function getRehearsalSongs(eventId: string): Promise<RehearsalSongEntry[]> {
  const [explicit, setlists] = await Promise.all([
    prisma.rehearsalSong.findMany({
      where: { eventId },
      include: { song: { select: { id: true, title: true } } },
      orderBy: { song: { title: "asc" } },
    }),
    prisma.setlist.findMany({
      where: { events: { some: { id: eventId } } },
      select: {
        items: {
          where: { kind: "SONG", songId: { not: null } },
          select: { song: { select: { id: true, title: true } } },
        },
      },
    }),
  ]);

  const byId = new Map<string, RehearsalSongEntry>();
  for (const e of explicit) {
    byId.set(e.songId, { songId: e.songId, title: e.song.title, source: "explicit", note: e.note });
  }
  for (const sl of setlists) {
    for (const it of sl.items) {
      if (it.song && !byId.has(it.song.id)) {
        byId.set(it.song.id, { songId: it.song.id, title: it.song.title, source: "setlist", note: null });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export type SongRehearsalHistoryEntry = {
  eventId: string;
  title: string;
  startsAt: Date;
  source: "explicit" | "setlist";
  note: string | null;
};

/** Chronologische Historie "wann wurde dieser Song geuebt" fuer die Song-Detailseite (neueste zuerst). */
export async function getSongRehearsalHistory(
  songId: string,
  bandId: string
): Promise<SongRehearsalHistoryEntry[]> {
  const [explicit, setlistEvents] = await Promise.all([
    prisma.rehearsalSong.findMany({
      where: { songId, event: { bandId, type: "REHEARSAL" } },
      include: { event: { select: { id: true, title: true, startsAt: true } } },
    }),
    prisma.event.findMany({
      where: {
        bandId,
        type: "REHEARSAL",
        setlists: { some: { items: { some: { songId } } } },
      },
      select: { id: true, title: true, startsAt: true },
    }),
  ]);

  const byEvent = new Map<string, SongRehearsalHistoryEntry>();
  for (const e of explicit) {
    byEvent.set(e.event.id, {
      eventId: e.event.id,
      title: e.event.title,
      startsAt: e.event.startsAt,
      source: "explicit",
      note: e.note,
    });
  }
  for (const ev of setlistEvents) {
    if (!byEvent.has(ev.id)) {
      byEvent.set(ev.id, { eventId: ev.id, title: ev.title, startsAt: ev.startsAt, source: "setlist", note: null });
    }
  }
  return [...byEvent.values()].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
}
