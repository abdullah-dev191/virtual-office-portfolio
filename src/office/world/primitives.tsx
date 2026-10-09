"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

export type V3 = [number, number, number];

/** Palette lifted from the reference video: sage signage, deep green, cream floors, pale wood, terracotta. */
export const C = {
  cream: "#F3F0E8",
  floor: "#ECE9E0",
  wall: "#EFEDE6",
  wood: "#DDBB8D",
  woodDark: "#B98F5E",
  sage: "#8FB1A6",
  sageDark: "#6E948A",
  green: "#2E4D41",
  greenChair: "#3F6C59",
  terracotta: "#D38E6A",
  glass: "#CFE3E8",
  metal: "#2B2F33",
  white: "#FFFFFF",
  grass: "#B5D3A6",
  road: "#7E8B8C",
  skin: ["#E8B58E", "#C98E6A", "#8E5B3F", "#F1C7A0"],
};

type Common = {
  p?: V3;
  r?: V3;
  c?: string;
  cast?: boolean;
  receive?: boolean;
  opacity?: number;
  rough?: number;
  emissive?: string;
  ei?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  hover?: boolean;
};

function Mat({ c = "#fff", opacity, rough = 0.85, emissive, ei = 1 }: Common) {
  return (
    <meshStandardMaterial
      color={c}
      roughness={rough}
      metalness={0.02}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
      depthWrite={opacity === undefined}
      emissive={emissive}
      emissiveIntensity={emissive ? ei : 0}
    />
  );
}

function hoverProps(on?: boolean) {
  if (!on) return {};
  return {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = ""),
  };
}

export function Box({ s, p = [0, 0, 0], r = [0, 0, 0], cast = true, receive = true, onClick, hover, ...m }: Common & { s: V3 }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow={receive} onClick={onClick} {...hoverProps(hover)}>
      <boxGeometry args={s} />
      <Mat {...m} />
    </mesh>
  );
}

export function Cyl({ rad = 0.5, rad2, h = 1, seg = 18, p = [0, 0, 0], r = [0, 0, 0], cast = true, receive = true, ...m }: Common & { rad?: number; rad2?: number; h?: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow={receive}>
      <cylinderGeometry args={[rad2 ?? rad, rad, h, seg]} />
      <Mat {...m} />
    </mesh>
  );
}

export function Sph({ rad = 0.5, p = [0, 0, 0], sc = [1, 1, 1], cast = true, ...m }: Common & { rad?: number; sc?: V3 }) {
  return (
    <mesh position={p} scale={sc} castShadow={cast} receiveShadow>
      <sphereGeometry args={[rad, 18, 14]} />
      <Mat {...m} />
    </mesh>
  );
}

/** Capsule (rounded limb segment) with total length `len + 2 * rad` along its local y axis. */
export function Cap({ rad = 0.05, len = 0.3, p = [0, 0, 0], r = [0, 0, 0], sc = [1, 1, 1], cast = true, ...m }: Common & { rad?: number; len?: number; sc?: V3 }) {
  return (
    <mesh position={p} rotation={r} scale={sc} castShadow={cast} receiveShadow>
      <capsuleGeometry args={[rad, len, 6, 14]} />
      <Mat {...m} />
    </mesh>
  );
}

export function Cone({ rad = 0.5, h = 1, p = [0, 0, 0], r = [0, 0, 0], seg = 8, ...m }: Common & { rad?: number; h?: number; seg?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <coneGeometry args={[rad, h, seg]} />
      <Mat {...m} />
    </mesh>
  );
}

/** Flat floor patch. */
export function Plane({ p = [0, 0.01, 0], s, c = "#fff", map, opacity }: { p?: V3; s: [number, number]; c?: string; map?: THREE.Texture; opacity?: number }) {
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={s} />
      <meshStandardMaterial color={c} map={map} roughness={0.95} transparent={opacity !== undefined} opacity={opacity ?? 1} />
    </mesh>
  );
}

export function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Board with centred text, drawn once to a canvas. */
export function useTextTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; size?: number; font?: string; spacing?: number; align?: "center" | "left" } = {}) {
  const { w = 512, h = 128, bg = "#8FB1A6", fg = "#FFFFFF", size = 54, font = "Georgia, 'Times New Roman', serif", spacing = 3, align = "center" } = opts;
  const key = lines.join("|") + w + h + bg + fg + size;
  return useMemo(
    () =>
      makeTexture(w, h, (ctx) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = fg;
        ctx.textBaseline = "middle";
        ctx.textAlign = align;
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
        const lh = size * 1.25;
        const top = h / 2 - ((lines.length - 1) * lh) / 2;
        lines.forEach((t, i) => {
          ctx.font = `600 ${size}px ${font}`;
          ctx.fillText(t, align === "center" ? w / 2 : 28, top + i * lh);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
}

/** Framed sign: sage board with wood border. Faces +z (towards the camera). */
export function Sign({ p, text, w = 2.6, h = 0.7, size = 56 }: { p: V3; text: string; w?: number; h?: number; size?: number }) {
  const tex = useTextTexture([text], { w: Math.round(w * 200), h: Math.round(h * 200), size });
  return (
    <group position={p}>
      <Box s={[w + 0.14, h + 0.14, 0.08]} c={C.woodDark} />
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}
