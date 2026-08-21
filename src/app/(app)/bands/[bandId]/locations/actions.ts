"use server";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireMembership, canManageContent } from "@/lib/access";
import { getEnabledFeatures } from "@/lib/features";
import { getLocationSchema } from "@/lib/validation";
import { searchAddress, reverseGeocode, type GeocodeCandidate } from "@/lib/geocoding";
import { uploadBandFileAction } from "../files/actions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string } | undefined;

async function parseLocationForm(formData: FormData) {
  const t = await getTranslations("validation");
  return getLocationSchema(t).safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    latitude: formData.get("latitude") || "",
    longitude: formData.get("longitude") || "",
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    contactEmail: formData.get("contactEmail") || "",
    website: formData.get("website") || "",
    capacity: formData.get("capacity") || "",
    stageAndTechNotes: formData.get("stageAndTechNotes") || undefined,
    loadingAndParkingNotes: formData.get("loadingAndParkingNotes") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createLocationAction(
  bandId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const ta = await getTranslations("locations.actions");
  if (!getEnabledFeatures(membership.band).locations) {
    return { error: ta("disabledForBand") };
  }
  if (!canManageContent(membership.role)) {
    return { error: ta("guestsCannotCreate") };
  }

  const t = await getTranslations("validation");
  const parsed = await parseLocationForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  const d = parsed.data;

  const location = await prisma.location.create({
    data: {
      bandId,
      name: d.name,
      address: d.address || null,
      latitude: d.latitude === "" ? null : d.latitude,
      longitude: d.longitude === "" ? null : d.longitude,
      contactName: d.contactName || null,
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      website: d.website || null,
      capacity: d.capacity === "" ? null : d.capacity,
      stageAndTechNotes: d.stageAndTechNotes || null,
      loadingAndParkingNotes: d.loadingAndParkingNotes || null,
      notes: d.notes || null,
    },
  });

  revalidatePath(`/bands/${bandId}/locations`);
  redirect(`/bands/${bandId}/locations/${location.id}/edit`);
}

export async function updateLocationAction(
  bandId: string,
  locationId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const ta = await getTranslations("locations.actions");
  if (!getEnabledFeatures(membership.band).locations) {
    return { error: ta("disabledForBand") };
  }
  if (!canManageContent(membership.role)) {
    return { error: ta("guestsCannotEdit") };
  }

  const t = await getTranslations("validation");
  const parsed = await parseLocationForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  }
  const d = parsed.data;

  await prisma.location.update({
    where: { id: locationId, bandId },
    data: {
      name: d.name,
      address: d.address || null,
      latitude: d.latitude === "" ? null : d.latitude,
      longitude: d.longitude === "" ? null : d.longitude,
      contactName: d.contactName || null,
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      website: d.website || null,
      capacity: d.capacity === "" ? null : d.capacity,
      stageAndTechNotes: d.stageAndTechNotes || null,
      loadingAndParkingNotes: d.loadingAndParkingNotes || null,
      notes: d.notes || null,
    },
  });

  revalidatePath(`/bands/${bandId}/locations`);
  redirect(`/bands/${bandId}/locations/${locationId}/edit`);
}

export async function deleteLocationAction(bandId: string, locationId: string) {
  const { membership } = await requireMembership(bandId);
  if (!getEnabledFeatures(membership.band).locations) return;
  if (!canManageContent(membership.role)) return;

  await prisma.location.delete({ where: { id: locationId, bandId } });
  revalidatePath(`/bands/${bandId}/locations`);
  redirect(`/bands/${bandId}/locations`);
}

export async function uploadLocationFileAction(
  bandId: string,
  locationId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { membership } = await requireMembership(bandId);
  const ta = await getTranslations("locations.actions");
  if (!getEnabledFeatures(membership.band).locations) {
    return { error: ta("disabledForBand") };
  }
  if (!canManageContent(membership.role)) {
    return { error: ta("noPermissionToUpload") };
  }

  formData.set("locationId", locationId);
  const result = await uploadBandFileAction(bandId, prevState, formData);
  revalidatePath(`/bands/${bandId}/locations/${locationId}/edit`);
  return result;
}

/** Adresse -> Kandidatenliste zur Auswahl, für den Adress-Karten-Abgleich im Ort-Formular. */
export async function geocodeAddressAction(bandId: string, query: string): Promise<GeocodeCandidate[]> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return [];
  return searchAddress(query);
}

/** Koordinaten -> Adresse, nach Klick/Verschieben eines Punkts auf der Karte. */
export async function reverseGeocodeAction(
  bandId: string,
  latitude: number,
  longitude: number
): Promise<string | null> {
  const { membership } = await requireMembership(bandId);
  if (!canManageContent(membership.role)) return null;
  return reverseGeocode(latitude, longitude);
}
