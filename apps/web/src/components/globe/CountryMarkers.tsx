import React, { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GLOBAL_HUBS } from "@/lib/constants";
import { useWebSocket } from "@/hooks/useWebSocket";

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z] as [number, number, number];
}

function useUrgencyColor(urgency: number): [string, number] {
  // urgency: 0.0 - 1.0 map to green/yellow/red
  // Green: <= 0.4, Yellow: 0.41 - 0.7, Red: > 0.7
  let color: string;
  let pulseSpeed = 1.0;

  if (urgency > 0.7) {
    color = "#ff0055"; // Red
    pulseSpeed = 1.5 + urgency * 2;
  } else if (urgency > 0.4) {
    // Yellow: interpolate between gold and red
    const t = (urgency - 0.4) / 0.3;
    const r = Math.round(255 * t);
    const g = Math.round(255 * (1 - t));
    const b = 0;
    color = `rgb(${r},${g},${b})`;
    pulseSpeed = 1.0 + t * 0.5;
  } else {
    color = "#00ff9d"; // Green
    pulseSpeed = 1.0;
  }

  return [color, pulseSpeed];
}

function PulsingMarker({ hub, urgency, onSelectHub }: { hub: any; urgency: number; onSelectHub: (iso: string) => void }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = 2.05;
  const pos = latLngToVector3(hub.lat, hub.lng, radius);

  const [stressColor, pulseSpeed] = useUrgencyColor(urgency);

  // Scale animation based on urgency
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const elapsed = clock.getElapsedTime();
      const scale = 1 + Math.sin(elapsed * pulseSpeed) * 0.3;
      ringRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={pos} onClick={() => onSelectHub(hub.iso)}>
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={stressColor} emissive={stressColor} emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.09, 0.12, 16]} />
        <meshBasicMaterial color={stressColor} side={THREE.DoubleSide} transparent={true} opacity={0.7} />
      </mesh>
      <Html position={[0, 0.18, 0]} center>
        <button
          onClick={() => onSelectHub(hub.iso)}
          className="bg-black/90 border border-cyan-500/50 text-cyan-400 px-2 py-0.5 text-[10px] rounded uppercase font-mono tracking-wider whitespace-nowrap hover:bg-cyan-500 hover:text-black transition-colors shadow-[0_0_10px_rgba(0,240,255,0.3)]"
        >
          {hub.name} {urgency.toFixed(1)}
        </button>
      </Html>
    </group>
  );
}

// Hook to subscribe to news:classified stream for urgency scores
function useNewsUrgency(): Map<string, number> {
  const { articles } = useWebSocket();
  const [urgencyMap, setUrgencyMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!articles) return;

    // Parse incoming articles and extract urgency scores
    // Articles from WebSocket should have urgency data from the classifier
    articles.forEach((article: any) => {
      if (article.urgency !== undefined) {
        setUrgencyMap(prev => {
          const newMap = new Map(prev);
          newMap.set(article.iso_code || "USA", article.urgency);
          return newMap;
        });
      }
    });
  }, [articles]);

  return urgencyMap;
}

export function CountryMarkers({ onSelectHub }: { onSelectHub: (iso: string) => void }) {
  const urgencyMap = useNewsUrgency();

  const radius = 2.05;
  const usaPos = latLngToVector3(GLOBAL_HUBS[0].lat, GLOBAL_HUBS[0].lng, radius);
  const indPos = latLngToVector3(GLOBAL_HUBS[1].lat, GLOBAL_HUBS[1].lng, radius);
  const deuPos = latLngToVector3(GLOBAL_HUBS[2].lat, GLOBAL_HUBS[2].lng, radius);
  const jpnPos = latLngToVector3(GLOBAL_HUBS[4].lat, GLOBAL_HUBS[4].lng, radius);

  return (
    <group>
      {GLOBAL_HUBS.map((hub) => {
        const iso = hub.iso;
        const urgency = urgencyMap.get(iso) || 0.5; // default neutral urgency
        return (
          <PulsingMarker
            key={hub.iso}
            hub={hub}
            urgency={urgency}
            onSelectHub={onSelectHub}
          />
        );
      })}
      {/* Arrows/links between regions remain */}
      {/* ArcLine components would go here if needed */}
    </group>
  );
}