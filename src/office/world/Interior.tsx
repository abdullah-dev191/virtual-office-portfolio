"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MeshStandardMaterial, Object3D, type Texture } from "three";
import { coreStack, experienceStack } from "@/content/experience";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import type { Director } from "../director";
import { offset } from "../geom";
import { TABLE_H, furniture, seats, type Furniture, type SeatAnchor } from "../layout";
import { GeoBuilder, makeBuilders } from "./builder";
import { glassMat, glowMat, solidMat } from "./materials";
import {
  P,
  armchair,
  bookshelf,
  cabinet,
  coffeeTable,
  cooler,
  counter,
  desk,
  floorLamp,
  laptop,
  officeChair,
  plant,
  pod,
  printer,
  rack,
  reception,
  roundTable,
  sofa,
  table,
  whiteboard,
  type Builders,
} from "./props";
import { canvasTexture, fontStack, textBoard } from "./textures";

function drawFurniture(b: Builders, f: Furniture) {
  switch (f.kind) {
    case "pod":
      return pod(b, f.x, f.z);
    case "table":
      return table(b, f);
    case "roundTable":
      return roundTable(b, f);
    case "desk":
      return desk(b, f);
    case "reception":
      return reception(b, f);
    case "sofa":
      return sofa(b, f);
    case "armchair":
      return armchair(b, f);
    case "coffeeTable":
      return coffeeTable(b, f);
    case "plant":
      return plant(b, f);
    case "bookshelf":
      return bookshelf(b, f);
    case "cabinet":
      return cabinet(b, f);
    case "rack":
      return rack(b, f);
    case "whiteboard":
      return whiteboard(b, f);
    case "counter":
      return counter(b, f);
    case "printer":
      return printer(b, f);
    case "cooler":
      return cooler(b, f);
    case "lamp":
      return floorLamp(b, f);
    case "rug":
      return b.solid.flat(f.x, 0.012, f.z, f.w, f.d, f.color);
    case "posterWall":
      b.solid.block(f.x, 0, f.z, f.w, 2.3, 0.14, P.oak);
      b.solid.block(f.x, 2.3, f.z, f.w + 0.06, 0.05, 0.2, P.oakDark);
      return;
    case "screen":
      b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => b.solid.box(0, 1.65, 0, f.w + 0.1, f.h + 0.1, 0.05, P.black));
      return;
  }
}

/** Laptops on meeting tables in front of everyone sitting there, a notepad at the visitor's place. */
function tableItems(b: Builders) {
  const tables = new Set(furniture.filter((f) => f.kind === "table" || f.kind === "roundTable").map((f) => ("id" in f ? f.id : "")));
  for (const s of seats) {
    if (!s.deskId || !tables.has(s.deskId)) continue;
    const at = offset(s.position, s.facingYaw, 0.55);
    b.solid.at({ x: at[0], z: at[1], yaw: s.facingYaw }, () => {
      if (s.occupant === "npc") laptop(b, 0, 0);
      else if (s.occupant === "visitor") {
        b.solid.block(-0.05, TABLE_H, -0.02, 0.22, 0.012, 0.3, "#FAFAF5");
        b.solid.block(0.12, TABLE_H + 0.012, -0.02, 0.01, 0.008, 0.16, P.metal);
        b.solid.cyl(0.24, TABLE_H, 0.12, 0.04, 0.1, P.white, 10);
      }
    });
  }
}

const CHAIR_COLOR: Record<string, string> = {
  work: "#C98A6B",
  design: "#D9B24C",
  tech: "#3A3F44",
  meet: "#3F6C59",
  ops: "#5F83B1",
};

/** Office chairs as two instanced meshes (frame and upholstery). They slide when pulled out. */
function Chairs({ director }: { director: Director }) {
  const list = useMemo(() => seats.filter((s) => s.kind === "chair"), []);
  const frameRef = useRef<InstancedMesh>(null);
  const clothRef = useRef<InstancedMesh>(null);
  const geo = useMemo(() => {
    const frame = new GeoBuilder();
    const cloth = new GeoBuilder();
    officeChair(frame, cloth);
    return { frame: frame.build(), cloth: cloth.build() };
  }, []);
  const clothMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), []);
  const last = useRef<number[]>([]);
  const dummy = useMemo(() => new Object3D(), []);

  const place = (i: number, s: SeatAnchor, pull: number) => {
    const p = offset(s.position, s.facingYaw, -pull);
    dummy.position.set(p[0], 0, p[1]);
    dummy.rotation.set(0, s.facingYaw, 0);
    dummy.updateMatrix();
    frameRef.current?.setMatrixAt(i, dummy.matrix);
    clothRef.current?.setMatrixAt(i, dummy.matrix);
  };

  useLayoutEffect(() => {
    const c = new Color();
    list.forEach((s, i) => {
      place(i, s, 0);
      const col = s.chairColor ?? CHAIR_COLOR[s.dept] ?? (i % 2 ? P.terracotta : "#3F6C59");
      clothRef.current?.setColorAt(i, c.set(col));
      last.current[i] = 0;
    });
    if (frameRef.current) frameRef.current.instanceMatrix.needsUpdate = true;
    if (clothRef.current) {
      clothRef.current.instanceMatrix.needsUpdate = true;
      if (clothRef.current.instanceColor) clothRef.current.instanceColor.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  useFrame(() => {
    let dirty = false;
    list.forEach((s, i) => {
      const pull = director.chairs.get(s.id) ?? 0;
      if (pull !== last.current[i]) {
        last.current[i] = pull;
        place(i, s, pull);
        dirty = true;
      }
    });
    if (dirty) {
      if (frameRef.current) frameRef.current.instanceMatrix.needsUpdate = true;
      if (clothRef.current) clothRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={frameRef} args={[geo.frame, solidMat, list.length]} castShadow receiveShadow />
      <instancedMesh ref={clothRef} args={[geo.cloth, clothMat, list.length]} castShadow receiveShadow />
    </group>
  );
}

const POSTER_TONES = ["#8FB1A6", "#D6A58A", "#E1CE95", "#9FB3C9", "#A9B99B"];

function posterTexture(i: number) {
  const pr = projects[i];
  return canvasTexture(`poster:${i}`, 360, 440, (g, w, h) => {
    g.fillStyle = POSTER_TONES[i % POSTER_TONES.length];
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.arc(w * 0.72, h * 0.3, 90, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#26352F";
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = `600 22px ${fontStack("body")}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = "3px";
    g.fillText(`0${i + 1} / 05`, 28, 28);
    (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
    g.font = `500 46px ${fontStack("display")}`;
    const words = pr.name.split(" ");
    let y = h - 210;
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > w - 56 && line) {
        g.fillText(line, 28, y);
        y += 50;
        line = word;
      } else line = test;
    }
    g.fillText(line, 28, y);
    g.font = `500 21px ${fontStack("body")}`;
    g.fillText(pr.tagline, 28, h - 92);
    g.font = `600 17px ${fontStack("body")}`;
    g.fillStyle = "#2E4D41";
    g.fillText(pr.stack.toUpperCase(), 28, h - 58, w - 56);
  });
}

function PosterWall({ f, onProject }: { f: Extract<Furniture, { kind: "posterWall" }>; onProject: (i: number) => void }) {
  const n = projects.length;
  const gap = f.w / n;
  return (
    <group position={[f.x, 0, f.z + 0.075]}>
      {projects.map((_, i) => (
        <mesh
          key={i}
          position={[-f.w / 2 + gap * (i + 0.5), 1.35, 0.005]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            onProject(i);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <planeGeometry args={[1.45, 1.78]} />
          <meshStandardMaterial map={posterTexture(i)} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function screenTexture(content: Extract<Furniture, { kind: "screen" }>["content"]): Texture {
  const W = 1024;
  const H = 520;
  return canvasTexture(`screen:${content}`, W, H, (g) => {
    const bg = content === "mood" ? "#F6F3EA" : "#1F2A2D";
    const fg = content === "mood" ? "#26352F" : "#EAF3EF";
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = fg;
    g.textBaseline = "top";
    g.textAlign = "left";
    const eyebrow = (t: string, y = 48) => {
      g.font = `600 26px ${fontStack("body")}`;
      g.fillStyle = content === "mood" ? "#6E948A" : "#8FB1A6";
      (g as unknown as { letterSpacing: string }).letterSpacing = "6px";
      g.fillText(t, 60, y);
      (g as unknown as { letterSpacing: string }).letterSpacing = "0px";
      g.fillStyle = fg;
    };
    if (content === "skills") {
      eyebrow("TECH LAB · CORE STACK");
      g.font = `500 44px ${fontStack("display")}`;
      coreStack.forEach((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        g.fillStyle = ["#8FB1A6", "#E1CE95", "#D6A58A"][col];
        g.fillRect(60 + col * 320, 130 + row * 118, 10, 56);
        g.fillStyle = fg;
        g.fillText(s, 86 + col * 320, 132 + row * 118);
      });
    } else if (content === "contact") {
      eyebrow("MEETING ROOM · LET'S TALK");
      g.font = `500 64px ${fontStack("display")}`;
      g.fillText("Say hello", 60, 110);
      g.font = `500 34px ${fontStack("body")}`;
      g.fillText(profile.email, 60, 230);
      g.fillText(`${profile.phone}  ·  WhatsApp`, 60, 290);
      g.fillText("LinkedIn  ·  " + profile.location, 60, 350);
    } else if (content === "ops") {
      eyebrow("OPERATIONS · EXPERIENCE");
      g.font = `500 70px ${fontStack("display")}`;
      g.fillText(profile.company, 60, 110);
      g.font = `500 36px ${fontStack("body")}`;
      g.fillText(`${profile.role}  ·  May 2023 to present`, 60, 215);
      g.font = `600 28px ${fontStack("body")}`;
      g.fillStyle = "#8FB1A6";
      g.fillText(experienceStack.join("   ·   "), 60, 300);
    } else {
      eyebrow("DESIGN ROOM · UI KIT");
      const sw = ["#2E4D41", "#8FB1A6", "#E1CE95", "#D6A58A", "#F3F0E8"];
      sw.forEach((c, i) => {
        g.fillStyle = c;
        g.beginPath();
        g.roundRect(60 + i * 120, 120, 100, 100, 18);
        g.fill();
      });
      g.fillStyle = fg;
      g.font = `500 40px ${fontStack("display")}`;
      g.fillText("Reusable components", 60, 270);
      g.font = `500 28px ${fontStack("body")}`;
      g.fillText("Tailwind CSS  ·  Material UI  ·  Bootstrap", 60, 340);
      g.strokeStyle = "#8FB1A6";
      g.lineWidth = 4;
      g.strokeRect(700, 120, 260, 180);
      g.strokeRect(720, 140, 220, 40);
      g.strokeRect(720, 196, 100, 84);
      g.strokeRect(836, 196, 104, 84);
    }
  });
}

function Screens() {
  const list = furniture.filter((f): f is Extract<Furniture, { kind: "screen" }> => f.kind === "screen");
  return (
    <group>
      {list.map((f, i) => (
        <mesh key={i} position={[f.x + Math.sin(f.yaw) * 0.03, 1.65, f.z + Math.cos(f.yaw) * 0.03]} rotation={[0, f.yaw, 0]}>
          <planeGeometry args={[f.w, f.h]} />
          <meshBasicMaterial map={screenTexture(f.content)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Signs() {
  const rec = useMemo(() => textBoard("reception-front", 640, 120, "#8FB1A6", [{ text: "RECEPTION", size: 64, spacing: 12, color: "#FFFFFF" }]), []);
  const plate = useMemo(
    () => textBoard("boss-plate", 640, 110, "#2E4D41", [{ text: profile.name.toUpperCase(), size: 36, spacing: 4, color: "#F3F0E8" }, { text: profile.role.toUpperCase(), size: 22, spacing: 4, color: "#8FB1A6" }]),
    [],
  );
  return (
    <group>
      <mesh position={[0, 0.66, 5.0 + 0.45 + 0.05]}>
        <planeGeometry args={[2.2, 0.42]} />
        <meshStandardMaterial map={rec} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.58, -16.0 + 0.55 + 0.01]}>
        <planeGeometry args={[1.5, 0.26]} />
        <meshStandardMaterial map={plate} roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Interior({ director, onProject }: { director: Director; onProject: (i: number) => void }) {
  const geo = useMemo(() => {
    const b = makeBuilders();
    for (const f of furniture) drawFurniture(b, f);
    tableItems(b);
    return { solid: b.solid.build(), glass: b.glass.build(), glow: b.glow.build() };
  }, []);
  const posterWall = furniture.find((f): f is Extract<Furniture, { kind: "posterWall" }> => f.kind === "posterWall");
  return (
    <group>
      <mesh geometry={geo.solid} material={solidMat} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={glassMat} renderOrder={2} />
      <mesh geometry={geo.glow} material={glowMat} />
      <Chairs director={director} />
      <Screens />
      <Signs />
      {posterWall && <PosterWall f={posterWall} onProject={onProject} />}
    </group>
  );
}
