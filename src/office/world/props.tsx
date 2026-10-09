"use client";

import { Box, C, Cone, Cyl, Sph, type V3 } from "./primitives";

export function Desk({ p, r = [0, 0, 0], w = 1.6, d = 0.8, monitor = true }: { p: V3; r?: V3; w?: number; d?: number; monitor?: boolean }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 0.74, 0]} s={[w, 0.06, d]} c={C.wood} />
      <Box p={[-w / 2 + 0.06, 0.37, 0]} s={[0.05, 0.74, d - 0.1]} c={C.metal} />
      <Box p={[w / 2 - 0.06, 0.37, 0]} s={[0.05, 0.74, d - 0.1]} c={C.metal} />
      {monitor && (
        <group position={[0, 0.77, -0.1]}>
          <Box p={[0, 0.21, 0]} s={[0.56, 0.34, 0.04]} c="#22272B" emissive="#7FB5C9" ei={0.35} />
          <Box p={[0, 0.03, 0.02]} s={[0.1, 0.06, 0.1]} c={C.metal} />
          <Box p={[0, 0.005, 0.2]} s={[0.36, 0.015, 0.12]} c="#D9D9D6" />
        </group>
      )}
    </group>
  );
}

export function Chair({ p, r = [0, 0, 0], c = C.greenChair }: { p: V3; r?: V3; c?: string }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 0.48, 0]} s={[0.5, 0.08, 0.5]} c={c} />
      <Box p={[0, 0.78, 0.23]} s={[0.5, 0.52, 0.07]} c={c} />
      <Cyl p={[0, 0.26, 0]} rad={0.04} h={0.4} c={C.metal} seg={8} />
      <Cyl p={[0, 0.05, 0]} rad={0.26} h={0.05} c={C.metal} seg={5} />
    </group>
  );
}

export function Plant({ p, s = 1, palm = true }: { p: V3; s?: number; palm?: boolean }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.28, 0]} rad={0.3} rad2={0.24} h={0.56} c="#E9E4D8" />
      <Cyl p={[0, 0.5, 0]} rad={0.26} h={0.05} c="#5B4630" />
      {palm ? (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <group key={i} rotation={[0, a, 0]}>
                <Cone p={[0.28, 1.05, 0]} rad={0.14} h={1.1} r={[0, 0, -0.75]} c={i % 2 ? "#3F7A55" : "#2F6647"} seg={5} />
              </group>
            );
          })}
          <Cone p={[0, 1.1, 0]} rad={0.14} h={1.2} c="#3B7350" seg={5} />
        </>
      ) : (
        <Sph p={[0, 0.95, 0]} rad={0.5} c="#4B8A5F" />
      )}
    </group>
  );
}

export function Tree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 1.4, 0]} rad={0.14} rad2={0.2} h={2.8} c="#8B6B47" seg={7} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <Cone p={[0.7, 2.9, 0]} rad={0.2} h={2} r={[0, 0, -1.15]} c={i % 2 ? "#3F8A56" : "#2F7448"} seg={5} />
          </group>
        );
      })}
    </group>
  );
}

export function Sofa({ p, r = [0, 0, 0], w = 2.2, c = C.green }: { p: V3; r?: V3; w?: number; c?: string }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 0.25, 0]} s={[w, 0.5, 0.9]} c={c} />
      <Box p={[0, 0.65, 0.4]} s={[w, 0.45, 0.2]} c={c} />
      <Box p={[-w / 2 + 0.1, 0.5, 0]} s={[0.2, 0.3, 0.9]} c={c} />
      <Box p={[w / 2 - 0.1, 0.5, 0]} s={[0.2, 0.3, 0.9]} c={c} />
    </group>
  );
}

export function Cabinet({ p, r = [0, 0, 0], w = 1.2, h = 1.3, c = "#C9CBC6" }: { p: V3; r?: V3; w?: number; h?: number; c?: string }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, h / 2, 0]} s={[w, h, 0.5]} c={c} />
      {[0.25, 0.5, 0.75].map((k) => (
        <Box key={k} p={[0, h * k, 0.26]} s={[w * 0.5, 0.04, 0.02]} c={C.metal} />
      ))}
    </group>
  );
}

export function Bookshelf({ p, r = [0, 0, 0], w = 3 }: { p: V3; r?: V3; w?: number }) {
  const cols = ["#6E948A", "#D38E6A", "#E5CE8B", "#3F6C59", "#B9C7D0", "#C98A6B"];
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 1.1, 0]} s={[w, 2.2, 0.4]} c={C.woodDark} />
      {[0.4, 0.95, 1.5, 2.0].map((y, ri) => (
        <group key={y}>
          <Box p={[0, y, 0.12]} s={[w - 0.1, 0.04, 0.3]} c={C.wood} />
          {Array.from({ length: Math.floor(w / 0.22) }).map((_, i) => (
            <Box key={i} p={[-w / 2 + 0.2 + i * 0.22, y + 0.2, 0.14]} s={[0.12, 0.34 + ((i + ri) % 3) * 0.05, 0.22]} c={cols[(i * 2 + ri) % cols.length]} cast={false} />
          ))}
        </group>
      ))}
    </group>
  );
}

export function Rack({ p, r = [0, 0, 0] }: { p: V3; r?: V3 }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 1.0, 0]} s={[0.9, 2.0, 0.8]} c="#2F353A" />
      {[0.4, 0.75, 1.1, 1.45, 1.8].map((y, i) => (
        <group key={y}>
          <Box p={[0, y, 0.41]} s={[0.78, 0.16, 0.02]} c="#3C444A" />
          <Box p={[-0.25, y, 0.43]} s={[0.06, 0.05, 0.02]} c={i % 2 ? "#6BE3A0" : "#F2C14E"} emissive={i % 2 ? "#6BE3A0" : "#F2C14E"} ei={1.6} cast={false} />
          <Box p={[-0.13, y, 0.43]} s={[0.06, 0.05, 0.02]} c="#6BE3A0" emissive="#6BE3A0" ei={1.6} cast={false} />
        </group>
      ))}
    </group>
  );
}

export function Car({ p, r = [0, 0, 0], c = "#B8423C" }: { p: V3; r?: V3; c?: string }) {
  return (
    <group position={p} rotation={r}>
      <Box p={[0, 0.5, 0]} s={[1.9, 0.7, 4.2]} c={c} />
      <Box p={[0, 1.05, -0.2]} s={[1.6, 0.55, 2.2]} c="#E9ECEA" opacity={0.9} />
      {[
        [-0.95, 1.4],
        [0.95, 1.4],
        [-0.95, -1.4],
        [0.95, -1.4],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} p={[x, 0.32, z]} r={[0, 0, Math.PI / 2]} rad={0.34} h={0.26} c="#25282B" seg={12} />
      ))}
    </group>
  );
}
