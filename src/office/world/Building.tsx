"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RepeatWrapping, type Group } from "three";
import { projects } from "@/content/projects";
import { skillGroups } from "@/content/experience";
import { profile } from "@/content/profile";
import type { Director } from "../director";
import { DOOR_W, doors, walls, WALL_T, workstations, type Door, type Wall } from "../layout";
import { Person, RECEPTIONIST } from "./People";
import { Box, C, Cyl, Plane, Sign, makeTexture, useTextTexture, type V3 } from "./primitives";
import { Bookshelf, Cabinet, Chair, Desk, Plant, Rack, Sofa } from "./props";

function WallSegment({ w }: { w: Wall }) {
  const [ax, az] = w.a;
  const [bx, bz] = w.b;
  const horizontal = Math.abs(az - bz) < 0.001;
  const len = Math.hypot(bx - ax, bz - az);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const size = (h: number, t = WALL_T): V3 => (horizontal ? [len, h, t] : [t, h, len]);
  if (w.kind === "low") {
    return (
      <group position={[cx, 0, cz]}>
        <Box p={[0, 0.55, 0]} s={size(1.1)} c={C.wall} />
        <Box p={[0, 1.13, 0]} s={size(0.07, WALL_T + 0.1)} c={C.wood} />
      </group>
    );
  }
  return (
    <group position={[cx, 0, cz]}>
      <Box p={[0, 1.15, 0]} s={size(2.2, 0.04)} c={C.glass} opacity={0.22} cast={false} receive={false} />
      <Box p={[0, 2.27, 0]} s={size(0.08, 0.1)} c={C.metal} />
      <Box p={[0, 0.06, 0]} s={size(0.12, 0.12)} c={C.wood} />
    </group>
  );
}

/** Frame, threshold and swinging leaf for one doorway. The leaf angle comes from the director so it matches collisions. */
function DoorUnit({ d, director }: { d: Door; director: Director }) {
  const leaf = useRef<Group>(null);
  const horizontal = d.dir[0] !== 0;
  const L = DOOR_W - 0.06;
  const ax = (a: number, h: number, t: number): V3 => (horizontal ? [a, h, t] : [t, h, a]);
  const at = (a: number, y: number, o = 0): V3 => (horizontal ? [a, y, o] : [o, y, a]);
  useFrame(() => {
    const g = leaf.current;
    if (!g) return;
    const o = director.door[d.id].open;
    const u = Math.abs(o);
    g.rotation.y = d.swing * Math.sign(o) * u * u * (3 - 2 * u);
  });
  const half = DOOR_W / 2 + 0.05;
  return (
    <group>
      <group position={[d.c[0], 0, d.c[1]]}>
        <Box p={at(-half, 1.1)} s={ax(0.1, 2.2, 0.16)} c={C.woodDark} />
        <Box p={at(half, 1.1)} s={ax(0.1, 2.2, 0.16)} c={C.woodDark} />
        <Box p={at(0, 2.2)} s={ax(DOOR_W + 0.2, 0.16, 0.16)} c={C.woodDark} />
        <Box p={at(0, 0.01)} s={ax(DOOR_W, 0.02, 0.26)} c={C.metal} />
      </group>
      <group position={[d.hinge[0], 0, d.hinge[1]]}>
        <group ref={leaf}>
          <Box p={at(L / 2 + 0.03, 1.04)} s={ax(L, 2.08, 0.05)} c={C.wood} />
          <Box p={at(L / 2 + 0.03, 1.5)} s={ax(L * 0.5, 0.95, 0.07)} c={C.glass} opacity={0.5} cast={false} />
          <Box p={at(L / 2 + 0.03, 0.12)} s={ax(L - 0.1, 0.2, 0.07)} c={C.woodDark} />
          <Box p={at(L - 0.12, 1.0)} s={ax(0.14, 0.04, 0.14)} c={C.metal} />
        </group>
      </group>
    </group>
  );
}

function BladeSign({ x, z, text, w = 1.9 }: { x: number; z: number; text: string; w?: number }) {
  return (
    <group position={[x, 2.75, z]}>
      <Box p={[0, 0.45, 0]} s={[0.04, 0.5, 0.04]} c={C.metal} />
      <Sign p={[0, 0, 0]} text={text} w={w} h={0.5} size={34} />
    </group>
  );
}

function Poster({ i, onProject }: { i: number; onProject: (i: number) => void }) {
  const pr = projects[i];
  const tones = ["#8FB1A6", "#D6A58A", "#E1CE95", "#9FB3C9", "#A9B99B"];
  const tex = useTextTexture([...pr.name.toUpperCase().replace("TOTAL PARTY PLANNER", "PARTY PLANNER").replace("CONCORD SEMINAR", "CONCORD\nSEMINAR").replace("INVOICE MAKER", "INVOICE\nMAKER").split("\n"), "", pr.stack.split(", ")[0]], { w: 280, h: 340, bg: tones[i % tones.length], fg: "#26352F", size: 30, spacing: 0 });
  return (
    <group position={[-16.1 + i * 1.8, 1.55, -6.1]}>
      <Box s={[1.5, 1.8, 0.04]} c={C.white} />
      <mesh position={[0, 0, 0.025]} onClick={() => onProject(i)} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <planeGeometry args={[1.38, 1.68]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}

function WorkStudio({ onProject }: { onProject: (i: number) => void }) {
  return (
    <group>
      <Box p={[-12.5, 1.3, -6.3]} s={[9.6, 2.5, 0.2]} c={C.wood} />
      {projects.map((_, i) => (
        <Poster key={i} i={i} onProject={onProject} />
      ))}
      {[-14.4, -11.2].map((x) => (
        <group key={x}>
          <Desk p={[x, 0.05, -2.7]} w={2} d={1} />
          <Chair p={[x, 0, -1.5]} c={C.terracotta} />
        </group>
      ))}
      <Cabinet p={[-17.4, 0, -0.5]} r={[0, Math.PI / 2, 0]} w={2} />
      <Plant p={[-17, 0, 1.2]} s={1.1} />
      <Plant p={[-8.2, 0, -5.4]} s={0.9} />
      <BladeSign x={-6.1} z={-2} text="WORK STUDIO" />
    </group>
  );
}

function TechLab() {
  const lines = useMemo(() => skillGroups.flatMap((g) => [g.title.toUpperCase(), g.items.slice(0, 4).join(" · ")]), []);
  const tex = useTextTexture(["TOOLKIT", ...lines.slice(0, 6)], { w: 560, h: 360, bg: "#FAFAF7", fg: "#26352F", size: 26, spacing: 1, align: "left" });
  return (
    <group>
      {[9.2, 10.3, 11.4, 12.5, 13.6, 14.7].map((x) => (
        <Rack key={x} p={[x, 0, -5.9]} />
      ))}
      <Box p={[12, 0.78, -0.9]} s={[4, 0.08, 1]} c={C.wood} />
      <Box p={[10.1, 0.39, -0.9]} s={[0.08, 0.78, 0.9]} c={C.metal} />
      <Box p={[13.9, 0.39, -0.9]} s={[0.08, 0.78, 0.9]} c={C.metal} />
      <Box p={[11, 0.95, -0.9]} s={[0.5, 0.3, 0.04]} c="#22272B" emissive="#7FB5C9" ei={0.4} />
      <Box p={[13, 0.95, -0.9]} s={[0.5, 0.3, 0.04]} c="#22272B" emissive="#9AD4A5" ei={0.4} />
      <Chair p={[11, 0, 0.5]} c={C.terracotta} />
      <group position={[15.6, 0, -3.4]}>
        <Box p={[0, 1.55, 0]} s={[2.9, 1.9, 0.08]} c={C.metal} />
        <mesh position={[0, 1.55, 0.05]}>
          <planeGeometry args={[2.78, 1.78]} />
          <meshStandardMaterial map={tex} roughness={0.9} />
        </mesh>
        <Box p={[-1.2, 0.5, 0]} s={[0.06, 1, 0.06]} c={C.metal} />
        <Box p={[1.2, 0.5, 0]} s={[0.06, 1, 0.06]} c={C.metal} />
      </group>
      <Plant p={[17, 0, 1.2]} s={1.1} />
      <Plant p={[8, 0, 1.1]} s={0.9} palm={false} />
      <BladeSign x={6.1} z={-2} text="TECH LAB" />
    </group>
  );
}

function Operations() {
  const tex = useTextTexture([profile.company.toUpperCase(), profile.role, "MAY 2023 TO PRESENT", "", "REACT · NEXT.JS · REACT NATIVE", "NODE.JS · NESTJS"], { w: 760, h: 300, bg: "#F6F3EA", fg: "#26352F", size: 30, spacing: 2 });
  return (
    <group>
      <group position={[-12.8, 0, -15.2]}>
        <Box p={[0, 1.4, 0]} s={[6.4, 2.2, 0.1]} c={C.woodDark} />
        <mesh position={[0, 1.4, 0.06]}>
          <planeGeometry args={[6.2, 2]} />
          <meshStandardMaterial map={tex} roughness={0.9} />
        </mesh>
      </group>
      <Desk p={[-12.9, 0.05, -11]} r={[0, Math.PI, 0]} w={3} d={1.2} />
      <Chair p={[-12.9, 0, -12.1]} r={[0, Math.PI, 0]} c={C.greenChair} />
      <Cabinet p={[-17.5, 0, -9]} r={[0, Math.PI / 2, 0]} w={1.6} />
      <Cabinet p={[-17.5, 0, -10.8]} r={[0, Math.PI / 2, 0]} w={1.6} />
      <Plant p={[-8.1, 0, -14.7]} s={1} />
      <BladeSign x={-6.1} z={-11} text="OPERATIONS" />
    </group>
  );
}

function MeetingRoom() {
  const tex = useTextTexture(["LET'S TALK", "", profile.email, profile.phone], { w: 760, h: 320, bg: "#1F2A2D", fg: "#EAF3EF", size: 34, spacing: 2 });
  return (
    <group>
      <group position={[12, 0, -15.3]}>
        <Box p={[0, 1.6, 0]} s={[6.4, 2.2, 0.1]} c={C.metal} />
        <mesh position={[0, 1.6, 0.06]}>
          <planeGeometry args={[6.2, 2]} />
          <meshStandardMaterial map={tex} roughness={0.6} emissive="#3E5B57" emissiveIntensity={0.35} />
        </mesh>
      </group>
      <Box p={[12.5, 0.74, -11]} s={[4.8, 0.08, 2]} c={C.wood} />
      <Box p={[12.5, 0.37, -11]} s={[0.4, 0.74, 1.2]} c={C.metal} />
      {[-1.7, -0.6, 0.6, 1.7].map((dx) => (
        <group key={dx}>
          <Chair p={[12.5 + dx, 0, -12.3]} r={[0, Math.PI, 0]} c={C.greenChair} />
          <Chair p={[12.5 + dx, 0, -9.7]} c={C.terracotta} />
        </group>
      ))}
      <Plant p={[17, 0, -7.4]} s={1.1} />
      <Plant p={[17, 0, -14.8]} s={1} palm={false} />
      <BladeSign x={6.1} z={-11} text="MEETING ROOM" w={2.2} />
    </group>
  );
}

function BossCabin() {
  const plate = useTextTexture([profile.name.toUpperCase(), profile.role.toUpperCase()], { w: 640, h: 120, bg: "#2E4D41", fg: "#F3F0E8", size: 34, spacing: 3 });
  return (
    <group>
      <Box p={[0, 0.01, -12.6]} s={[7, 0.02, 5]} c="#3C6154" cast={false} />
      <Desk p={[0, 0.05, -13.9]} r={[0, Math.PI, 0]} w={4} d={1.4} />
      <Chair p={[0, 0, -14.9]} r={[0, Math.PI, 0]} c="#3A3F44" />
      <Person position={[0, 0, -14.9]} yaw={0} seated typing shirt="#F2F0EA" pants="#2B3238" skin={C.skin[1]} hair="#1A1614" sleeves="short" label={profile.name.toUpperCase()} />
      <mesh position={[0, 0.93, -13.15]}>
        <planeGeometry args={[1.5, 0.28]} />
        <meshStandardMaterial map={plate} roughness={0.8} />
      </mesh>
      <Bookshelf p={[-2.5, 0, -15.7]} w={3.4} />
      <Bookshelf p={[2.5, 0, -15.7]} w={3.4} />
      <Sofa p={[-4.2, 0, -11]} r={[0, -Math.PI / 2, 0]} w={2} />
      <Plant p={[4.2, 0, -9.9]} s={1.2} />
      <Plant p={[4.2, 0, -14.4]} s={1} palm={false} />
      <BladeSign x={0} z={-9} text="BOSS CABIN" />
    </group>
  );
}

function Lobby({ director }: { director: Director }) {
  const tex = useTextTexture(["RECEPTION"], { w: 420, h: 100, bg: "#8FB1A6", size: 38 });
  const sign = useTextTexture(["ABDULLAH OFFICE"], { w: 1000, h: 180, bg: "#8FB1A6", size: 82, spacing: 6 });
  const floor = useMemo(() => {
    const t = makeTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = "#EEEBE2";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(160,140,110,0.18)";
        ctx.lineWidth = 2;
        for (let x = 0; x <= w; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
    });
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(9, 6.5);
    return t;
  }, []);
  return (
    <group>
      <Plane p={[0, 0.005, -3]} s={[36, 26]} c="#FFFFFF" map={floor} />
      <Plane p={[0, 0.012, -3.5]} s={[2.6, 25]} c="#E0DBCD" />
      <Plane p={[0, 0.013, 7.6]} s={[6.6, 3.4]} c="#86A99D" />
      {/* reception desk */}
      <Box p={[0, 0.5, 5.3]} s={[5.2, 1.0, 1.1]} c="#F1EDE3" />
      <Box p={[0, 1.04, 5.3]} s={[5.4, 0.08, 1.3]} c={C.wood} />
      {Array.from({ length: 14 }).map((_, i) => (
        <Box key={i} p={[-2.4 + i * 0.37, 0.5, 5.9]} s={[0.12, 0.9, 0.06]} c={C.wood} cast={false} />
      ))}
      <mesh position={[0, 0.62, 5.95]}>
        <planeGeometry args={[2.1, 0.5]} />
        <meshStandardMaterial map={tex} />
      </mesh>
      <Box p={[0.9, 1.3, 5.1]} s={[0.55, 0.36, 0.04]} c="#22272B" emissive="#7FB5C9" ei={0.3} />
      <Chair p={[0, 0, 4.2]} r={[0, Math.PI, 0]} c="#2D5C8F" />
      <Person position={[0, 0, 4.2]} yaw={0} seated typing {...RECEPTIONIST} label="RECEPTIONIST" hideWhen={() => director.guide.active} />
      {/* lobby seating */}
      <Sofa p={[-10, 0, 6]} r={[0, -Math.PI / 2, 0]} w={2.6} c="#4F7C6C" />
      <Sofa p={[10, 0, 6]} r={[0, Math.PI / 2, 0]} w={2.6} c="#4F7C6C" />
      <Cyl p={[-8.4, 0.3, 6]} rad={0.6} h={0.06} c={C.wood} />
      <Cyl p={[8.4, 0.3, 6]} rad={0.6} h={0.06} c={C.wood} />
      <Plant p={[-16.5, 0, 8.6]} s={1.3} />
      <Plant p={[16.5, 0, 8.6]} s={1.3} />
      <Plant p={[-4.6, 0, 7.4]} s={1.1} />
      <Plant p={[4.6, 0, 7.4]} s={1.1} palm={false} />
      {/* office name boards on the street-facing wall */}
      <group position={[-9, 0.72, 10.14]}>
        <Box s={[5.4, 0.98, 0.06]} c={C.woodDark} />
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[5.25, 0.85]} />
          <meshStandardMaterial map={sign} />
        </mesh>
      </group>
      <group position={[9, 0.72, 10.14]}>
        <Box s={[5.4, 0.98, 0.06]} c={C.woodDark} />
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[5.25, 0.85]} />
          <meshStandardMaterial map={sign} />
        </mesh>
      </group>
    </group>
  );
}

function OpenOffice() {
  return (
    <group>
      {workstations.map((w, i) => (
        <group key={i}>
          <Desk p={[w.x, 0.05, w.z]} />
          <Chair p={[w.x, 0, w.z + 0.95]} c={i % 2 ? C.terracotta : C.greenChair} />
          {w.seated && (
            <Person
              position={[w.x, 0, w.z + 0.95]}
              yaw={Math.PI}
              seated
              typing
              shirt={w.shirt}
              pants="#33414F"
              skin={C.skin[i % 4]}
              hair={["#201B18", "#4A3426", "#15110F", "#6B4A32"][i % 4]}
              female={i % 3 === 1}
              hairStyle={i % 3 === 1 ? (i % 2 ? "bun" : "long") : i % 4 === 2 ? "buzz" : "short"}
              sleeves={i % 2 ? "short" : "long"}
            />
          )}
        </group>
      ))}
      <Plant p={[-6.4, 0, 2.9]} s={1.1} />
      <Plant p={[6.4, 0, 2.9]} s={1.1} palm={false} />
    </group>
  );
}

export function Building({ director, onProject }: { director: Director; onProject: (i: number) => void }) {
  return (
    <group>
      <Lobby director={director} />
      {walls.map((w, i) => (
        <WallSegment key={i} w={w} />
      ))}
      {/* room floors */}
      <Plane p={[-12.5, 0.012, -2.25]} s={[11, 8.5]} c="#DCE8E2" />
      <Plane p={[12.5, 0.012, -2.25]} s={[11, 8.5]} c="#DEE5EC" />
      <Plane p={[-12.5, 0.012, -11.25]} s={[11, 9.5]} c="#EBE3D3" />
      <Plane p={[12.5, 0.012, -11.25]} s={[11, 9.5]} c="#DCE8E2" />
      <Plane p={[0, 0.012, -12.5]} s={[10, 7]} c="#D6BC93" />
      <OpenOffice />
      <WorkStudio onProject={onProject} />
      <TechLab />
      <Operations />
      <MeetingRoom />
      <BossCabin />
      {Object.values(doors).map((d) => (
        <DoorUnit key={d.id} d={d} director={director} />
      ))}
    </group>
  );
}
