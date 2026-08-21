/**
 * Geocoding über Nominatim (OpenStreetMap) - folgt der in song-metadata-lookup.ts
 * etablierten Konvention: nie werfen, bei Fehler/Netzwerkausfall still
 * degradieren. Anders als dort aber kein Pflicht-Umgebungsvariable, da
 * Adress-/Kartenabgleich kein optionales Bonusfeature, sondern Kernstück der
 * Orte-Funktion ist - standardmäßig aktiv gegen die öffentliche Instanz, per
 * NOMINATIM_BASE_URL auf eine eigene Instanz umstellbar.
 */

function baseUrl() {
  return (process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
}

const USER_AGENT = "Bandplaner/1.0 (+https://github.com/maxxs78/bandplaner)";

export type GeocodeCandidate = {
  displayName: string;
  latitude: number;
  longitude: number;
};

/** Adresse -> bis zu 5 Kandidaten zur Auswahl (Freitext ist oft mehrdeutig). */
export async function searchAddress(query: string): Promise<GeocodeCandidate[]> {
  if (!query.trim()) return [];
  try {
    const url = `${baseUrl()}/search?q=${encodeURIComponent(query.trim())}&format=jsonv2&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return data.map((r) => ({
      displayName: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }));
  } catch {
    return [];
  }
}

/** Koordinaten -> Adresse (z. B. nach Klick/Verschieben eines Punkts auf der Karte). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `${baseUrl()}/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
