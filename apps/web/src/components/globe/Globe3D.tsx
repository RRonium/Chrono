"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CountryMarkers } from "./CountryMarkers";

function RotatingGlobe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial color="#12121a" wireframe={true} emissive="#00f0ff" emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.15, 32, 32]} />
        <meshBasicMaterial color="#00f0ff" transparent={true} opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

export function Globe3D({ onSelectHub }: { onSelectHub: (iso: string) => void }) {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={2} />
        <RotatingGlobe />
        <CountryMarkers onSelectHub={onSelectHub} />
        <OrbitControls enableZoom={true} enablePan={false} rotateSpeed={0.6} />
      </Canvas>
    </div>
  );
}
