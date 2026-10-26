"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CountryMarkers, latLngToVector3, vector3ToLatLng } from "./CountryMarkers";
import { BASE_PATH, GLOBAL_HUBS } from "@/lib/constants";

const EARTH_RADIUS = 2;

type CountryFeature = {
  properties: { name: string; iso: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: any };
};

function polygonsOf(feature: CountryFeature): number[][][][] {
  return feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

// Ray-casting point-in-polygon test on [lng, lat] rings (first ring is the outline, the rest are holes).
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function findCountry(features: CountryFeature[], lat: number, lng: number): CountryFeature | null {
  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      if (pointInRing(lng, lat, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(lng, lat, hole))) {
        return feature;
      }
    }
  }
  return null;
}

function bordersGeometry(features: CountryFeature[], radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length - 1; i++) {
          positions.push(...latLngToVector3(ring[i][1], ring[i][0], radius));
          positions.push(...latLngToVector3(ring[i + 1][1], ring[i + 1][0], radius));
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

const atmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
      gl_FragColor = vec4(0.35, 0.6, 1.0, 1.0) * intensity;
    }`,
};

function Earth({
  features,
  hovered,
  onHover,
  onSelect,
}: {
  features: CountryFeature[];
  hovered: CountryFeature | null;
  onHover: (feature: CountryFeature | null, x: number, y: number) => void;
  onSelect: (feature: CountryFeature) => void;
}) {
  const [dayMap, bumpMap] = useLoader(THREE.TextureLoader, [`${BASE_PATH}/img/earth-day.jpg`, `${BASE_PATH}/img/earth-bump.png`]);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.anisotropy = 8;

  const borders = useMemo(() => bordersGeometry(features, EARTH_RADIUS * 1.001), [features]);
  const highlight = useMemo(
    () => (hovered ? bordersGeometry([hovered], EARTH_RADIUS * 1.002) : null),
    [hovered],
  );

  const countryAt = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const { lat, lng } = vector3ToLatLng(event.point);
    return findCountry(features, lat, lng);
  };

  return (
    <group>
      <mesh
        onPointerMove={(e) => onHover(countryAt(e), e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
        onPointerOut={() => onHover(null, 0, 0)}
        onClick={(e) => {
          const country = countryAt(e);
          if (country) onSelect(country);
        }}
      >
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshPhongMaterial map={dayMap} bumpMap={bumpMap} bumpScale={0.04} shininess={12} specular={new THREE.Color("#1a2a40")} />
      </mesh>
      <lineSegments geometry={borders}>
        <lineBasicMaterial color="#f3e2b3" transparent opacity={0.35} />
      </lineSegments>
      {highlight && (
        <lineSegments geometry={highlight}>
          <lineBasicMaterial color="#ffd36b" />
        </lineSegments>
      )}
      <mesh scale={1.15}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <shaderMaterial
          args={[atmosphereShader]}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function Globe3D({ onSelectHub }: { onSelectHub: (iso: string, name?: string) => void }) {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [hovered, setHovered] = useState<CountryFeature | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const hubIsos = useRef(new Set(GLOBAL_HUBS.map((hub) => hub.iso)));

  useEffect(() => {
    fetch(`${BASE_PATH}/data/countries.geojson`)
      .then((res) => res.json())
      .then((data) => setFeatures(data.features ?? []))
      .catch(() => setFeatures([]));
  }, []);

  // Start the camera over the Indian Ocean so India, Europe and East Asia are in view.
  const cameraStart = useMemo(() => latLngToVector3(22, 60, 6), []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: "radial-gradient(ellipse at center, #0b1a33 0%, #050a14 70%)", cursor: hovered ? "pointer" : "grab" }}
    >
      <Canvas camera={{ position: cameraStart, fov: 45 }}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[6, 3, 5]} intensity={1.6} />
        <Suspense fallback={null}>
          <Earth
            features={features}
            hovered={hovered}
            onHover={(feature, x, y) => {
              setHovered(feature);
              setCursor({ x, y });
            }}
            onSelect={(feature) => onSelectHub(feature.properties.iso, feature.properties.name)}
          />
        </Suspense>
        <CountryMarkers onSelectHub={onSelectHub} />
        <OrbitControls
          enablePan={false}
          minDistance={2.8}
          maxDistance={9}
          rotateSpeed={0.5}
          autoRotate={!hovered}
          autoRotateSpeed={0.35}
        />
      </Canvas>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-gold/40 bg-[#07101e]/95 px-2.5 py-1.5 font-mono text-[11px] text-ink shadow-lg"
          style={{ left: cursor.x + 14, top: cursor.y + 14 }}
        >
          <div className="font-semibold text-gold-soft">{hovered.properties.name}</div>
          <div className="text-ink-faint">
            {hovered.properties.iso}
            {hubIsos.current.has(hovered.properties.iso) ? " · tracked market" : ""} · click for brief
          </div>
        </div>
      )}
    </div>
  );
}
