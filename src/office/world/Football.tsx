"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CanvasTexture, type Mesh } from "three";
import { CharacterModel } from "../characters/CharacterModel";
import { footballerLook } from "../characters/roster";
import type { Football } from "../football";

function ballTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#F7F7F2";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#1E2226";
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(10 + i * 22, i % 2 ? 18 : 46, 7, 0, Math.PI * 2);
    g.fill();
  }
  return new CanvasTexture(c);
}

export function FootballView({ game }: { game: Football }) {
  const ball = useRef<Mesh>(null);
  const tex = useMemo(() => ballTexture(), []);
  useFrame(() => {
    const b = game.ball;
    if (!ball.current) return;
    ball.current.position.set(b.x, b.y, b.z);
    ball.current.rotation.set(b.spin, Math.atan2(b.vx, b.vz), 0);
  });
  return (
    <group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
      {game.players.map((p, i) => (
        <CharacterModel key={i} puppet={p.puppet} look={footballerLook(p.team, i % 5)} labelRange={0} />
      ))}
    </group>
  );
}
