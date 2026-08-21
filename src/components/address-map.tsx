"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

// Deutschland-Zentrum als Startansicht, solange kein Punkt gesetzt ist.
const DEFAULT_CENTER: [number, number] = [51.1657, 10.4515];
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 15;

let defaultIconFixed = false;
/**
 * Leaflet berechnet die Marker-Bild-URLs sonst relativ zum eigenen Bundle-Pfad,
 * was unter Webpack/Next.js ins Leere läuft (Platzhalter-Icon statt Pin) - die
 * per Next-Asset-Import aufgelösten URLs müssen einmalig explizit gesetzt werden.
 */
function ensureDefaultIcon(L: typeof import("leaflet")) {
  if (defaultIconFixed) return;
  defaultIconFixed = true;
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: markerIconUrl.src,
    iconRetinaUrl: markerIconRetinaUrl.src,
    shadowUrl: markerShadowUrl.src,
  });
}

export function AddressMap({
  latitude,
  longitude,
  onPick,
  pinAlt,
  interactive = true,
  heightClassName = "h-64",
}: {
  latitude: number | null;
  longitude: number | null;
  /** Wird bei Klick auf die Karte (oder Verschieben des Markers) aufgerufen - nur relevant, wenn interactive. */
  onPick?: (lat: number, lng: number) => void;
  pinAlt: string;
  /** false = reine Anzeige (z. B. Mini-Karte im Termin) - kein Klick-zum-Setzen, Marker nicht verschiebbar. */
  interactive?: boolean;
  heightClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hält die Leaflet-Instanzen über Re-Renders hinweg - eigenständig verwaltet,
  // da Leaflet selbst DOM-Zugriff braucht und nicht React-deklarativ ist.
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      ensureDefaultIcon(L);

      const map = L.map(containerRef.current).setView(
        latitude != null && longitude != null ? [latitude, longitude] : DEFAULT_CENTER,
        latitude != null && longitude != null ? PIN_ZOOM : DEFAULT_ZOOM
      );

      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      );

      L.control.layers({ Straßenkarte: streets, Satellit: satellite }).addTo(map);

      if (interactive) {
        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          onPickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }

      if (latitude != null && longitude != null) {
        markerRef.current = L.marker([latitude, longitude], { draggable: interactive, alt: pinAlt }).addTo(map);
        if (interactive) {
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLatLng();
            onPickRef.current?.(pos.lat, pos.lng);
          });
        }
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Karte wird nur einmal initialisiert, Positions-Updates laufen über den zweiten Effekt unten.
  }, []);

  // Marker/Ansicht aktualisieren, wenn sich die Koordinaten von außen ändern
  // (z. B. nach Auswahl eines Adress-Suchtreffers), ohne die Karte neu zu erzeugen.
  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = (await import("leaflet")).default;
      ensureDefaultIcon(L);

      if (latitude == null || longitude == null) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude], { draggable: interactive, alt: pinAlt }).addTo(map);
        if (interactive) {
          markerRef.current.on("dragend", () => {
            const pos = markerRef.current!.getLatLng();
            onPickRef.current?.(pos.lat, pos.lng);
          });
        }
      }
      map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM));
    })();
  }, [latitude, longitude, pinAlt, interactive]);

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-lg border border-border`} />;
}
