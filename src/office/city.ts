/**
 * The neighbourhood around the office: roads, crossings, traffic lanes, pavements, the park, the football ground
 * and the buildings next door. Plain data shared by the scene, the traffic simulation and the collision map.
 *
 * Levels: roads are the sunk base (y = -ROAD_DROP); everything else (pavements, lawns, the office plot) is a raised
 * block whose top is y = 0, so kerbs are real 0.15 m steps. Traffic keeps left, as in Pakistan.
 */
import { dist, inRect, rng, TAU, type Rect, type V2 } from "./geom";

export const ROAD_DROP = 0.15;
export const MAP: Rect = [-110, -100, 110, 120];

export type Road = { id: string; rect: Rect; axis: "x" | "z"; centre: number; busy: boolean };
export const roads: Road[] = [
  { id: "H1", rect: [-110, 19, 110, 26], axis: "x", centre: 22.5, busy: true },
  { id: "H2", rect: [-110, -33, 110, -26], axis: "x", centre: -29.5, busy: true },
  { id: "H3", rect: [-35, 63, 35, 70], axis: "x", centre: 66.5, busy: true },
  { id: "V1", rect: [-35, -100, -28, 70], axis: "z", centre: -31.5, busy: true },
  { id: "V2", rect: [28, -100, 35, 70], axis: "z", centre: 31.5, busy: true },
];

/** Raised blocks between the roads (top at y = 0). `kind` sets what covers them. */
export type Block = { id: string; rect: Rect; kind: "office" | "park" | "plaza" | "green" };
export const blocks: Block[] = [
  { id: "office", rect: [-28, -26, 28, 19], kind: "office" },
  { id: "park", rect: [-28, 26, 28, 63], kind: "park" },
  { id: "south", rect: [-35, 70, 35, 120], kind: "green" },
  { id: "west", rect: [-110, -26, -35, 19], kind: "plaza" },
  { id: "east", rect: [35, -26, 110, 19], kind: "plaza" },
  { id: "south-west", rect: [-110, 26, -35, 120], kind: "plaza" },
  { id: "south-east", rect: [35, 26, 110, 120], kind: "plaza" },
  { id: "north-west", rect: [-110, -100, -35, -33], kind: "green" },
  { id: "north", rect: [-28, -100, 28, -33], kind: "plaza" },
  { id: "north-east", rect: [35, -100, 110, -33], kind: "green" },
];

/** Paved pavement strip around the edge of each block, inside its rect. */
export const PAVEMENT_W = 3;

export const junctions: V2[] = [
  [-31.5, 22.5],
  [31.5, 22.5],
  [-31.5, -29.5],
  [31.5, -29.5],
  [-31.5, 66.5],
  [31.5, 66.5],
];
export const JUNCTION_HALF = 3.5;
export const junctionRect = (j: V2): Rect => [j[0] - JUNCTION_HALF, j[1] - JUNCTION_HALF, j[0] + JUNCTION_HALF, j[1] + JUNCTION_HALF];

/** Zebra crossings: the striped rectangle on the road. */
export type Crossing = { id: string; road: string; rect: Rect; axis: "x" | "z" };
export const crossings: Crossing[] = [
  { id: "gate", road: "H1", rect: [-2, 19, 2, 26], axis: "x" },
  { id: "park", road: "H1", rect: [18, 19, 22, 26], axis: "x" },
  { id: "west", road: "V1", rect: [-35, -2, -28, 2], axis: "z" },
  { id: "east", road: "V2", rect: [28, 43, 35, 47], axis: "z" },
];
export const crossingById = Object.fromEntries(crossings.map((c) => [c.id, c])) as Record<string, Crossing>;

// ---------------------------------------------------------------- lanes and routes

/** Closed loop around a rectangle with rounded corners, sampled every ~0.5 m. ccw = counter-clockwise on a north-up map. */
export function roundedLoop(x0: number, z0: number, x1: number, z1: number, r: number, ccw: boolean): V2[] {
  // corner arcs in CCW order on a north-up map (z grows south): bottom-right, top-right, top-left, bottom-left
  const corners: { c: V2; a0: number }[] = [
    { c: [x1 - r, z1 - r], a0: Math.PI / 2 },
    { c: [x1 - r, z0 + r], a0: 0 },
    { c: [x0 + r, z0 + r], a0: -Math.PI / 2 },
    { c: [x0 + r, z1 - r], a0: Math.PI },
  ];
  const pts: V2[] = [];
  const arcSteps = Math.max(4, Math.ceil((r * Math.PI) / 2 / 0.5));
  for (const { c, a0 } of corners) {
    // sweep each corner by -90 degrees (turning left on a north-up map)
    for (let i = 0; i <= arcSteps; i++) {
      const a = a0 - (i / arcSteps) * (Math.PI / 2);
      pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
    }
  }
  // fill straight runs between corners
  const out: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push(a);
    const d = dist(a, b);
    const n = Math.floor(d / 0.5);
    for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return ccw ? out : out.reverse();
}

export type Loop = { id: string; pts: V2[]; lengths: number[]; length: number };

export function makeLoop(id: string, pts: V2[]): Loop {
  const lengths = [0];
  for (let i = 1; i <= pts.length; i++) lengths.push(lengths[i - 1] + dist(pts[i - 1], pts[i % pts.length]));
  return { id, pts, lengths, length: lengths[lengths.length - 1] };
}

/** Position and heading at arc length s on a closed loop. */
export function sampleLoop(loop: Loop, s: number): { x: number; z: number; yaw: number } {
  const L = loop.length;
  s = ((s % L) + L) % L;
  let lo = 0;
  let hi = loop.pts.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (loop.lengths[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = loop.pts[lo];
  const b = loop.pts[(lo + 1) % loop.pts.length];
  const seg = loop.lengths[lo + 1] - loop.lengths[lo] || 1;
  const k = (s - loop.lengths[lo]) / seg;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

/** Arc-length windows where a loop runs through each rectangle (crossings, junction boxes). */
export function windows(loop: Loop, rects: { id: string; rect: Rect }[]): { id: string; s0: number; s1: number }[] {
  const out: { id: string; s0: number; s1: number }[] = [];
  const step = 0.25;
  for (const { id, rect } of rects) {
    let inside = false;
    let s0 = 0;
    for (let s = 0; s <= loop.length + step; s += step) {
      const p = sampleLoop(loop, s);
      const now = inRect(p.x, p.z, rect);
      if (now && !inside) s0 = s;
      if (!now && inside) out.push({ id, s0, s1: s });
      inside = now;
    }
  }
  return out;
}

const LANE = 1.75;
/** Ring road lanes. Inner lanes run counter-clockwise, outer lanes clockwise (keep left). */
export const lanes: Loop[] = [
  makeLoop("north-in", roundedLoop(-31.5 + LANE, -29.5 + LANE, 31.5 - LANE, 22.5 - LANE, 4, true)),
  makeLoop("north-out", roundedLoop(-31.5 - LANE, -29.5 - LANE, 31.5 + LANE, 22.5 + LANE, 7.5, false)),
  makeLoop("south-in", roundedLoop(-31.5 + LANE, 22.5 + LANE, 31.5 - LANE, 66.5 - LANE, 4, true)),
  makeLoop("south-out", roundedLoop(-31.5 - LANE, 22.5 - LANE, 31.5 + LANE, 66.5 + LANE, 7.5, false)),
];

/** Pedestrian routes (closed loops on pavements and park paths; some use the zebra crossings). */
function polyLoop(id: string, pts: V2[]): Loop {
  const out: V2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.floor(dist(a, b) / 0.5));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return makeLoop(id, out);
}

function ellipseLoop(id: string, cx: number, cz: number, rx: number, rz: number, n = 72): Loop {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
  }
  return makeLoop(id, pts);
}

export const POND = { x: -13, z: 45, rx: 7, rz: 4.6 };
export const PITCH = { x: 12, z: 45, len: 24, wid: 15 };
export const PITCH_RECT: Rect = [PITCH.x - PITCH.len / 2, PITCH.z - PITCH.wid / 2, PITCH.x + PITCH.len / 2, PITCH.z + PITCH.wid / 2];
export const PITCH_FENCE: Rect = [-1, 36.2, 25, 53.8];

export const pedRoutes: Loop[] = [
  makeLoop("office-block", roundedLoop(-26.5, -24.5, 26.5, 17.6, 1.5, false)),
  makeLoop("park-block", roundedLoop(-26.5, 27.6, 26.5, 61.5, 1.5, true)),
  polyLoop("crossings", [
    [-12, 17.6],
    [20, 17.6],
    [20, 27.6],
    [0.8, 27.6],
    [0.8, 17.6],
  ]),
  ellipseLoop("pond", POND.x, POND.z, POND.rx + 2.6, POND.rz + 2.4),
  makeLoop("west-plaza", roundedLoop(-62, -25, -38, 18, 2, true)),
];

// ---------------------------------------------------------------- buildings and street furniture

export type BuildingStyle = "brick" | "glass" | "concrete" | "shops";
export type CityBuilding = { id: string; x: number; z: number; w: number; d: number; h: number; style: BuildingStyle };
export const buildings: CityBuilding[] = [
  { id: "B1", x: -49, z: -14, w: 18, d: 20, h: 13, style: "brick" },
  { id: "B2", x: -51, z: 9, w: 16, d: 14, h: 22, style: "glass" },
  { id: "B3", x: 49, z: -15, w: 18, d: 18, h: 16, style: "concrete" },
  { id: "B4", x: 50, z: 8, w: 20, d: 16, h: 10, style: "shops" },
  { id: "B5", x: 50, z: 44, w: 16, d: 22, h: 30, style: "glass" },
  { id: "B6", x: 0, z: -52, w: 36, d: 18, h: 9, style: "concrete" },
  { id: "B7", x: -54, z: 44, w: 16, d: 18, h: 8, style: "brick" },
  { id: "B8", x: -52, z: -55, w: 22, d: 16, h: 18, style: "glass" },
  { id: "B9", x: 52, z: -56, w: 20, d: 18, h: 12, style: "brick" },
];

const blocked = (x: number, z: number, pad: number) =>
  roads.some((r) => inRect(x, z, r.rect, pad)) ||
  buildings.some((b) => inRect(x, z, [b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2], pad + 1.5));

/** Street lamps along the busy pavements (not on crossings or the gate). */
export const lamps: V2[] = (() => {
  const out: V2[] = [];
  for (let x = -24; x <= 24; x += 8) {
    if (Math.abs(x) < 4 || Math.abs(x - 20) < 3.5) continue;
    out.push([x, 18.55], [x, 26.45]);
  }
  for (let z = -20; z <= 12; z += 10) out.push([-27.45, z], [27.45, z]);
  for (let z = 34; z <= 58; z += 8) out.push([-27.45, z], [27.45, z]);
  for (let x = -20; x <= 20; x += 10) out.push([x, -25.45], [x, 62.45]);
  return out;
})();

/** Bollards at the kerbs of each crossing. */
export const bollards: V2[] = crossings.flatMap((c) => {
  const [x0, z0, x1, z1] = c.rect;
  return c.axis === "x"
    ? [[x0 - 0.35, z0 - 0.45], [x1 + 0.35, z0 - 0.45], [x0 - 0.35, z1 + 0.45], [x1 + 0.35, z1 + 0.45]] as V2[]
    : ([[x0 - 0.45, z0 - 0.35], [x0 - 0.45, z1 + 0.35], [x1 + 0.45, z0 - 0.35], [x1 + 0.45, z1 + 0.35]] as V2[]);
});

/** Benches: [x, z, yaw]. The pond benches face the water. */
export const benches: [number, number, number][] = [
  [-9, 28.6, Math.PI],
  [9.5, 28.6, Math.PI],
  ...[0.6, 1.6, 2.6, 3.7, 4.7, 5.6].map((a): [number, number, number] => {
    const x = POND.x + Math.cos(a) * (POND.rx + 4.2);
    const z = POND.z + Math.sin(a) * (POND.rz + 4.0);
    return [x, z, Math.atan2(POND.x - x, POND.z - z)];
  }),
];

/** Trees: park, street verges and the plazas, placed deterministically. */
export const trees: { x: number; z: number; s: number; kind: "round" | "cone" }[] = (() => {
  const rnd = rng(7);
  const out: { x: number; z: number; s: number; kind: "round" | "cone" }[] = [];
  const add = (x: number, z: number, s = 0.9 + rnd() * 0.5) => out.push({ x, z, s, kind: rnd() < 0.7 ? "round" : "cone" });
  // park: scatter, keeping off the pond, its path, the pitch and the entrance path
  let guard = 0;
  while (out.length < 34 && guard++ < 2000) {
    const x = -24 + rnd() * 48;
    const z = 30.5 + rnd() * 29;
    const pond = ((x - POND.x) / (POND.rx + 4.4)) ** 2 + ((z - POND.z) / (POND.rz + 4.2)) ** 2;
    if (pond < 1.15) continue;
    if (inRect(x, z, PITCH_FENCE, 2)) continue;
    if (Math.abs(x - 0.8) < 2.5 && z < 33) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.6)) continue;
    add(x, z);
  }
  // plazas and verges further out
  guard = 0;
  const start = out.length;
  while (out.length < start + 70 && guard++ < 6000) {
    const x = -100 + rnd() * 200;
    const z = -92 + rnd() * 200;
    if (inRect(x, z, [-29, -27, 29, 64])) continue;
    if (blocked(x, z, 2.5)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue;
    add(x, z, 1.0 + rnd() * 0.6);
  }
  return out;
})();

/** Parked cars on the quiet street ends: [x, z, yaw, colour index]. */
export const parkedCars: [number, number, number, number][] = [
  [-46, 19.9, Math.PI / 2, 0],
  [-52, 19.9, Math.PI / 2, 3],
  [-64, 19.9, Math.PI / 2, 5],
  [-58, 25.1, -Math.PI / 2, 2],
  [46, 25.1, -Math.PI / 2, 1],
  [56, 25.1, -Math.PI / 2, 4],
  [62, 19.9, Math.PI / 2, 6],
  [-28.9, -44, 0, 2],
  [-28.9, -52, 0, 0],
  [34.1, -48, Math.PI, 5],
  [34.1, -62, Math.PI, 3],
];

/** Ground height: roads are sunk; zebra crossings have dropped kerbs so walkers ramp down and up. */
export function groundY(x: number, z: number): number {
  let onRoad = false;
  for (const r of roads) if (inRect(x, z, r.rect)) onRoad = true;
  if (onRoad) return -ROAD_DROP;
  for (const c of crossings) {
    const [x0, z0, x1, z1] = c.rect;
    const ramp = 0.6;
    if (c.axis === "x" && x > x0 && x < x1) {
      if (z > z0 - ramp && z <= z0) return -ROAD_DROP * ((z - (z0 - ramp)) / ramp);
      if (z >= z1 && z < z1 + ramp) return -ROAD_DROP * (1 - (z - z1) / ramp);
    }
    if (c.axis === "z" && z > z0 && z < z1) {
      if (x > x0 - ramp && x <= x0) return -ROAD_DROP * ((x - (x0 - ramp)) / ramp);
      if (x >= x1 && x < x1 + ramp) return -ROAD_DROP * (1 - (x - x1) / ramp);
    }
  }
  return 0;
}
