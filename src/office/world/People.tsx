"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import type { Actor } from "../director";
import { Box, C, Cap, Cyl, Sph, type V3 } from "./primitives";

export type Look = {
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  /** Tailored jacket in the `pants` colour over the `shirt` colour, with a tie on men. */
  suit?: boolean;
  female?: boolean;
  hairStyle?: "short" | "buzz" | "long" | "bun";
  sleeves?: "long" | "short";
};

/** The receptionist keeps one look whether she sits at the desk or walks you round. */
export const RECEPTIONIST: Look = { female: true, suit: true, shirt: "#F2F0EA", pants: "#2F3E57", skin: C.skin[0], hair: "#2B1D16", hairStyle: "bun" };

type Props = Look & {
  actor?: Actor;
  position?: V3;
  yaw?: number;
  seated?: boolean;
  typing?: boolean;
  label?: string;
  tone?: "you" | "role";
  bubble?: string | null;
  /** Hide when the actor is not on stage. */
  hideWhen?: () => boolean;
};

const HIP_STAND = 0.92;
const HIP_SEAT = 0.59;
/** Metres travelled per half walking cycle (one footfall), so feet stay planted. */
const STEP = 0.78;
const SHOE = "#1F1D1C";

const tmp = new Vector3();
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Person built from rounded limb segments. Forward is local +z. Driven by an Actor (player, guide) or placed statically. */
export function Person({
  actor,
  position = [0, 0, 0],
  yaw = 0,
  seated = false,
  typing = false,
  label,
  tone = "role",
  bubble,
  shirt = "#5F8FC4",
  pants = "#2B3A55",
  skin = C.skin[0],
  hair = "#1C1A19",
  suit = false,
  female = false,
  hairStyle = female ? "long" : "short",
  sleeves = "long",
  hideWhen,
}: Props) {
  const root = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const th = useRef<(Group | null)[]>([null, null]);
  const kn = useRef<(Group | null)[]>([null, null]);
  const sh = useRef<(Group | null)[]>([null, null]);
  const el = useRef<(Group | null)[]>([null, null]);
  const tag = useRef<HTMLDivElement | null>(null);
  const gl = useThree((st) => st.gl);
  const text = bubble ?? label ?? null;
  const seed = useRef((position[0] * 7.3 + position[2] * 3.1 + 6) % 6);
  const ph = useRef(0);
  const amp = useRef(0);
  const reach = useRef(0);
  const last = useRef<[number, number]>(actor ? [actor.x, actor.z] : [0, 0]);

  // Name tag / speech bubble: a plain DOM element projected onto the person (no nested React root).
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!text || !host) return;
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:12;white-space:nowrap;display:none";
    const pill = document.createElement("div");
    pill.className = bubble ? "pill bubble" : tone === "you" ? "pill you" : "pill role";
    pill.textContent = text;
    el.appendChild(pill);
    host.appendChild(el);
    tag.current = el;
    return () => {
      el.remove();
      tag.current = null;
    };
  }, [gl, text, bubble, tone]);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const vis = hideWhen ? !hideWhen() : actor ? actor.active : true;
    g.visible = vis;
    const lab = tag.current;
    if (lab) {
      if (!vis) lab.style.display = "none";
      else {
        const top = 1.95 * (female ? 0.95 : 1) + (actor || !seated ? 0 : -0.3);
        if (actor) tmp.set(actor.x, top, actor.z);
        else {
          g.getWorldPosition(tmp);
          tmp.y = top;
        }
        tmp.project(state.camera);
        const x = (tmp.x * 0.5 + 0.5) * state.size.width;
        const y = (-tmp.y * 0.5 + 0.5) * state.size.height;
        lab.style.display = tmp.z < 1 ? "" : "none";
        lab.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      }
    }
    if (!vis) return;
    const t = state.clock.elapsedTime + seed.current;
    let moving = false;
    let reaching = false;
    if (actor) {
      g.position.set(actor.x, 0, actor.z);
      g.rotation.y = actor.yaw;
      const moved = Math.min(0.25, Math.hypot(actor.x - last.current[0], actor.z - last.current[1]));
      last.current = [actor.x, actor.z];
      moving = actor.moving;
      reaching = actor.reach > 0;
      if (moving) ph.current += (moved / STEP) * Math.PI;
    }
    amp.current += ((moving ? 1 : 0) - amp.current) * Math.min(1, dt * 8);
    reach.current += ((reaching ? 1 : 0) - reach.current) * Math.min(1, dt * 9);
    const a = amp.current;
    const r = reach.current;
    const p = ph.current;
    const s = Math.sin(p) * a;
    const c = Math.cos(p) * a;
    const [thL, thR] = th.current;
    const [knL, knR] = kn.current;
    const [shL, shR] = sh.current;
    const [elL, elR] = el.current;
    const h = hips.current;
    const tor = torso.current;
    const hd = head.current;
    if (!h || !tor || !hd || !thL || !thR || !knL || !knR || !shL || !shR || !elL || !elR) return;

    if (seated) {
      h.position.set(0, HIP_SEAT, 0);
      h.rotation.y = 0;
      thL.rotation.x = thR.rotation.x = -1.32;
      knL.rotation.x = knR.rotation.x = 1.2;
      tor.rotation.set(0.08, 0, 0);
      tor.scale.y = 1 + Math.sin(t * 1.7) * 0.006;
      hd.rotation.set(0.12 + Math.sin(t * 0.6) * 0.02, Math.sin(t * 0.4) * 0.1, 0);
      const k = typing ? Math.sin(t * 9) * 0.03 : 0;
      const k2 = typing ? Math.sin(t * 8 + 2) * 0.03 : 0;
      shL.rotation.set(-0.4 + k, 0, -0.06);
      shR.rotation.set(-0.4 + k2, 0, 0.06);
      elL.rotation.x = -1.05 + (typing ? Math.sin(t * 11) * 0.05 : 0);
      elR.rotation.x = -1.05 + (typing ? Math.sin(t * 10 + 1) * 0.05 : 0);
      return;
    }

    thL.rotation.x = s * 0.5;
    thR.rotation.x = -s * 0.5;
    knL.rotation.x = Math.max(0, -c) * 0.9 + 0.03;
    knR.rotation.x = Math.max(0, c) * 0.9 + 0.03;
    h.position.set(Math.sin(p) * 0.012 * a, HIP_STAND - 0.02 * a * Math.abs(Math.sin(p)), 0);
    h.rotation.y = -Math.sin(p) * 0.07 * a;
    tor.rotation.set(0.05 * a + Math.sin(t * 1.4) * 0.004, Math.sin(p) * 0.13 * a, Math.sin(p) * 0.02 * a);
    tor.scale.y = 1 + Math.sin(t * 1.7) * 0.008;
    hd.rotation.set(-0.03 * a, -Math.sin(p) * 0.08 * a + Math.sin(t * 0.5) * 0.08 * (1 - a), 0);
    const sway = Math.sin(t * 1.1) * 0.02 * (1 - a);
    shL.rotation.set(-s * 0.55 + sway, 0, -0.07);
    elL.rotation.x = -(0.14 + 0.55 * Math.max(0, s));
    shR.rotation.set(lerp(s * 0.55 - sway, -0.95, r), 0, 0.07);
    elR.rotation.x = lerp(-(0.14 + 0.55 * Math.max(0, -s)), -0.5 + Math.sin(t * 20) * 0.07, r);
  });

  const top = suit ? pants : shirt;
  const chest = female ? 0.15 : 0.175;
  const waist = female ? 0.12 : 0.15;
  const armX = female ? 0.2 : 0.235;
  const bare = sleeves === "short" && !suit ? skin : top;

  return (
    <group ref={root} position={position} rotation={[0, yaw, 0]} scale={female ? 0.95 : 1}>
      <group ref={hips} position={[0, seated ? HIP_SEAT : HIP_STAND, 0]}>
        <Cap rad={female ? 0.09 : 0.085} len={female ? 0.2 : 0.16} r={[0, 0, Math.PI / 2]} c={pants} />
        {[-1, 1].map((sx, i) => (
          <group
            key={sx}
            ref={(e) => {
              th.current[i] = e;
            }}
            position={[sx * 0.095, -0.02, 0]}
          >
            <Cap rad={0.074} len={0.29} p={[0, -0.22, 0]} c={pants} />
            <group
              ref={(e) => {
                kn.current[i] = e;
              }}
              position={[0, -0.44, 0]}
            >
              <Cap rad={0.057} len={0.29} p={[0, -0.2, 0]} c={pants} />
              <Cap rad={0.045} len={0.14} r={[Math.PI / 2, 0, 0]} sc={[1, 0.85, 1]} p={[0, -0.425, 0.06]} c={SHOE} />
            </group>
          </group>
        ))}

        <group ref={torso} position={[0, 0.06, 0]}>
          <group scale={[1, 1, female ? 0.6 : 0.64]}>
            <Cyl rad={waist} rad2={chest} h={0.5} p={[0, 0.22, 0]} c={top} seg={24} />
          </group>
          {suit && <Box p={[0, 0.27, chest * (female ? 0.6 : 0.64) - 0.004]} s={[0.1, 0.36, 0.02]} c={shirt} />}
          {suit && !female && <Box p={[0, 0.25, chest * 0.64 + 0.006]} s={[0.035, 0.28, 0.012]} c="#7A2E34" />}
          <Cap rad={0.062} len={female ? 0.22 : 0.29} r={[0, 0, Math.PI / 2]} p={[0, 0.45, 0]} c={top} />
          <Cyl rad={0.045} h={0.11} p={[0, 0.53, 0]} c={skin} seg={14} />
          {suit && <Box p={[0, 0.5, 0.0]} s={[0.12, 0.03, 0.08]} c={shirt} />}

          {[-1, 1].map((sx, i) => (
            <group
              key={sx}
              ref={(e) => {
                sh.current[i] = e;
              }}
              position={[sx * armX, 0.44, 0]}
            >
              <Sph rad={0.058} c={top} />
              <Cap rad={0.047} len={0.22} p={[0, -0.16, 0]} c={top} />
              <group
                ref={(e) => {
                  el.current[i] = e;
                }}
                position={[0, -0.32, 0]}
              >
                <Cap rad={0.04} len={0.2} p={[0, -0.14, 0]} c={bare} />
                <Sph rad={0.04} p={[0, -0.31, 0.005]} sc={[0.85, 1.25, 0.65]} c={skin} />
              </group>
            </group>
          ))}

          <group ref={head} position={[0, 0.66, 0]}>
            <Sph rad={0.1} sc={[0.9, 1.1, 1]} c={skin} />
            <Sph rad={0.02} p={[-0.094, -0.005, 0]} sc={[0.5, 1, 0.8]} c={skin} />
            <Sph rad={0.02} p={[0.094, -0.005, 0]} sc={[0.5, 1, 0.8]} c={skin} />
            <Sph rad={0.016} p={[0, -0.012, 0.104]} sc={[1, 1.2, 1.2]} c={skin} />
            <Sph rad={0.012} p={[-0.037, 0.012, 0.089]} c="#1B1614" cast={false} />
            <Sph rad={0.012} p={[0.037, 0.012, 0.089]} c="#1B1614" cast={false} />
            <Box p={[-0.038, 0.04, 0.088]} r={[0, 0, 0.12]} s={[0.045, 0.009, 0.012]} c={hair} cast={false} />
            <Box p={[0.038, 0.04, 0.088]} r={[0, 0, -0.12]} s={[0.045, 0.009, 0.012]} c={hair} cast={false} />
            <Box p={[0, -0.046, 0.091]} s={[0.04, 0.008, 0.01]} c={female ? "#B5615C" : "#9A5A52"} cast={false} />
            <mesh position={[0, 0.005, -0.002]} rotation={[-0.45, 0, 0]} scale={hairStyle === "buzz" ? [0.85, 1.04, 0.94] : [0.88, 1.07, 0.97]} castShadow>
              <sphereGeometry args={[0.112, 24, 18, 0, Math.PI * 2, 0, 1.45]} />
              <meshStandardMaterial color={hair} roughness={0.9} />
            </mesh>
            {hairStyle === "long" && <Sph rad={0.1} p={[0, -0.09, -0.065]} sc={[0.95, 1.55, 0.6]} c={hair} />}
            {hairStyle === "bun" && <Sph rad={0.05} p={[0, 0.1, -0.08]} c={hair} />}
          </group>
        </group>
      </group>
    </group>
  );
}
