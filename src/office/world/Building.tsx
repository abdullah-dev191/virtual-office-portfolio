"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, type Texture } from "three";
import type { Director } from "../director";
import { smooth, wrapAngle } from "../geom";
import { ENTRANCE, WALL_H, WALL_T, doors, walls, type Door, type Wall } from "../layout";
import { makeBuilders, type GeoBuilder } from "./builder";
import { glassMat, glowMat, solidMat } from "./materials";
import { P } from "./props";
import { textBoard, tileFloor, woodFloor } from "./textures";

const CREAM = "#EFECE4";
const FRAME = "#22262A";

/** Floor patches: [x0, z0, x1, z1, texture, tint]. */
type Patch = [number, number, number, number, "wood" | "warm" | "walnut" | "tile" | "dark", number];
const floors: Patch[] = [
  [-9, 0, 9, 10, "wood", 0.006],
  [-9, -11, 9, 0, "tile", 0.006],
  [-9, -19, -6, -11, "tile", 0.006],
  [6, -19, 9, -11, "tile", 0.006],
  [-6, -19, 6, -11, "walnut", 0.007],
  [-21, -10, -9, 0, "wood", 0.006],
  [-21, -19, -9, -10, "wood", 0.006],
  [-21, 0, -9, 10, "warm", 0.006],
  [9, 0, 21, 10, "dark", 0.006],
  [9, -10, 21, 0, "wood", 0.006],
  [9, -19, 21, -10, "tile", 0.006],
];

function floorTexture(kind: Patch[4]): Texture {
  switch (kind) {
    case "wood":
      return woodFloor("#E8DCC6");
    case "warm":
      return woodFloor("#E2C9A6");
    case "walnut":
      return woodFloor("#9C7352");
    case "dark":
      return tileFloor("#BCC3C6");
    case "tile":
      return tileFloor("#E4E6E3");
  }
}

function Floor({ p }: { p: Patch }) {
  const [x0, z0, x1, z1, kind, y] = p;
  const w = x1 - x0;
  const d = z1 - z0;
  const tex = useMemo(() => {
    const t = floorTexture(kind).clone();
    t.needsUpdate = true;
    const tile = kind === "tile" || kind === "dark" ? 1.6 : 3.2;
    t.repeat.set(w / tile, d / tile);
    return t;
  }, [kind, w, d]);
  return (
    <mesh position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
}

function wallShapes(b: { solid: GeoBuilder; glass: GeoBuilder; glow: GeoBuilder }, w: Wall) {
  const [ax, az] = w.a;
  const [bx, bz] = w.b;
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bx - ax, bz - az);
  const t = WALL_T[w.kind];
  const h = WALL_H[w.kind];
  b.solid.at({ x: (ax + bx) / 2, z: (az + bz) / 2, yaw }, () => {
    if (w.kind === "glass") {
      b.glass.box(0, h / 2 + 0.05, 0, 0.03, h - 0.1, len, "#CFE3E8");
      b.solid.box(0, h, 0, 0.07, 0.07, len, FRAME);
      b.solid.box(0, 0.05, 0, t, 0.1, len, FRAME);
      const n = Math.max(1, Math.round(len / 1.5));
      for (let i = 0; i <= n; i++) b.solid.box(0, h / 2, -len / 2 + (i * len) / n, 0.05, h, 0.04, FRAME);
      b.solid.box(0, 1.02, 0, 0.035, 0.035, len, FRAME);
    } else if (w.kind === "boundary") {
      b.solid.box(0, h / 2, 0, t, h, len, "#F7F6F1");
      b.solid.box(0, h + 0.04, 0, t + 0.08, 0.08, len + 0.02, "#E2DED3");
      const n = Math.max(1, Math.round(len / 4));
      for (let i = 0; i <= n; i++) b.solid.box(0, (h + 0.25) / 2, -len / 2 + (i * len) / n, t + 0.12, h + 0.25, 0.42, "#F7F6F1");
    } else {
      b.solid.box(0, h / 2, 0, t, h, len, CREAM);
      b.solid.box(0, h + 0.035, 0, t + 0.1, 0.07, len + 0.02, P.oak);
      b.solid.box(0, 0.06, 0, t + 0.04, 0.12, len, "#CFC8B8");
      if (w.kind === "back") {
        // tall back wall: a row of windows on the inner (south) face
        const n = Math.floor(len / 3.5);
        for (let i = 0; i < n; i++) {
          const zc = -len / 2 + (i + 0.5) * (len / n);
          b.solid.box(-t / 2 - 0.01, 1.75, zc, 0.02, 1.5, 1.9, FRAME);
          b.glow.box(-t / 2 - 0.025, 1.75, zc, 0.01, 1.38, 1.78, "#BFD8E2");
        }
      }
    }
  });
}

/** Ceiling lights hanging over the work areas (glowing panels and pendants). */
function lights(b: { solid: GeoBuilder; glass: GeoBuilder; glow: GeoBuilder }) {
  const panel = (x: number, z: number, w: number, d: number) => {
    b.solid.box(x - w / 2 + 0.1, 3.0, z, 0.01, 0.5, 0.01, FRAME);
    b.solid.box(x + w / 2 - 0.1, 3.0, z, 0.01, 0.5, 0.01, FRAME);
    b.solid.box(x, 2.74, z, w + 0.04, 0.03, d + 0.04, "#DADDD9");
    b.glow.box(x, 2.72, z, w, 0.02, d, "#FFF6E3");
  };
  const pendant = (x: number, z: number) => {
    b.solid.box(x, 3.0, z, 0.012, 0.6, 0.012, FRAME);
    b.solid.cyl(x, 2.55, z, 0.2, 0.16, P.green, 18, 0.06);
    b.glow.cyl(x, 2.53, z, 0.17, 0.02, "#FFF1D6", 18);
  };
  for (const [x, z] of [[-4.6, -2.6], [-4.6, -7.6], [4.6, -2.6], [4.6, -7.6]]) panel(x, z, 2.2, 0.32);
  for (const x of [-15.9, -14.5]) pendant(x, -5);
  for (const x of [14.4, 16.4]) pendant(x, -5);
  pendant(-15, -14.5);
  pendant(0, -15.8);
  pendant(16, -14.5);
  panel(14.8, 3.1, 2.6, 0.3);
  pendant(-1.2, 5.0);
  pendant(1.2, 5.0);
  pendant(-18.3, 5.0);
}

function DoorUnit({ d, director }: { d: Door; director: Director }) {
  const leaf = useRef<Group>(null);
  const plaque = useMemo(
    () => textBoard(`plaque:${d.id}`, 512, 112, "#2E4D41", [{ text: d.plaque, size: 46, spacing: 6, color: "#F3F0E8" }]),
    [d],
  );
  const outYaw = wrapAngle(d.inYaw + Math.PI);
  useFrame(() => {
    if (!leaf.current) return;
    const k = smooth(director.doors[d.id].open);
    leaf.current.rotation.y = d.shutYaw + wrapAngle(d.openYaw - d.shutYaw) * k;
  });
  const L = d.width - 0.04;
  return (
    <group>
      {/* frame */}
      <group position={[d.centre[0], 0, d.centre[1]]} rotation={[0, d.shutYaw, 0]}>
        <mesh position={[0, 1.1, -d.width / 2 - 0.03]} castShadow>
          <boxGeometry args={[0.16, 2.2, 0.08]} />
          <meshStandardMaterial color={P.oakDark} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.1, d.width / 2 + 0.03]} castShadow>
          <boxGeometry args={[0.16, 2.2, 0.08]} />
          <meshStandardMaterial color={P.oakDark} roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.24, 0]} castShadow>
          <boxGeometry args={[0.16, 0.1, d.width + 0.14]} />
          <meshStandardMaterial color={P.oakDark} roughness={0.7} />
        </mesh>
      </group>
      {/* name plaque above the frame, on the corridor side */}
      <mesh position={[d.centre[0] + Math.sin(outYaw) * 0.09, 2.5, d.centre[1] + Math.cos(outYaw) * 0.09]} rotation={[0, outYaw, 0]}>
        <planeGeometry args={[1.25, 0.27]} />
        <meshStandardMaterial map={plaque} roughness={0.6} />
      </mesh>
      {/* leaf: hinged at the post, swings into the room */}
      <group position={[d.hinge[0], 0, d.hinge[1]]}>
        <group ref={leaf} rotation={[0, d.shutYaw, 0]}>
          <mesh position={[0, 1.06, L / 2 + 0.02]} castShadow>
            <boxGeometry args={[0.05, 2.1, L]} />
            <meshStandardMaterial color={P.oak} roughness={0.65} />
          </mesh>
          <mesh position={[0, 1.42, L / 2 + 0.02]}>
            <boxGeometry args={[0.056, 0.9, L * 0.42]} />
            <meshStandardMaterial color="#CFE3E8" transparent opacity={0.55} roughness={0.1} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.0, L - 0.12]}>
            <boxGeometry args={[0.14, 0.04, 0.12]} />
            <meshStandardMaterial color={P.chrome} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Automatic sliding glass doors in the main entrance. */
function EntranceDoors({ director }: { director: Director }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const half = (ENTRANCE.x1 - ENTRANCE.x0) / 2;
  useFrame(() => {
    const k = smooth(director.entrance.open);
    if (left.current) left.current.position.x = -half / 2 - k * half * 0.95;
    if (right.current) right.current.position.x = half / 2 + k * half * 0.95;
  });
  return (
    <group position={[0, 0, ENTRANCE.z]}>
        <group ref={left}>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[half, 2.3, 0.04]} />
            <meshStandardMaterial color="#CFE3E8" transparent opacity={0.4} roughness={0.08} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 2.31, 0]}>
            <boxGeometry args={[half, 0.05, 0.06]} />
            <meshStandardMaterial color={FRAME} />
          </mesh>
          <mesh position={[1 * (half / 2 - 0.03), 1.15, 0]}>
            <boxGeometry args={[0.04, 2.3, 0.06]} />
            <meshStandardMaterial color={FRAME} />
          </mesh>
        </group>
        <group ref={right}>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[half, 2.3, 0.04]} />
            <meshStandardMaterial color="#CFE3E8" transparent opacity={0.4} roughness={0.08} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 2.31, 0]}>
            <boxGeometry args={[half, 0.05, 0.06]} />
            <meshStandardMaterial color={FRAME} />
          </mesh>
          <mesh position={[-1 * (half / 2 - 0.03), 1.15, 0]}>
            <boxGeometry args={[0.04, 2.3, 0.06]} />
            <meshStandardMaterial color={FRAME} />
          </mesh>
        </group>
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[ENTRANCE.x1 - ENTRANCE.x0 + 0.5, 0.25, 0.3]} />
        <meshStandardMaterial color={FRAME} />
      </mesh>
    </group>
  );
}

export function Building({ director }: { director: Director }) {
  const geo = useMemo(() => {
    const b = makeBuilders();
    for (const w of walls) wallShapes(b, w);
    lights(b);
    // entrance posts either side of the sliding doors
    for (const sx of [-1, 1]) b.solid.box(sx * (ENTRANCE.x1 + 0.12), 1.25, ENTRANCE.z, 0.24, 2.5, 0.3, CREAM);
    return { solid: b.solid.build(), glass: b.glass.build(), glow: b.glow.build() };
  }, []);
  return (
    <group>
      {floors.map((p, i) => (
        <Floor key={i} p={p} />
      ))}
      <mesh geometry={geo.solid} material={solidMat} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={glassMat} renderOrder={2} />
      <mesh geometry={geo.glow} material={glowMat} />
      {Object.values(doors).map((d) => (
        <DoorUnit key={d.id} d={d} director={director} />
      ))}
      <EntranceDoors director={director} />
    </group>
  );
}
