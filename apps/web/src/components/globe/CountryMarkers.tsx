import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GLOBAL_HUBS, Hub } from "@/lib/constants";
import { useWebSocket } from "@/hooks/useWebSocket";

// Matches THREE.SphereGeometry's UV layout, so markers and borders line up with the earth texture.
export function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z] as [number, number, number];
}

export function vector3ToLatLng(point: THREE.Vector3) {
  const radius = point.length();
  const lat = 90 - (Math.acos(point.y / radius) * 180) / Math.PI;
  let lng = (Math.atan2(point.z, -point.x) * 180) / Math.PI - 180;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

// Urgency levels match the classifier: green <= 0.4, amber <= 0.7, red above.
function urgencyStyle(urgency: number | null): { color: string; label: string; pulse: number } {
  if (urgency === null) return { color: "#d4a64a", label: "NO SIGNAL", pulse: 0.8 };
  if (urgency > 0.7) return { color: "#ef4444", label: "CRITICAL", pulse: 3.5 };
  if (urgency > 0.4) return { color: "#f59e0b", label: "ELEVATED", pulse: 1.8 };
  return { color: "#22c55e", label: "CALM", pulse: 1.0 };
}

const URGENCY_WINDOW_MS = 6 * 60 * 60 * 1000;

// Each country's urgency is the highest score among its articles from the last 6 hours.
function useCountryUrgency(): Map<string, number> {
  const { articles } = useWebSocket();
  return useMemo(() => {
    const map = new Map<string, number>();
    const cutoff = Date.now() - URGENCY_WINDOW_MS;
    for (const article of articles) {
      if (typeof article.urgency !== "number") continue;
      const published = Date.parse(article.published_at ?? "");
      if (!isNaN(published) && published < cutoff) continue;
      const iso = article.iso_code || "USA";
      map.set(iso, Math.max(map.get(iso) ?? 0, article.urgency));
    }
    return map;
  }, [articles]);
}

function PulsingMarker({ hub, urgency, onSelectHub }: { hub: Hub; urgency: number | null; onSelectHub: (iso: string, name?: string) => void }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const pos = useMemo(() => latLngToVector3(hub.lat, hub.lng, 2.01), [hub]);
  const normal = useMemo(() => new THREE.Vector3(...pos).normalize(), [pos]);
  const { color, label, pulse } = urgencyStyle(urgency);

  useFrame(({ clock, camera }) => {
    if (ringRef.current) {
      const scale = 1 + ((Math.sin(clock.getElapsedTime() * pulse) + 1) / 2) * 0.8;
      ringRef.current.scale.set(scale, scale, scale);
    }
    // Hide the label when the marker is on the far side of the globe.
    if (labelRef.current) {
      const facing = normal.dot(camera.position.clone().normalize()) > 0.15;
      labelRef.current.style.opacity = facing ? "1" : "0";
      labelRef.current.style.pointerEvents = facing ? "auto" : "none";
    }
  });

  return (
    <group position={pos} onClick={() => onSelectHub(hub.iso, hub.name)}>
      <mesh>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ringRef} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)}>
        <ringGeometry args={[0.05, 0.065, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.75} />
      </mesh>
      <Html position={[0, 0, 0]} style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
        <div ref={labelRef} className="transition-opacity duration-300" style={{ transform: hub.labelLeft ? "translate(calc(-100% - 10px), -50%)" : "translate(10px, -50%)" }}>
          <button
            onClick={() => onSelectHub(hub.iso, hub.name)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded border bg-[#07101e]/85 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-ink backdrop-blur-sm hover:bg-[#0d1a30]"
            style={{ borderColor: `${color}80` }}
          >
            <span className="font-semibold" style={{ color }}>{hub.exchange}</span>
            <span className="text-ink-faint">{label}</span>
          </button>
        </div>
      </Html>
    </group>
  );
}

export function CountryMarkers({ onSelectHub }: { onSelectHub: (iso: string, name?: string) => void }) {
  const urgencyMap = useCountryUrgency();
  return (
    <group>
      {GLOBAL_HUBS.map((hub) => (
        <PulsingMarker key={hub.iso} hub={hub} urgency={urgencyMap.get(hub.iso) ?? null} onSelectHub={onSelectHub} />
      ))}
    </group>
  );
}
