import clsx from "clsx";

export const eventTypeLabels: Record<string, string> = {
  REHEARSAL: "Probe",
  GIG: "Auftritt",
  MEETING: "Meeting",
  OTHER: "Sonstiges",
};

export const eventTypeBadgeVariant: Record<string, "accent" | "success" | "warning" | "default"> = {
  REHEARSAL: "accent",
  GIG: "success",
  MEETING: "warning",
  OTHER: "default",
};

const eventTypeColorClasses: Record<
  string,
  { text: string; border: string; bgSolid: string; bgSoft: string; borderVar: string }
> = {
  REHEARSAL: {
    text: "text-accent",
    border: "border-accent",
    bgSolid: "bg-accent",
    bgSoft: "bg-accent/10",
    borderVar: "var(--accent)",
  },
  GIG: {
    text: "text-success",
    border: "border-success",
    bgSolid: "bg-success",
    bgSoft: "bg-success/10",
    borderVar: "var(--success)",
  },
  MEETING: {
    text: "text-warning",
    border: "border-warning",
    bgSolid: "bg-warning",
    bgSoft: "bg-warning/10",
    borderVar: "var(--warning)",
  },
  OTHER: {
    text: "text-muted",
    border: "border-border",
    bgSolid: "bg-muted",
    bgSoft: "bg-surface-muted",
    borderVar: "var(--muted)",
  },
};

export function eventTypeColor(type: string) {
  return eventTypeColorClasses[type] ?? eventTypeColorClasses.OTHER;
}

/**
 * Klassen für ein kompaktes Termin-Element (Monatsraster-Pille, Card-Umrandung).
 * Ausstehend (noch nicht alle Teilnehmer:innen haben zugesagt) = farblich umrandet.
 * Alle Teilnehmer:innen haben zugesagt = komplett gefüllt.
 */
export function eventPillClasses(type: string, allConfirmed: boolean) {
  const c = eventTypeColor(type);
  return allConfirmed
    ? clsx(c.bgSolid, "text-background border border-transparent")
    : clsx("bg-transparent", c.text, c.border, "border-2");
}

export function isEventFullyConfirmed(
  participantUserIds: string[],
  availabilities: { userId: string; status: string }[]
) {
  if (participantUserIds.length === 0) return false;
  return participantUserIds.every((uid) =>
    availabilities.some((a) => a.userId === uid && a.status === "YES")
  );
}
