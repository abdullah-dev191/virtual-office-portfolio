"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Object3D, type DirectionalLight } from "three";
import type { Director } from "../director";
import { Building } from "./Building";
import { Outdoor } from "./Outdoor";
import { Person, RECEPTIONIST } from "./People";

function Rig({ director }: { director: Director }) {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const look = useRef({ x: 0, z: 22 });

  useFrame((state, dt) => {
    director.update(dt);
    const p = director.player;
    const k = Math.min(1, dt * 4);
    look.current.x += (p.x - look.current.x) * k;
    look.current.z += (p.z - look.current.z) * k;
    const { x, z } = look.current;
    const aspect = state.size.width / state.size.height;
    const s = aspect < 1 ? 1 + (1 - aspect) * 0.95 : 1;
    state.camera.position.set(x, 15 * s, z + 11.5 * s);
    state.camera.lookAt(x, 0.6, z + 2.6);
    if (light.current) {
      light.current.position.set(x + 9, 22, z + 8);
      target.position.set(x, 0, z);
      target.updateMatrixWorld();
    }
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      />
    </>
  );
}

type Props = {
  director: Director;
  onProject: (i: number) => void;
  playerBubble: string | null;
  guideBubble: string | null;
};

export default function Scene({ director, onProject, playerBubble, guideBubble }: Props) {
  useEffect(() => {
    const map: Record<string, keyof Director["keys"]> = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const set = (v: boolean) => (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      if ((e.target as HTMLElement | null)?.closest("input,textarea")) return;
      director.setKey(k, v);
      if (v) e.preventDefault();
    };
    const dn = set(true);
    const up = set(false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [director]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (director.busy) return;
    director.moveTo(e.point.x, e.point.z);
  };

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 36, near: 0.5, far: 200, position: [0, 15, 33.5] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-label="Interactive 3D office. Use the menu or click to walk."
    >
      <color attach="background" args={["#DDEBE3"]} />
      <fog attach="fog" args={["#DDEBE3", 55, 110]} />
      <hemisphereLight args={["#FFFFFF", "#B9C8B0", 1.0]} />
      <ambientLight intensity={0.55} />
      <Rig director={director} />
      <Outdoor director={director} />
      <Building director={director} onProject={onProject} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} onClick={click}>
        <planeGeometry args={[160, 160]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Person actor={director.guide} label={guideBubble ? undefined : "RECEPTIONIST"} bubble={guideBubble} {...RECEPTIONIST} />
      <Person actor={director.player} label="YOU" tone="you" bubble={playerBubble} shirt="#2E4D41" pants="#2B3A55" skin="#C98E6A" hair="#1C1A19" sleeves="short" />
    </Canvas>
  );
}
