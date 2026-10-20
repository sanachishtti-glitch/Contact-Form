


import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Spheres() {
  const group = useRef();

  const spheres = useMemo(() => {
    return Array.from({ length: 38 }, (_, i) => {
      const seed = (n) => {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
      };

      return {
        position: [
          (seed(i + 1) - 0.5) * 23,
          (seed(i + 100) - 0.5) * 14,
          -seed(i + 200) * 10,
        ],
        radius: 0.16 + seed(i + 300) * 0.75,
        speed: 0.12 + seed(i + 400) * 0.2,
        phase: seed(i + 500) * Math.PI * 2,
        red: seed(i + 600) > 0.48,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;

    const t = clock.getElapsedTime();

    group.current.children.forEach((mesh, i) => {
      const s = spheres[i];

      mesh.position.y =
        s.position[1] +
        Math.sin(t * s.speed + s.phase) * 0.22;

      mesh.position.x =
        s.position[0] +
        Math.cos(t * s.speed * 0.6 + s.phase) * 0.12;

      mesh.rotation.y = t * s.speed * 0.35;
    });
  });

  return (
    <group ref={group}>
      {spheres.map((s, i) => (
        <mesh
          key={i}
          position={s.position}
          scale={s.radius}
        >
          <sphereGeometry args={[1, 48, 48]} />

          <meshPhysicalMaterial
            color={s.red ? "#8f0619" : "#17171d"}
            metalness={0.65}
            roughness={0.24}
            clearcoat={0.8}
            clearcoatRoughness={0.18}
            emissive={s.red ? "#43000b" : "#030306"}
            emissiveIntensity={s.red ? 0.35 : 0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#050507"]} />

      <fog attach="fog" args={["#050507", 12, 32]} />

      <ambientLight intensity={0.7} />

      <directionalLight
        position={[5, 7, 8]}
        intensity={2.5}
        color="#ffffff"
      />

      <pointLight
        position={[-6, 4, 5]}
        intensity={12}
        color="#ff102d"
        distance={22}
      />

      <pointLight
        position={[7, -3, 2]}
        intensity={8}
        color="#9b0018"
        distance={20}
      />

      <pointLight
        position={[0, 6, -4]}
        intensity={5}
        color="#ff3348"
        distance={18}
      />

      <Spheres />
    </>
  );
}

export default function Background3D() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, 0, 18],
          fov: 48,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
      >
        <Scene />
      </Canvas>

      {/* Soft red atmospheric glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse at 75% 35%,
              rgba(145, 0, 24, 0.22),
              transparent 48%
            ),
            radial-gradient(
              ellipse at 15% 80%,
              rgba(90, 0, 15, 0.18),
              transparent 42%
            ),
            linear-gradient(
              180deg,
              transparent 45%,
              rgba(0, 0, 0, 0.45)
            )
          `,
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
}
