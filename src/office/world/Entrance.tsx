"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group } from "three";
import { officeName, profile, siteHost } from "@/content/profile";
import type { Director } from "../director";
import { smooth } from "../geom";
import { BOOTH, CANOPY, ENTRANCE, GATE, NAME_BOARD, garden, type GardenItem } from "../layout";
import { makeBuilders, type GeoBuilder } from "./builder";
import { glassMat, glowMat, solidMat } from "./materials";
import { P } from "./props";
import { paving, textBoard } from "./textures";

const IRON = "#2E4D41";
const IRON_DARK = "#203A31";

type B = { solid: GeoBuilder; glass: GeoBuilder; glow: GeoBuilder };

export function tree(b: B, x: number, z: number, s: number, kind: "round" | "cone" = "round", y = 0) {
  b.solid.cyl(x, y, z, 0.13 * s, 1.5 * s, "#7A5A3C", 7, 0.09 * s);
  if (kind === "cone") {
    b.solid.cone(x, y + 1.0 * s, z, 1.05 * s, 2.4 * s, "#3F7A55", 8);
    b.solid.cone(x, y + 2.0 * s, z, 0.75 * s, 1.7 * s, "#4B8A5F", 8);
  } else {
    b.solid.sphere(x, y + 2.15 * s, z, 1.05 * s, 0.95 * s, 1.05 * s, "#4F8E5E", true);
    b.solid.sphere(x + 0.45 * s, y + 2.45 * s, z + 0.2 * s, 0.7 * s, 0.65 * s, 0.7 * s, "#5E9E66", true);
    b.solid.sphere(x - 0.4 * s, y + 2.35 * s, z - 0.3 * s, 0.65 * s, 0.6 * s, 0.65 * s, "#467F52", true);
  }
}

export function lampPost(b: B, x: number, z: number, h = 3.6, y = 0) {
  b.solid.cyl(x, y, z, 0.07, h, "#2B3034", 8, 0.05);
  b.solid.box(x, y + h + 0.05, z, 0.34, 0.08, 0.34, "#2B3034");
  b.glow.box(x, y + h - 0.06, z, 0.26, 0.14, 0.26, "#FFF1C9");
}

function gardenItem(b: B, g: GardenItem) {
  switch (g.kind) {
    case "tree":
      return tree(b, g.x, g.z, g.s, "round");
    case "lamp":
      return lampPost(b, g.x, g.z, 2.6);
    case "hedge":
      b.solid.block(g.x, 0, g.z, g.w, 0.7, g.d, "#3F7A55");
      b.solid.block(g.x, 0.7, g.z, g.w * 0.8, 0.08, g.d * 0.96, "#4B8A5F");
      return;
    case "flowers": {
      b.solid.block(g.x, 0, g.z, g.w, 0.16, g.d, "#6B4A32");
      const n = Math.floor(g.w / 0.35);
      for (let i = 0; i < n; i++) {
        for (const r of [-0.25, 0.25]) {
          const x = g.x - g.w / 2 + 0.2 + i * 0.35;
          b.solid.sphere(x, 0.3, g.z + r * g.d, 0.14, 0.12, 0.14, "#4B8A5F", true);
          b.solid.sphere(x + 0.05, 0.4, g.z + r * g.d + 0.03, 0.07, 0.06, 0.07, i % 3 ? g.color : "#F7F3E8", true);
        }
      }
      return;
    }
    case "bikeRack":
      for (let i = 0; i < 4; i++) {
        const x = g.x - 0.6 + i * 0.4;
        b.solid.cyl(x - 0.12, 0, g.z, 0.02, 0.7, P.chrome, 6);
        b.solid.cyl(x + 0.12, 0, g.z, 0.02, 0.7, P.chrome, 6);
        b.solid.box(x, 0.7, g.z, 0.26, 0.04, 0.04, P.chrome);
      }
      return;
    case "bench":
      bench(b, g.x, g.z, g.yaw);
      return;
  }
}

export function bench(b: B, x: number, z: number, yaw: number, y = 0) {
  b.solid.at({ x, y, z, yaw }, () => {
    for (let i = 0; i < 4; i++) b.solid.block(0, 0.4, -0.18 + i * 0.12, 1.6, 0.04, 0.09, P.oak);
    b.solid.box(0, 0.68, -0.28, 1.6, 0.32, 0.05, P.oak, { rx: -0.15 });
    for (const sx of [-0.7, 0.7]) {
      b.solid.block(sx, 0, 0, 0.06, 0.4, 0.5, "#2B3034");
      b.solid.box(sx, 0.62, -0.26, 0.06, 0.5, 0.06, "#2B3034");
    }
  });
}

function booth(b: B) {
  const { x, z, w, d, h } = BOOTH;
  b.solid.at({ x, z }, () => {
    // walls: solid lower band, glass windows above, corner posts
    b.solid.block(0, 0, 0, w, 1.0, d, "#E5E2D9");
    b.glass.block(0, 1.0, 0, w - 0.1, h - 1.2, d - 0.1, "#CFE3E8");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.solid.block((sx * (w - 0.1)) / 2, 0, (sz * (d - 0.1)) / 2, 0.12, h, 0.12, "#E5E2D9");
    b.solid.block(w / 2 - 0.06, 1.0, 0, 0.12, h - 1.2, d, "#E5E2D9");
    b.solid.block(0, h - 0.2, 0, w, 0.2, d, "#E5E2D9");
    // roof with overhang
    b.solid.block(0, h, 0, w + 0.5, 0.18, d + 0.5, IRON);
    // inside: desk and a monitor seen through the glass
    b.solid.block(-0.4, 0, 0.2, 0.8, 0.95, 1.2, P.oak);
    b.glow.box(-0.4, 1.12, 0.2, 0.04, 0.22, 0.34, "#9CC9DA");
    b.glow.box(0, h - 0.02, 0, 0.6, 0.02, 0.4, "#FFF6E3");
  });
}

function gatePosts(b: B) {
  for (const sx of [-1, 1]) {
    const x = sx * (GATE.x1 + 0.2);
    b.solid.block(x, 0, GATE.z, 0.42, 2.2, 0.42, "#F7F6F1");
    b.solid.block(x, 2.2, GATE.z, 0.5, 0.08, 0.5, "#E2DED3");
    b.solid.cyl(x, 2.28, GATE.z, 0.12, 0.08, "#2B3034", 10);
    b.glow.sphere(x, 2.48, GATE.z, 0.13, 0.15, 0.13, "#FFF1C9", true);
  }
}

function canopy(b: B) {
  const { z0, z1, x } = CANOPY;
  b.glass.block(0, 2.7, (z0 + z1) / 2, 2 * x + 0.4, 0.04, z1 - z0, "#CFE3E8");
  b.solid.block(0, 2.66, z1, 2 * x + 0.4, 0.12, 0.08, "#22262A");
  for (const sx of [-1, 1]) {
    b.solid.block(sx * x, 0, z1 - 0.1, 0.1, 2.7, 0.1, "#22262A");
    b.solid.block(sx * (x + 0.2), 2.66, (z0 + z1) / 2, 0.06, 0.12, z1 - z0, "#22262A");
  }
}

/** A gate leaf of iron bars, hinged at its post; `dir` is +1 for the west leaf, -1 for the east one. */
function GateLeaf({ director, dir }: { director: Director; dir: 1 | -1 }) {
  const ref = useRef<Group>(null);
  const len = (GATE.x1 - GATE.x0) / 2 - 0.04;
  const geo = useMemo(() => {
    const b = makeBuilders();
    b.solid.box(0, 1.8, len / 2, 0.08, 0.08, len, IRON);
    b.solid.box(0, 0.18, len / 2, 0.08, 0.08, len, IRON);
    b.solid.box(0, 1.0, len / 2, 0.06, 0.06, len, IRON);
    b.solid.box(0, 1.0, 0.04, 0.1, 1.9, 0.1, IRON_DARK);
    b.solid.box(0, 1.0, len - 0.03, 0.1, 1.9, 0.08, IRON_DARK);
    const n = Math.floor(len / 0.15);
    for (let i = 1; i < n; i++) {
      const zc = (i * len) / n;
      b.solid.box(0, 1.0, zc, 0.035, 1.72, 0.035, IRON);
      b.solid.cone(0, 1.85, zc, 0.04, 0.12, IRON, 4);
    }
    return b.solid.build();
  }, [len]);
  useFrame(() => {
    if (!ref.current) return;
    const k = smooth(director.gate.open);
    ref.current.rotation.y = dir * (Math.PI / 2 + (Math.PI / 2) * k);
  });
  return (
    <group position={[dir === 1 ? GATE.x0 : GATE.x1, 0, GATE.z]}>
      <group ref={ref}>
        <mesh geometry={geo} material={solidMat} castShadow />
      </group>
    </group>
  );
}

export function Entrance({ director }: { director: Director }) {
  const geo = useMemo(() => {
    const b = makeBuilders();
    for (const g of garden) gardenItem(b, g);
    booth(b);
    gatePosts(b);
    canopy(b);
    // posts of the name board
    for (const sx of [-1, 1]) b.solid.block(NAME_BOARD.x + sx * (NAME_BOARD.w / 2 - 0.3), 0, NAME_BOARD.z, 0.14, 2.35, 0.14, "#2B3034");
    return { solid: b.solid.build(), glass: b.glass.build(), glow: b.glow.build() };
  }, []);
  const board = useMemo(
    () =>
      textBoard(
        "name-board",
        1400,
        410,
        "#8FB1A6",
        [
          { text: officeName, size: 150, font: "display", weight: 500, spacing: 10, color: "#FFFFFF" },
          { text: (siteHost || `${profile.name} · ${profile.role}`).toUpperCase(), size: 44, spacing: 10, color: "#2E4D41", gap: 18 },
        ],
        { border: "rgba(255,255,255,0.65)" },
      ),
    [],
  );
  const security = useMemo(() => textBoard("security", 600, 120, "#2E4D41", [{ text: "SECURITY", size: 70, spacing: 14, color: "#F3F0E8" }]), []);
  const canopySign = useMemo(() => textBoard("canopy", 900, 110, "#22262A", [{ text: officeName, size: 58, spacing: 12, color: "#F3F0E8" }]), []);
  const path = useMemo(() => {
    const t = paving("#D7D2C5").clone();
    t.needsUpdate = true;
    t.repeat.set(3.6 / 1.4, 6 / 1.4);
    return t;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.008, 13.05]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.6, 5.9]} />
        <meshStandardMaterial map={path} roughness={0.95} />
      </mesh>
      <mesh geometry={geo.solid} material={solidMat} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={glassMat} renderOrder={2} />
      <mesh geometry={geo.glow} material={glowMat} />
      <GateLeaf director={director} dir={1} />
      <GateLeaf director={director} dir={-1} />
      {/* name board facing the street */}
      <group position={[NAME_BOARD.x, 1.4, NAME_BOARD.z + 0.08]}>
        <mesh position={[0, 0, -0.04]} castShadow>
          <boxGeometry args={[NAME_BOARD.w + 0.12, NAME_BOARD.h + 0.12, 0.08]} />
          <meshStandardMaterial color="#6E948A" roughness={0.6} />
        </mesh>
        <mesh>
          <planeGeometry args={[NAME_BOARD.w, NAME_BOARD.h]} />
          <meshStandardMaterial map={board} roughness={0.65} />
        </mesh>
      </group>
      {/* SECURITY sign on the booth roof edge, facing the street and the path */}
      <mesh position={[BOOTH.x, BOOTH.h + 0.1, BOOTH.z + BOOTH.d / 2 + 0.26]}>
        <planeGeometry args={[1.6, 0.3]} />
        <meshStandardMaterial map={security} roughness={0.6} />
      </mesh>
      <mesh position={[BOOTH.x - BOOTH.w / 2 - 0.26, BOOTH.h + 0.1, BOOTH.z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.6, 0.3]} />
        <meshStandardMaterial map={security} roughness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 2.67, CANOPY.z1 + 0.045]}>
        <planeGeometry args={[2 * CANOPY.x, 0.11]} />
        <meshStandardMaterial map={canopySign} roughness={0.6} />
      </mesh>
      {/* door mat */}
      <mesh position={[0, 0.012, ENTRANCE.z + 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshStandardMaterial color="#3B403C" roughness={1} />
      </mesh>
    </group>
  );
}
