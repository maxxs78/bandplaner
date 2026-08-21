"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

/**
 * Termin-Auswähler für Setlisten/Packlisten, die an mehrere Termine verknüpft
 * sind (m:n) - steuert, für welchen Termin Abhak-Status bzw. persönliche
 * Hinweise/Notizen gerade angezeigt/bearbeitet werden (siehe *EventStatus/
 * *EventAnnotation/EventNote-Modelle). Navigiert per `?eventId=` Query-Param,
 * "none" steht explizit für den terminlosen/allgemeinen Zustand.
 */
export function EventContextSelector({
  events,
  activeEventId,
  noEventLabel,
  basePath,
}: {
  events: { id: string; title: string }[];
  activeEventId: string | null;
  noEventLabel: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={activeEventId ?? "none"}
      onChange={(e) => router.push(`${basePath}?eventId=${e.target.value}`)}
      className="max-w-xs"
    >
      <option value="none">{noEventLabel}</option>
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.title}
        </option>
      ))}
    </Select>
  );
}
