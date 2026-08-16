import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name muss mindestens 2 Zeichen haben"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Bitte aktuelles Passwort eingeben"),
  newPassword: z.string().min(8, "Neues Passwort muss mindestens 8 Zeichen haben"),
  confirmPassword: z.string().min(1, "Bitte neues Passwort bestätigen"),
});

export const bandCreateSchema = z.object({
  name: z.string().min(2, "Bandname muss mindestens 2 Zeichen haben"),
});

export const bandProfileSchema = z.object({
  name: z.string().min(2, "Bandname muss mindestens 2 Zeichen haben"),
  genre: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  contactEmail: z.string().email("Ungültige E-Mail-Adresse").optional().or(z.literal("")),
  websiteUrl: z.string().url("Ungültige URL").optional().or(z.literal("")),
  instagramUrl: z.string().url("Ungültige URL").optional().or(z.literal("")),
  facebookUrl: z.string().url("Ungültige URL").optional().or(z.literal("")),
  spotifyUrl: z.string().url("Ungültige URL").optional().or(z.literal("")),
});

export const inviteSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  role: z.enum(["ADMIN", "FINANCE_ADMIN", "MEMBER", "GUEST"]),
  guestUntil: z.string().optional(),
});

export const guestAccessSchema = z.object({
  guestUntil: z.string().optional(),
});

export const eventSchema = z
  .object({
    title: z.string().min(2, "Titel ist erforderlich"),
    type: z.enum(["REHEARSAL", "GIG", "MEETING", "OTHER"]),
    startsAt: z.string().min(1, "Startzeit ist erforderlich"),
    endsAt: z.string().min(1, "Endzeit ist erforderlich"),
    location: z.string().optional(),
    description: z.string().optional(),
    repeatWeekly: z.boolean().optional(),
    repeatUntil: z.string().optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "Ende muss nach dem Start liegen",
    path: ["endsAt"],
  });

export const absenceSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    reason: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "Ende darf nicht vor dem Start liegen",
    path: ["endDate"],
  });

export const songSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  key: z.string().optional(),
  bpm: z.coerce.number().int().positive().optional().or(z.literal("")),
  timeSignature: z.string().optional(),
  durationSec: z.coerce.number().int().positive().optional().or(z.literal("")),
  genre: z.string().optional(),
  artist: z.string().optional(),
  status: z.enum(["PROPOSED", "NEW", "IN_PROGRESS", "STAGE_READY", "ACTIVE", "ARCHIVED"]),
  lyrics: z.string().optional(),
  remarks: z.string().optional(),
});

export const songLinkSchema = z.object({
  url: z.string().url("Ungültige URL"),
  label: z.string().optional(),
});

export const songVoteSchema = z.object({
  vote: z.enum(["UP", "DOWN"]),
  comment: z.string().max(280, "Kommentar darf maximal 280 Zeichen haben").optional(),
});

export const setlistSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  eventId: z.string().optional(),
});

export const equipmentSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  location: z.string().optional(),
  ownerId: z.string().optional(),
  responsibleId: z.string().optional(),
  category: z.enum([
    "INSTRUMENTS",
    "INSTRUMENT_ACCESSORIES",
    "AMPS_PEDALBOARD",
    "STAGE_EQUIPMENT",
    "PA",
    "MONITORING",
    "PERSONAL",
    "OTHER",
  ]),
});

export const packlistSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  eventId: z.string().optional(),
});
