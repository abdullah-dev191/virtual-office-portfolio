"use client";

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, type Texture } from "three";
import {
  MAP,
  PAVEMENT_W,
  PITCH,
  PITCH_FENCE,
  POND,
  ROAD_DROP,
  benches,
  blocks,
  bollards,
  buildings,
  crossings,
  junctionRect,
  junctions,
  lamps,
  parkedCars,
  roads,
  trees,
  type CityBuilding,
  type Road,
} from "../city";
import { TAU, inRect, type Rect } from "../geom";
import { PLOT } from "../layout";
import { CAR_COLORS, type CarShape } from "../traffic";
import { GeoBuilder, makeBuilders } from "./builder";
import { bench, lampPost, tree } from "./Entrance";
import { glassMat, glowMat, solidMat } from "./materials";
import { facade, grass, paving } from "./textures";
import { carParts } from "./vehicles";

/** Flat surfaces with world-scaled UVs, so one repeating texture covers many rectangles. */
class Surface {
  private pos: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];
  constructor(private tile: number) {}
  quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) {
      this.pos.push(...p);
      this.uv.push(p[0] / this.tile, -p[2] / this.tile);
    }
    this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  rect([x0, z0, x1, z1]: Rect, y: number) {
    if (x1 <= x0 || z1 <= z0) return;
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
  }
  /** Ellipse ring (or disc when inner = 0). */
  ring(cx: number, cz: number, rx: number, rz: number, inner: number, y: number, n = 64) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      const o0: [number, number, number] = [cx + Math.cos(a0) * rx, y, cz + Math.sin(a0) * rz];
      const o1: [number, number, number] = [cx + Math.cos(a1) * rx, y, cz + Math.sin(a1) * rz];
      const i0: [number, number, number] = [cx + Math.cos(a0) * (rx - inner), y, cz + Math.sin(a0) * (rz - inner)];
      const i1: [number, number, number] = [cx + Math.cos(a1) * (rx - inner), y, cz + Math.sin(a1) * (rz - inner)];
      // wound counter-clockwise seen from above
      if (inner >= Math.min(rx, rz)) this.quad([cx, y, cz], o0, o1, [cx, y, cz]);
      else this.quad(i0, o0, o1, i1);
    }
  }
  build() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    const n = new Float32Array(this.pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute("normal", new BufferAttribute(n, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------- ground

function ground() {
  const pave = new Surface(1.4);
  const lawn = new Surface(4);
  const plaza = new Surface(2.2);
  const slabs = new GeoBuilder();
  for (const bl of blocks) {
    const [x0, z0, x1, z1] = bl.rect;
    // the raised block, its sides are the kerbs
    slabs.box((x0 + x1) / 2, -ROAD_DROP / 2, (z0 + z1) / 2, x1 - x0, ROAD_DROP, z1 - z0, "#CFCBC0");
    const p = PAVEMENT_W;
    const inner: Rect = [x0 + p, z0 + p, x1 - p, z1 - p];
    const edge = x0 <= MAP[0] || x1 >= MAP[2] || z0 <= MAP[1] || z1 >= MAP[3];
    // pavements on sides that face a road
    pave.rect([x0, z0, x1, z0 + p], 0.002);
    pave.rect([x0, z1 - p, x1, z1], 0.002);
    pave.rect([x0, z0 + p, x0 + p, z1 - p], 0.002);
    pave.rect([x1 - p, z0 + p, x1, z1 - p], 0.002);
    if (bl.kind === "office") {
      // grass inside the boundary wall, the building floor covers the middle
      lawn.rect([PLOT[0], PLOT[1], PLOT[2], PLOT[3]], 0.003);
      pave.rect([inner[0], inner[1], PLOT[0], inner[3]], 0.002);
      pave.rect([PLOT[2], inner[1], inner[2], inner[3]], 0.002);
      pave.rect([PLOT[0], inner[1], PLOT[2], PLOT[1]], 0.002);
      pave.rect([PLOT[0], PLOT[3], PLOT[2], inner[3]], 0.002);
    } else if (bl.kind === "park" || bl.kind === "green" || edge) lawn.rect(inner, 0.003);
    else plaza.rect(inner, 0.003);
  }
  return { pave: pave.build(), lawn: lawn.build(), plaza: plaza.build(), slabs: slabs.build() };
}

// ---------------------------------------------------------------- road markings

const WHITE = "#F2F1EA";
const LINE_Y = -ROAD_DROP + 0.006;

function skipZones(): Rect[] {
  return [...junctions.map(junctionRect), ...crossings.map((c) => c.rect)];
}

function dashedAlong(b: GeoBuilder, r: Road, offsetFromCentre: number, dash: number, gap: number, width: number) {
  const zones = skipZones();
  const [x0, z0, x1, z1] = r.rect;
  const len = r.axis === "x" ? x1 - x0 : z1 - z0;
  const start = r.axis === "x" ? x0 : z0;
  for (let s = 0; s < len; s += dash + gap) {
    const m = start + s + dash / 2;
    const x = r.axis === "x" ? m : r.centre + offsetFromCentre;
    const z = r.axis === "x" ? r.centre + offsetFromCentre : m;
    if (zones.some((q) => inRect(x, z, q, dash / 2))) continue;
    if (r.axis === "x") b.flat(x, LINE_Y, z, dash, width, WHITE);
    else b.flat(x, LINE_Y, z, width, dash, WHITE);
  }
}

function markings() {
  const b = new GeoBuilder();
  for (const r of roads) {
    dashedAlong(b, r, 0, 3, 3, 0.14);
    dashedAlong(b, r, 3.1, 1.0, 0.0001, 0.12);
    dashedAlong(b, r, -3.1, 1.0, 0.0001, 0.12);
  }
  // zebra crossings: bars parallel to the kerb, stepping across the road
  for (const c of crossings) {
    const [x0, z0, x1, z1] = c.rect;
    if (c.axis === "x") {
      for (let z = z0 + 0.5; z < z1 - 0.2; z += 1.0) b.flat((x0 + x1) / 2, LINE_Y + 0.001, z, x1 - x0, 0.5, WHITE);
      // stop lines two metres before the stripes, one per lane (keep left: eastbound uses the north lane)
      b.flat(x0 - 2.2, LINE_Y, (z0 + (z0 + z1) / 2) / 2, 0.35, (z1 - z0) / 2 - 0.3, WHITE);
      b.flat(x1 + 2.2, LINE_Y, ((z0 + z1) / 2 + z1) / 2, 0.35, (z1 - z0) / 2 - 0.3, WHITE);
    } else {
      for (let x = x0 + 0.5; x < x1 - 0.2; x += 1.0) b.flat(x, LINE_Y + 0.001, (z0 + z1) / 2, 0.5, z1 - z0, WHITE);
      b.flat((x0 + (x0 + x1) / 2) / 2, LINE_Y, z1 + 2.2, (x1 - x0) / 2 - 0.3, 0.35, WHITE);
      b.flat(((x0 + x1) / 2 + x1) / 2, LINE_Y, z0 - 2.2, (x1 - x0) / 2 - 0.3, 0.35, WHITE);
    }
  }
  return b.build();
}

// ---------------------------------------------------------------- buildings

const FLOOR_H = 3.3;
const BAY = 4;

/** Walls with UVs in floors and bays, so the facade texture tiles one window bay per square. */
function facadeWalls(list: CityBuilding[], from: number, to: number) {
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const bd of list) {
    const top = Math.min(bd.h, to);
    if (top <= from) continue;
    const x0 = bd.x - bd.w / 2;
    const x1 = bd.x + bd.w / 2;
    const z0 = bd.z - bd.d / 2;
    const z1 = bd.z + bd.d / 2;
    const sides: [number, number, number, number, number, number][] = [
      [x0, z1, x1, z1, 0, 1],
      [x1, z1, x1, z0, 1, 0],
      [x1, z0, x0, z0, 0, -1],
      [x0, z0, x0, z1, -1, 0],
    ];
    for (const [ax, az, bx, bz, nx, nz] of sides) {
      const len = Math.hypot(bx - ax, bz - az);
      const base = pos.length / 3;
      const u1 = Math.max(1, Math.round(len / BAY));
      pos.push(ax, from, az, bx, from, bz, bx, top, bz, ax, top, az);
      for (let k = 0; k < 4; k++) nrm.push(nx, 0, nz);
      uv.push(0, from / FLOOR_H, u1, from / FLOOR_H, u1, top / FLOOR_H, 0, top / FLOOR_H);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function roofs(b: GeoBuilder) {
  for (const bd of buildings) {
    const { x, z, w, d, h } = bd;
    b.box(x, h + 0.05, z, w, 0.1, d, bd.style === "glass" ? "#3A4A54" : "#8C8A84");
    // parapet
    for (const [px, pz, sx, sz] of [
      [x, z - d / 2, w, 0.3],
      [x, z + d / 2, w, 0.3],
      [x - w / 2, z, 0.3, d],
      [x + w / 2, z, 0.3, d],
    ]) b.block(px, h, pz, sx, 0.6, sz, bd.style === "glass" ? "#2E3B44" : "#B9B5AC");
    // rooftop details: plant room, AC units, a water tank
    b.block(x - w * 0.2, h, z - d * 0.15, w * 0.22, 2.2, d * 0.2, "#A9A59C");
    for (let i = 0; i < 3; i++) b.block(x + w * 0.18 + i * 1.3, h, z + d * 0.2, 1.0, 0.8, 1.0, "#D7D5CF");
    b.cyl(x + w * 0.25, h, z - d * 0.25, 1.0, 1.6, "#5F6B70", 14);
    b.cyl(x + w * 0.25, h + 1.6, z - d * 0.25, 1.05, 0.25, "#4A5459", 14, 0.4);
    // entrance canopy at street level
    b.block(x, 3.2, z + d / 2 + 0.7, Math.min(6, w * 0.4), 0.15, 1.4, "#2E4D41");
  }
}

// ---------------------------------------------------------------- park and pitch

function park(b: ReturnType<typeof makeBuilders>, paths: Surface) {
  // pond: stone rim, water drawn separately
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    b.solid.sphere(POND.x + Math.cos(a) * (POND.rx + 0.1), 0.04, POND.z + Math.sin(a) * (POND.rz + 0.1), 0.32, 0.12, 0.26, i % 2 ? "#B9B4A7" : "#A8A397", true);
  }
  for (const [ax, az, s] of [[-15.5, 44, 1.0], [-11, 46.2, 0.7]] as [number, number, number][]) b.solid.sphere(ax, 0.02, az, 0.5 * s, 0.08, 0.35 * s, "#5E9E66", true);
  paths.ring(POND.x, POND.z, POND.rx + 3.7, POND.rz + 3.5, 2.0, 0.004);
  paths.rect([POND.x - 1.0, 29, POND.x + 1.0, POND.z - POND.rz - 1.6], 0.004);
  paths.rect([POND.x + POND.rx + 3.4, POND.z - 1.0, PITCH_FENCE[0], POND.z + 1.0], 0.004);
  paths.rect([-1.8, 29, 1.8, 33.5], 0.004);
  // flower beds
  for (const [x, z, c] of [[-22, 34, "#E58C8A"], [-4, 56, "#F2C14E"], [-22, 57, "#C98AD6"]] as [number, number, string][]) {
    b.solid.cyl(x, 0, z, 1.4, 0.14, "#6B4A32", 18);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      b.solid.sphere(x + Math.cos(a) * 0.8, 0.28, z + Math.sin(a) * 0.8, 0.22, 0.16, 0.22, "#4B8A5F", true);
      b.solid.sphere(x + Math.cos(a) * 0.8, 0.4, z + Math.sin(a) * 0.8, 0.1, 0.08, 0.1, i % 2 ? c : "#F7F3E8", true);
    }
  }
  // lamps around the pond path
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    lampPost(b, POND.x + Math.cos(a) * (POND.rx + 5.0), POND.z + Math.sin(a) * (POND.rz + 4.8), 3.2);
  }
}

function pitch(b: ReturnType<typeof makeBuilders>) {
  const x0 = PITCH.x - PITCH.len / 2;
  const x1 = PITCH.x + PITCH.len / 2;
  const z0 = PITCH.z - PITCH.wid / 2;
  const z1 = PITCH.z + PITCH.wid / 2;
  const s = b.solid;
  // mown stripes
  for (let i = 0; i < 8; i++) s.flat(x0 + (i + 0.5) * (PITCH.len / 8), 0.006, PITCH.z, PITCH.len / 8, PITCH.wid, i % 2 ? "#7FB46A" : "#8BC076");
  s.flat(PITCH.x, 0.005, PITCH.z, PITCH.len + 2.4, PITCH.wid + 2.4, "#79AE66");
  const line = (x: number, z: number, w: number, d: number) => s.flat(x, 0.009, z, w, d, WHITE);
  line(PITCH.x, z0, PITCH.len, 0.1);
  line(PITCH.x, z1, PITCH.len, 0.1);
  line(x0, PITCH.z, 0.1, PITCH.wid);
  line(x1, PITCH.z, 0.1, PITCH.wid);
  line(PITCH.x, PITCH.z, 0.1, PITCH.wid);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    line(PITCH.x + Math.cos(a) * 2.5, PITCH.z + Math.sin(a) * 2.5, 0.12, 0.42);
  }
  for (const gx of [x0, x1]) {
    const dir = gx === x0 ? 1 : -1;
    line(gx + dir * 2.0, PITCH.z, 0.1, 6);
    line(gx + dir * 1.0, PITCH.z - 3, 2.0, 0.1);
    line(gx + dir * 1.0, PITCH.z + 3, 2.0, 0.1);
    // goal: posts, crossbar, net
    for (const sz of [-1.6, 1.6]) s.cyl(gx, 0, PITCH.z + sz, 0.05, 1.2, "#FFFFFF", 8);
    s.box(gx, 1.2, PITCH.z, 0.1, 0.1, 3.3, "#FFFFFF");
    b.glass.box(gx - dir * 0.6, 0.6, PITCH.z, 1.2, 1.2, 3.2, "#FFFFFF");
  }
  // fence: posts and a see-through mesh
  const [fx0, fz0, fx1, fz1] = PITCH_FENCE;
  for (let x = fx0; x <= fx1 + 0.01; x += 2.6) {
    s.cyl(x, 0, fz0, 0.04, 2.2, "#2B3034", 6);
    s.cyl(x, 0, fz1, 0.04, 2.2, "#2B3034", 6);
  }
  for (let z = fz0; z <= fz1 + 0.01; z += 2.2) {
    if (Math.abs(z - PITCH.z) < 1.5 && z < fz1) continue;
    s.cyl(fx0, 0, z, 0.04, 2.2, "#2B3034", 6);
    s.cyl(fx1, 0, z, 0.04, 2.2, "#2B3034", 6);
  }
  b.glass.box((fx0 + fx1) / 2, 1.1, fz0, fx1 - fx0, 2.2, 0.02, "#2B4A3A");
  b.glass.box((fx0 + fx1) / 2, 1.1, fz1, fx1 - fx0, 2.2, 0.02, "#2B4A3A");
  b.glass.box(fx1, 1.1, (fz0 + fz1) / 2, 0.02, 2.2, fz1 - fz0, "#2B4A3A");
  b.glass.box(fx0, 1.1, (fz0 + PITCH.z - 1.5) / 2, 0.02, 2.2, PITCH.z - 1.5 - fz0, "#2B4A3A");
  b.glass.box(fx0, 1.1, (PITCH.z + 1.5 + fz1) / 2, 0.02, 2.2, fz1 - PITCH.z - 1.5, "#2B4A3A");
  // a spectator bench along the north side
  bench(b, PITCH.x - 4, fz0 - 0.9, Math.PI);
  bench(b, PITCH.x + 4, fz0 - 0.9, Math.PI);
}

// ---------------------------------------------------------------- street furniture

const SHAPES: CarShape[] = ["hatch", "suv", "van"];

function street(b: ReturnType<typeof makeBuilders>) {
  for (const [x, z] of lamps) lampPost(b, x, z, 5.2);
  for (const [x, z] of bollards) {
    b.solid.cyl(x, 0, z, 0.1, 0.85, "#2B3034", 10);
    b.solid.cyl(x, 0.7, z, 0.105, 0.06, "#F2F1EA", 10);
  }
  for (const [x, z, yaw] of benches) bench(b, x, z, yaw);
  for (const t of trees) tree(b, t.x, t.z, t.s, t.kind);
  parkedCars.forEach(([x, z, yaw, c], i) => {
    b.solid.at({ x, y: -ROAD_DROP, z, yaw }, () => carParts(SHAPES[i % 3], b.solid, b.solid, CAR_COLORS[c]));
  });
}

function TexturedMesh({ geometry, map, rough = 0.95, receive = true }: { geometry: BufferGeometry; map: Texture; rough?: number; receive?: boolean }) {
  return (
    <mesh geometry={geometry} receiveShadow={receive}>
      <meshStandardMaterial map={map} roughness={rough} />
    </mesh>
  );
}

export function City() {
  const g = useMemo(() => {
    const gr = ground();
    const b = makeBuilders();
    const paths = new Surface(1.4);
    roofs(b.solid);
    park(b, paths);
    pitch(b);
    street(b);
    const styles = { brick: [] as CityBuilding[], glass: [] as CityBuilding[], concrete: [] as CityBuilding[], shops: [] as CityBuilding[] };
    for (const bd of buildings) styles[bd.style].push(bd);
    return {
      ...gr,
      marks: markings(),
      paths: paths.build(),
      solid: b.solid.build(),
      glass: b.glass.build(),
      glow: b.glow.build(),
      brick: facadeWalls([...styles.brick, ...styles.shops.map((s) => s)], 0, 999),
      glassWalls: facadeWalls(styles.glass, 0, 999),
      concrete: facadeWalls(styles.concrete, 0, 999),
      shopsGround: facadeWalls(styles.shops, 0, FLOOR_H),
    };
  }, []);
  const tex = useMemo(() => {
    const wrap = (t: Texture) => {
      const c = t.clone();
      c.needsUpdate = true;
      return c;
    };
    return {
      pave: paving("#D9D5CA"),
      lawn: grass("#A9CB93"),
      plaza: paving("#E2DED3"),
      brick: wrap(facade("brick")),
      glass: wrap(facade("glass")),
      concrete: wrap(facade("concrete")),
      shops: wrap(facade("shops", true)),
    };
  }, []);
  const [x0, z0, x1, z1] = MAP;
  return (
    <group>
      {/* asphalt everywhere below the raised blocks */}
      <mesh position={[(x0 + x1) / 2, -ROAD_DROP, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[x1 - x0 + 400, z1 - z0 + 400]} />
        <meshStandardMaterial color="#6F7778" roughness={0.95} />
      </mesh>
      <mesh geometry={g.slabs} material={solidMat} receiveShadow />
      <TexturedMesh geometry={g.pave} map={tex.pave} />
      <TexturedMesh geometry={g.lawn} map={tex.lawn} />
      <TexturedMesh geometry={g.plaza} map={tex.plaza} />
      <TexturedMesh geometry={g.paths} map={tex.pave} />
      <mesh geometry={g.marks} material={solidMat} receiveShadow />
      {/* pond water */}
      <mesh position={[POND.x, 0.012, POND.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.rx, POND.rz, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#5E9DB4" roughness={0.15} metalness={0.1} />
      </mesh>
      <mesh geometry={g.solid} material={solidMat} castShadow receiveShadow />
      <mesh geometry={g.glass} material={glassMat} renderOrder={2} />
      <mesh geometry={g.glow} material={glowMat} />
      <TexturedMesh geometry={g.brick} map={tex.brick} rough={0.9} />
      <TexturedMesh geometry={g.glassWalls} map={tex.glass} rough={0.3} />
      <TexturedMesh geometry={g.concrete} map={tex.concrete} rough={0.9} />
      <mesh geometry={g.shopsGround} position={[0, 0, 0]} renderOrder={1}>
        <meshStandardMaterial map={tex.shops} roughness={0.8} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  );
}
