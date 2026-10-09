"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Director } from "../director";
import { Box, C, Cyl, Plane } from "./primitives";
import { Car, Plant, Tree } from "./props";
import { Person } from "./People";

function GateLeaf({ director, side }: { director: Director; side: -1 | 1 }) {
  const g = useRef<Group>(null);
  const open = useRef(0);
  useFrame((_, dt) => {
    open.current += ((director.gateOpen ? 1 : 0) - open.current) * Math.min(1, dt * 2.4);
    // Left leaf (side -1) swings north with a positive angle, right leaf with a negative one.
    if (g.current) g.current.rotation.y = -side * open.current * 1.55;
  });
  const x = side * 2;
  return (
    <group ref={g} position={[x, 0, 10]}>
      <group position={[-side * 1, 0, 0]}>
        <Box p={[0, 1.0, 0]} s={[2, 1.7, 0.08]} c={C.metal} opacity={0.35} cast={false} />
        <Box p={[0, 1.8, 0]} s={[2, 0.08, 0.1]} c={C.metal} />
        <Box p={[0, 0.2, 0]} s={[2, 0.08, 0.1]} c={C.metal} />
        {[-0.8, -0.4, 0, 0.4, 0.8].map((b) => (
          <Box key={b} p={[b, 1.0, 0]} s={[0.05, 1.7, 0.06]} c={C.metal} />
        ))}
      </group>
    </group>
  );
}

function SecurityBooth() {
  return (
    <group position={[5, 0, 12.4]}>
      <Box p={[0, 1.2, 0]} s={[2, 2.4, 2]} c="#E5E2D9" />
      <Box p={[0, 2.5, 0]} s={[2.4, 0.2, 2.4]} c={C.green} />
      <Box p={[0, 1.5, 1.01]} s={[1.5, 0.9, 0.04]} c={C.glass} opacity={0.55} cast={false} />
      <Box p={[0, 0.6, 1.2]} s={[1.5, 0.12, 0.5]} c={C.wood} />
    </group>
  );
}

function Road() {
  return (
    <group>
      <Plane p={[0, 0.015, 33]} s={[90, 7]} c={C.road} />
      {[-36, -28, -20, -12, -4, 4, 12, 20, 28, 36].map((x) => (
        <Plane key={x} p={[x, 0.02, 33]} s={[3, 0.16]} c="#F2EFE4" />
      ))}
      <Car p={[-14, 0, 34.4]} r={[0, Math.PI / 2, 0]} c="#B8423C" />
      <Car p={[16, 0, 31.6]} r={[0, -Math.PI / 2, 0]} c="#3E6E8C" />
      <Car p={[-24, 0, 31.6]} r={[0, -Math.PI / 2, 0]} c="#E0B94F" />
    </group>
  );
}

export function Outdoor({ director }: { director: Director }) {
  return (
    <group>
      <Plane p={[0, -0.01, 0]} s={[140, 140]} c={C.grass} />
      {/* paved plaza in front of the gate */}
      <Plane p={[0, 0.008, 17]} s={[44, 14]} c="#DAD6CA" />
      <Plane p={[0, 0.012, 15]} s={[4.4, 12]} c="#CBC6B8" />
      {/* paved pad around the building */}
      <Plane p={[0, 0.006, -3]} s={[42, 36]} c="#D7D3C6" />
      <Road />
      <SecurityBooth />
      {/* guard posted at the main gate, facing visitors as they arrive */}
      <Person position={[2.9, 0, 11.1]} yaw={-0.55} label="SECURITY" shirt="#E8EAEC" pants="#1E2A3E" suit hairStyle="buzz" />
      <GateLeaf director={director} side={-1} />
      <GateLeaf director={director} side={1} />
      <Box p={[-2.15, 1.0, 10]} s={[0.3, 2.0, 0.3]} c={C.green} />
      <Box p={[2.15, 1.0, 10]} s={[0.3, 2.0, 0.3]} c={C.green} />
      {[-14, -9, 9, 14].map((x) => (
        <Plant key={x} p={[x, 0, 11.4]} s={1.1} palm={x > 0} />
      ))}
      {[-26, -21, 21, 26, -30, 30].map((x, i) => (
        <Tree key={x} p={[x, 0, 14 + (i % 3) * 2]} s={1.1 + (i % 2) * 0.2} />
      ))}
      {[-26, -24, 24, 26, -28, 28].map((x, i) => (
        <Tree key={`s${x}`} p={[x, 0, -6 - i * 2]} s={1.2} />
      ))}
      {[-8, -4, 4, 8].map((x) => (
        <Cyl key={x} p={[x, 0.45, 20]} rad={0.5} rad2={0.5} h={0.9} c={C.sage} seg={12} />
      ))}
    </group>
  );
}
