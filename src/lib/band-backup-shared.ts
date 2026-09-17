import path from "path";

/**
 * Erhöht sich nur bei inkompatiblen Änderungen an der Manifest-Struktur -
 * unabhängig von der App-Version (package.json), die für dieses Feature
 * nicht bewegt wird. Import lehnt jede andere Versionsnummer klar ab statt
 * eine Migration zu versuchen.
 */
export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_STAGING_ROOT = path.join(process.cwd(), "storage", "tmp-import");

/** Harte Obergrenzen beim Lesen eines hochgeladenen Backups (Zip-Bomben/Pathologie-Schutz). */
export const BACKUP_MAX_TOTAL_UNCOMPRESSED_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
export const BACKUP_MAX_ENTRY_COUNT = 200_000;

export class BandBackupImportError extends Error {
  constructor(
    public code:
      | "INVALID_ZIP"
      | "MISSING_MANIFEST"
      | "UNSUPPORTED_VERSION"
      | "INVALID_ENTRY"
      | "TOO_LARGE"
      | "SIZE_MISMATCH"
      | "FILE_MOVE_FAILED",
    message: string
  ) {
    super(message);
    this.name = "BandBackupImportError";
  }
}

// Alle Datumsfelder werden als ISO-Strings gespeichert (JSON hat keinen Date-Typ) -
// beim Export explizit mit .toISOString() erzeugt, beim Import explizit mit
// new Date(...) zurückgewandelt, statt uns auf JSON.stringify/parse-Automatik zu verlassen.

export interface BackupBand {
  id: string;
  name: string;
  imageUrl: string | null; // archivePath oder null
  genre: string | null;
  bio: string | null;
  location: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  spotifyUrl: string | null;
  createdAt: string;
  equipmentEnabled: boolean;
  packlistsEnabled: boolean;
  financeEnabled: boolean;
  communicationEnabled: boolean;
  mediaPlayerEnabled: boolean;
  keyDetectionEnabled: boolean;
  financeSettlementMode: string;
  defaultGuestAccessDays: number | null;
  publicFileLinksEnabled: boolean;
  locationsEnabled: boolean;
  rehearsalTrackingEnabled: boolean;
}

export interface BackupMembership {
  id: string;
  userId: string;
  role: string;
  guestUntil: string | null;
  createdAt: string;
  defaultPayoutAmountCents: number | null;
  notifyOnNewEvent: boolean;
  notifyOnEventChange: boolean;
  notifyOnSongProposal: boolean;
  notifyOnNewFile: boolean;
  notifyOnFinanceAllocation: boolean;
}

export interface BackupBandFinanceAdmin {
  id: string;
  userId: string;
  createdAt: string;
}

export interface BackupLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;
  capacity: number | null;
  stageAndTechNotes: string | null;
  loadingAndParkingNotes: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BackupEquipment {
  id: string;
  name: string;
  description: string | null;
  category: string;
  location: string | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
  responsibleId: string | null;
}

export interface BackupBandLineupRole {
  id: string;
  name: string;
  order: number;
  defaultAssigneeId: string | null;
}

export interface BackupSong {
  id: string;
  title: string;
  key: string | null;
  bpm: number | null;
  timeSignature: string | null;
  durationSec: number | null;
  genre: string | null;
  artist: string | null;
  album: string | null;
  releaseYear: number | null;
  cast: string | null;
  coverUrl: string | null; // archivePath oder null
  status: string;
  rejected: boolean;
  lyrics: string | null;
  remarks: string | null;
  techNotes: string | null;
  countInBeats: number | null;
  clickOffsetMs: number | null;
  createdAt: string;
  proposedById: string | null;
}

export interface BackupSongLink {
  id: string;
  songId: string;
  url: string;
  label: string | null;
  createdAt: string;
}

export interface BackupSongFile {
  id: string;
  songId: string;
  filename: string;
  archivePath: string; // files/song-files/<uuid>.<ext>
  mimeType: string;
  size: number;
  visibility: string;
  createdAt: string;
  uploadedById: string | null;
}

export interface BackupSongNote {
  id: string;
  songId: string;
  userId: string;
  content: string;
  shortNote: string | null;
  color: string | null;
  cues: string | null;
  updatedAt: string;
}

export interface BackupPracticeLoop {
  id: string;
  songId: string;
  name: string;
  startSec: number;
  endSec: number;
  createdAt: string;
  createdById: string | null;
}

export interface BackupSongVote {
  id: string;
  songId: string;
  userId: string;
  vote: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSetlist {
  id: string;
  name: string;
  createdAt: string;
  equipmentIconDisplay: string;
  techNotes: string | null;
}

export interface BackupSetlistItem {
  id: string;
  setlistId: string;
  order: number;
  kind: string;
  customTitle: string | null;
  durationSec: number | null;
  excludeFromNumbering: boolean;
  songDeleted: boolean;
  techNotes: string | null;
  segueToNext: boolean;
  songId: string | null;
}

export interface BackupSetlistNote {
  id: string;
  setlistId: string;
  userId: string;
  content: string;
  updatedAt: string;
}

export interface BackupSetlistItemAnnotation {
  id: string;
  itemId: string;
  userId: string;
  note: string | null;
  color: string | null;
  cues: string | null;
  updatedAt: string;
}

export interface BackupEvent {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  description: string | null;
  seriesId: string | null;
  createdAt: string;
  arrivalAt: string | null;
  soundcheckAt: string | null;
  technicalRequirements: string | null;
  gigStatus: string | null;
  createdById: string | null;
  locationId: string | null;
}

export interface BackupEventParticipant {
  id: string;
  eventId: string;
  userId: string;
}

export interface BackupEventLineupEntry {
  id: string;
  eventId: string;
  role: string;
  order: number;
  assignedToId: string | null;
  assignedToName: string | null;
}

export interface BackupAvailability {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  note: string | null;
  respondedAt: string;
}

export interface BackupAbsence {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
}

export interface BackupRehearsalSong {
  id: string;
  eventId: string;
  songId: string;
  note: string | null;
  createdAt: string;
  addedById: string | null;
}

export interface BackupSetlistItemEventAnnotation {
  id: string;
  itemId: string;
  eventId: string;
  userId: string;
  note: string | null;
  color: string | null;
  cues: string | null;
  updatedAt: string;
}

export interface BackupSetlistEventNote {
  id: string;
  setlistId: string;
  eventId: string;
  userId: string;
  content: string;
  updatedAt: string;
}

export interface BackupSetlistEventSnapshot {
  id: string;
  setlistId: string;
  eventId: string;
  itemsJson: string;
  createdAt: string;
}

export interface BackupPacklist {
  id: string;
  name: string;
  createdAt: string;
}

export interface BackupPacklistItem {
  id: string;
  packlistId: string;
  order: number;
  checked: boolean;
  customName: string | null;
  equipmentId: string | null;
  assignedToId: string | null;
}

export interface BackupPacklistEventSnapshot {
  id: string;
  packlistId: string;
  eventId: string;
  itemsJson: string;
  createdAt: string;
}

export interface BackupPacklistItemEventStatus {
  id: string;
  itemId: string;
  eventId: string;
  checked: boolean;
  assignedToId: string | null;
}

export interface BackupBandFile {
  id: string;
  filename: string;
  archivePath: string; // files/band-files/<uuid>.<ext>
  mimeType: string;
  size: number;
  category: string;
  visibility: string;
  createdAt: string;
  uploadedById: string | null;
  eventIds: string[];
  songIds: string[];
  equipmentIds: string[];
  locationIds: string[];
}

export interface BackupFinanceEntry {
  id: string;
  type: string;
  amountCents: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  createdAt: string;
  eventId: string | null;
  createdById: string | null;
}

export interface BackupFinanceAllocation {
  id: string;
  financeEntryId: string;
  userId: string;
  amountCents: number;
  note: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface BackupManifest {
  backupFormatVersion: number;
  appVersion: string;
  exportedAt: string;
  exportedByUserId: string;
  band: BackupBand;
  memberships: BackupMembership[];
  bandFinanceAdmins: BackupBandFinanceAdmin[];
  locations: BackupLocation[];
  equipment: BackupEquipment[];
  bandLineupRoles: BackupBandLineupRole[];
  songs: BackupSong[];
  songLinks: BackupSongLink[];
  songFiles: BackupSongFile[];
  songNotes: BackupSongNote[];
  practiceLoops: BackupPracticeLoop[];
  songVotes: BackupSongVote[];
  setlists: BackupSetlist[];
  setlistItems: BackupSetlistItem[];
  setlistNotes: BackupSetlistNote[];
  setlistItemAnnotations: BackupSetlistItemAnnotation[];
  events: BackupEvent[];
  eventParticipants: BackupEventParticipant[];
  eventLineupEntries: BackupEventLineupEntry[];
  availabilities: BackupAvailability[];
  absences: BackupAbsence[];
  rehearsalSongs: BackupRehearsalSong[];
  setlistItemEventAnnotations: BackupSetlistItemEventAnnotation[];
  setlistEventNotes: BackupSetlistEventNote[];
  setlistEventSnapshots: BackupSetlistEventSnapshot[];
  setlistEventLinks: { setlistId: string; eventId: string }[];
  packlists: BackupPacklist[];
  packlistItems: BackupPacklistItem[];
  packlistEventSnapshots: BackupPacklistEventSnapshot[];
  packlistItemEventStatuses: BackupPacklistItemEventStatus[];
  packlistEventLinks: { packlistId: string; eventId: string }[];
  bandFiles: BackupBandFile[];
  financeEntries: BackupFinanceEntry[];
  financeAllocations: BackupFinanceAllocation[];
}

export type BandBackupImportResult = {
  bandId: string;
  bandName: string;
  rowCounts: Record<string, number>;
  droppedRows: Record<string, number>;
  filesCopied: number;
  totalBytes: number;
};

/** Erlaubte Datei-Präfixe innerhalb der Zip - alles andere wird beim Import abgelehnt. */
export const BACKUP_FILE_PREFIXES = [
  "files/song-files/",
  "files/band-files/",
  "files/uploads/bands/",
  "files/uploads/songs/",
] as const;

export function slugifyBandName(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "band";
}
