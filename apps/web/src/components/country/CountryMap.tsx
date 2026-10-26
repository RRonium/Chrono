"use client";

import React, { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair } from "lucide-react";
import type { CountryBoundary } from "@/lib/countries/types";

type LatLng = [number, number];

const BASEMAPS = {
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 18,
  },
  streets: {
    label: "Streets",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    labels: null,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
    maxZoom: 19,
  },
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    labels: null,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>",
    maxZoom: 19,
  },
} as const;

type BasemapId = keyof typeof BASEMAPS;

function ringBounds(ring: number[][]) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of ring) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return { w, s, e, n, area: (e - w) * (n - s) };
}

function shiftPolygon(polygon: number[][][], by: number) {
  return by ? polygon.map((ring) => ring.map(([lng, lat]) => [lng + by, lat])) : polygon;
}

// Natural Earth cuts countries at ±180°. For countries that straddle it (Russia, Fiji, the USA's
// Aleutians) move the smaller side across so the country is drawn and framed in one piece.
function unwrapAntimeridian(polygons: number[][][][]): number[][][][] {
  const span = (list: number[][][][]) => {
    const all = list.map((p) => ringBounds(p[0]));
    return Math.max(...all.map((b) => b.e)) - Math.min(...all.map((b) => b.w));
  };
  if (span(polygons) < 180) return polygons;
  const east = polygons.map((p) => (ringBounds(p[0]).e < 0 ? shiftPolygon(p, 360) : p));
  const west = polygons.map((p) => (ringBounds(p[0]).w > 0 ? shiftPolygon(p, -360) : p));
  const best = span(east) <= span(west) ? east : west;
  return span(best) < span(polygons) ? best : polygons;
}

// Frame the main landmass and what is near it, so France fits mainland France rather than
// every overseas department. The rest stays outlined and reachable by panning.
function frameBounds(polygons: number[][][][]): [LatLng, LatLng] {
  const boxes = polygons.map((p) => ringBounds(p[0]));
  const main = boxes.reduce((a, b) => (b.area > a.area ? b : a));
  const reach = Math.max(10, 1.5 * Math.hypot(main.e - main.w, main.n - main.s));
  const cx = (main.w + main.e) / 2;
  const cy = (main.s + main.n) / 2;
  const near = boxes.filter(
    (b) => b.area >= main.area * 0.2 || Math.hypot((b.w + b.e) / 2 - cx, (b.s + b.n) / 2 - cy) <= reach,
  );
  return [
    [Math.min(...near.map((b) => b.s)), Math.min(...near.map((b) => b.w))],
    [Math.max(...near.map((b) => b.n)), Math.max(...near.map((b) => b.e))],
  ];
}

const toLatLngs = (ring: number[][]): LatLng[] => ring.map(([lng, lat]) => [lat, lng]);

export function CountryMap({ boundary, center, name }: { boundary: CountryBoundary | null; center: LatLng | null; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layersRef = useRef<Leaflet.Layer[]>([]);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const frameRef = useRef<() => void>(() => {});
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [ready, setReady] = useState(false);

  // Create the map once; Leaflet touches `window`, so it is loaded on the client only.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        worldCopyJump: false,
        minZoom: 2,
        zoomSnap: 0.25,
        attributionControl: true,
      });
      L.control.zoom({ position: "topright" }).addTo(map);
      map.attributionControl.setPrefix(false);
      // Place names sit above the dimming mask so neighbouring cities stay readable.
      const labelPane = map.createPane("labels");
      labelPane.style.zIndex = "450";
      labelPane.style.pointerEvents = "none";

      const polygons = boundary ? unwrapAntimeridian(boundary.geometry.coordinates) : [];
      if (polygons.length) {
        // Dim everything outside the country with a world-sized polygon that has the country as holes.
        const world: LatLng[] = [[-85, -540], [85, -540], [85, 540], [-85, 540]];
        L.polygon([world, ...polygons.map((p) => toLatLngs(p[0]))], {
          stroke: false,
          fillColor: "#050a14",
          fillOpacity: 0.55,
          interactive: false,
        }).addTo(map);
        L.polygon(polygons.map((p) => p.map(toLatLngs)), {
          color: "#ffd36b",
          weight: 2,
          opacity: 0.95,
          fillColor: "#d4a64a",
          fillOpacity: 0.04,
          interactive: false,
        }).addTo(map);
        const bounds = frameBounds(polygons);
        frameRef.current = () => map.fitBounds(bounds, { padding: [24, 24], animate: true });
        map.fitBounds(bounds, { padding: [24, 24] });
      } else {
        const fallback: LatLng = center ?? [20, 0];
        frameRef.current = () => map.setView(fallback, center ? 7 : 2);
        map.setView(fallback, center ? 7 : 2);
        if (center) {
          L.circleMarker(fallback, { radius: 7, color: "#ffd36b", weight: 2, fillColor: "#d4a64a", fillOpacity: 0.6 })
            .bindTooltip(name)
            .addTo(map);
        }
      }

      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      mapRef.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [boundary, center, name]);

  // Swap the tile layers when the basemap changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    layersRef.current.forEach((layer) => layer.remove());
    const style = BASEMAPS[basemap];
    const tiles = [L.tileLayer(style.url, { attribution: style.attribution, maxZoom: style.maxZoom })];
    if (style.labels) tiles.push(L.tileLayer(style.labels, { maxZoom: style.maxZoom, pane: "labels" }));
    tiles.forEach((layer) => layer.addTo(map));
    tiles[0].bringToBack();
    layersRef.current = tiles;
  }, [basemap, ready]);

  return (
    <div className="absolute inset-0 country-map">
      <div ref={containerRef} className="absolute inset-0 bg-[#0b1a33]" aria-label={`Map of ${name}`} role="region" />
      <div className="absolute top-4 left-4 z-[500] pointer-events-none">
        <div className="font-display text-xs tracking-[0.2em] text-gold/90 drop-shadow">{name.toUpperCase()}</div>
      </div>
      <div className="absolute bottom-6 left-4 z-[500] flex items-center gap-1 rounded border border-white/10 bg-black/60 p-1 font-mono text-[10px] backdrop-blur-sm">
        {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
          <button
            key={id}
            onClick={() => setBasemap(id)}
            aria-pressed={basemap === id}
            className={`px-2 py-0.5 rounded border ${basemap === id ? "border-gold text-gold bg-gold/10" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {BASEMAPS[id].label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button onClick={() => frameRef.current()} className="flex items-center gap-1 px-2 py-0.5 text-ink-muted hover:text-gold" title="Fit the country">
          <Crosshair className="h-3 w-3" /> Fit
        </button>
      </div>
    </div>
  );
}
