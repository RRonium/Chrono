import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GLOBAL_HUBS } from "@/lib/constants";

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z] as [number, number, number];
}

function PulsingMarker({ hub, onSelectHub }: { hub: any; onSelectHub: (iso: string) => void }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = 2.05;
  const pos = latLngToVector3(hub.lat, hub.lng, radius);

  const stressColor = hub.iso === "USA" ? "#ff0055" : hub.iso === "IND" ? "#00ff9d" : "#ffd700";

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.3;
      ringRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={pos}>
      <mesh onClick={() => onSelectHub(hub.iso)}>
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
          {hub.name}
        </button>
      </Html>
    </group>
  );
}

function ArcLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...start),
    new THREE.Vector3((start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 1.2, (start[2] + end[2]) / 2),
    new THREE.Vector3(...end)
  );
  const points = curve.getPoints(50);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: "#00f0ff", transparent: true, opacity: 0.3, linewidth: 2 });
  const lineObj = new THREE.Line(geometry, material);

  return <primitive object={lineObj} />;
}

export function CountryMarkers({ onSelectHub }: { onSelectHub: (iso: string) => void }) {
  const radius = 2.05;
  const usaPos = latLngToVector3(GLOBAL_HUBS[0].lat, GLOBAL_HUBS[0].lng, radius);
  const indPos = latLngToVector3(GLOBAL_HUBS[1].lat, GLOBAL_HUBS[1].lng, radius);
  const deuPos = latLngToVector3(GLOBAL_HUBS[2].lat, GLOBAL_HUBS[2].lng, radius);
  const jpnPos = latLngToVector3(GLOBAL_HUBS[4].lat, GLOBAL_HUBS[4].lng, radius);

  return (
    <group>
      {GLOBAL_HUBS.map((hub) => (
        <PulsingMarker key={hub.iso} hub={hub} onSelectHub={onSelectHub} />
      ))}
      <ArcLine start={usaPos} end={indPos} />
      <ArcLine start={indPos} end={jpnPos} />
      <ArcLine start={usaPos} end={deuPos} />
    </group>
  );
}
