"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "./portal.css";
import type { PortalLocalMarket } from "@/lib/portal/types";

type LocationMapProps = {
  market: PortalLocalMarket;
  /** Rank of the location to highlight (list hover/focus). */
  activeRank?: number | null;
  className?: string;
};

// OpenStreetMap tiles. OSM's tile policy requires a Referer, and this page
// sets `referrer: no-referrer` (the URL is a private token), which got every
// tile a 403 "Access blocked" on the deployed preview. The tile layer below
// overrides that per request with `strict-origin`: OSM sees only the site
// origin, never the token path.
// ponytail: OSM's public tiles are for light use. Move to a keyed provider
// (MapTiler, Stadia, or Google to match VendScout) before real volume.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Real, pannable map: home pin at the ZIP centroid, numbered pins for each ranked location. */
export function LocationMap({
  market,
  activeRank,
  className,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, import("leaflet").Marker>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    const markers = markersRef.current;

    // Leaflet touches `window` at import, so it loads only in the browser.
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILE_URL, {
        attribution: ATTRIBUTION,
        maxZoom: 19,
        // Origin only, never the tokenized path.
        referrerPolicy: "strict-origin",
      }).addTo(map);

      L.marker([market.center.lat, market.center.lng], {
        icon: L.divIcon({
          className: "",
          html: '<span class="vp-pin vp-pin--home">You</span>',
          iconSize: [44, 26],
          iconAnchor: [22, 13],
        }),
        keyboard: false,
        interactive: false,
      }).addTo(map);

      for (const location of market.locations) {
        const marker = L.marker([location.lat, location.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span class="vp-pin">${location.rank}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
          title: location.name,
          alt: `${location.rank}. ${location.name}`,
        })
          .bindTooltip(`${location.rank}. ${location.name}`, {
            direction: "top",
            offset: [0, -14],
          })
          .addTo(map);
        markers.set(location.rank, marker);
      }

      const bounds = L.latLngBounds([
        [market.center.lat, market.center.lng],
        ...market.locations.map((l) => [l.lat, l.lng] as [number, number]),
      ]);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    });

    return () => {
      cancelled = true;
      markers.clear();
      map?.remove();
    };
  }, [market]);

  useEffect(() => {
    for (const [rank, marker] of markersRef.current) {
      const active = rank === activeRank;
      marker.getElement()?.classList.toggle("vp-pin-active", active);
      if (active) marker.openTooltip();
      else marker.closeTooltip();
    }
  }, [activeRank]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Map of locations near ${market.city}, ${market.state} ${market.zip}`}
      className={className}
    />
  );
}
