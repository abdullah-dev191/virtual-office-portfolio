/**
 * The office plan: walls, doors, rooms, furniture and seats (metres; x east, z south; the entrance faces south).
 * One furniture array drives both the scene and the collision map, so they cannot drift apart.
 */
import type { DeptId, PlaceId } from "@/content/departments";
import { footprint, offset, type Rect, type V2 } from "./geom";

export const BUILDING: Rect = [-21, -19, 21, 10];
/** Inside of the white boundary wall. */
export const PLOT: Rect = [-25, -23, 25, 16];
/** Height of every table and desk top (matches the typing pose in rig.generated.ts). */
export const TABLE_H = 0.72;
/** Seat cushion height of chairs, sofas and benches. */
export const SEAT_H = 0.42;
/** How far a chair slides back when it is pulled out. */
export const PULL = 0.4;

// ---------------------------------------------------------------- walls

export type WallKind = "outer" | "back" | "glass" | "boundary";
export type Wall = { a: V2; b: V2; kind: WallKind };
export const WALL_T: Record<WallKind, number> = { outer: 0.24, back: 0.24, glass: 0.1, boundary: 0.3 };
export const WALL_H: Record<WallKind, number> = { outer: 1.15, back: 2.9, glass: 2.5, boundary: 1.25 };

const DOOR_W = 1.4;
const ENTRANCE_W = 3.2;
const GATE_W = 4.8;

/** A wall from a to b with gaps at the given centres (for doors), measured along the wall. */
function wallWithGaps(a: V2, b: V2, kind: WallKind, gaps: { at: number; w: number }[]): Wall[] {
  const horizontal = a[1] === b[1];
  const s0 = horizontal ? a[0] : a[1];
  const s1 = horizontal ? b[0] : b[1];
  const lo = Math.min(s0, s1);
  const hi = Math.max(s0, s1);
  const cuts = gaps.map((g) => [g.at - g.w / 2, g.at + g.w / 2]).sort((p, q) => p[0] - q[0]);
  const out: Wall[] = [];
  let cur = lo;
  const pt = (s: number): V2 => (horizontal ? [s, a[1]] : [a[0], s]);
  for (const [c0, c1] of cuts) {
    if (c0 > cur) out.push({ a: pt(cur), b: pt(c0), kind });
    cur = c1;
  }
  if (cur < hi) out.push({ a: pt(cur), b: pt(hi), kind });
  return out;
}

export const walls: Wall[] = [
  // building shell: tall back wall in the north, low walls elsewhere so the camera sees in
  { a: [-21, -19], b: [21, -19], kind: "back" },
  { a: [-21, -19], b: [-21, 10], kind: "outer" },
  { a: [21, -19], b: [21, 10], kind: "outer" },
  ...wallWithGaps([-21, 10], [21, 10], "outer", [{ at: 0, w: ENTRANCE_W }]),
  // west rooms: Design Room (north), Work Studio, The Lounge (south)
  { a: [-21, -10], b: [-9, -10], kind: "glass" },
  { a: [-21, 0], b: [-9, 0], kind: "glass" },
  ...wallWithGaps([-9, -19], [-9, 10], "glass", [{ at: -15, w: DOOR_W }, { at: -5, w: DOOR_W }, { at: 6, w: DOOR_W }]),
  // east rooms: Operations (north), Meeting Room, Tech Lab (south)
  { a: [9, -10], b: [21, -10], kind: "glass" },
  { a: [9, 0], b: [21, 0], kind: "glass" },
  ...wallWithGaps([9, -19], [9, 10], "glass", [{ at: -15, w: DOOR_W }, { at: -5, w: DOOR_W }, { at: 6, w: DOOR_W }]),
  // boss cabin at the north end of the open office
  { a: [-6, -19], b: [-6, -11], kind: "glass" },
  { a: [6, -19], b: [6, -11], kind: "glass" },
  ...wallWithGaps([-6, -11], [6, -11], "glass", [{ at: 0, w: DOOR_W }]),
  // site boundary with the gate in the south
  { a: [-25, -23], b: [25, -23], kind: "boundary" },
  { a: [-25, -23], b: [-25, 16], kind: "boundary" },
  { a: [25, -23], b: [25, 16], kind: "boundary" },
  ...wallWithGaps([-25, 16], [25, 16], "boundary", [{ at: 0, w: GATE_W }]),
];

/** Thin blocking rectangle for a wall. */
export function wallRect(w: Wall): Rect {
  const t = WALL_T[w.kind] / 2;
  return [Math.min(w.a[0], w.b[0]) - t, Math.min(w.a[1], w.b[1]) - t, Math.max(w.a[0], w.b[0]) + t, Math.max(w.a[1], w.b[1]) + t];
}

// ---------------------------------------------------------------- doors

export type Door = {
  id: DeptId;
  /** Hinge post on the wall line. */
  hinge: V2;
  /** Leaf direction (yaw) when shut and when fully open into the room. */
  shutYaw: number;
  openYaw: number;
  width: number;
  centre: V2;
  /** Stand points one metre either side of the doorway, and the yaw that faces into the room. */
  out: V2;
  inn: V2;
  inYaw: number;
  /** Blocks the doorway while the leaf is shut. */
  rect: Rect;
  plaque: string;
};

function makeDoor(id: DeptId, hinge: V2, shutYaw: number, openYaw: number, inYaw: number, plaque: string): Door {
  const centre = offset(hinge, shutYaw, DOOR_W / 2);
  const out = offset(centre, inYaw, -1);
  const inn = offset(centre, inYaw, 1);
  const end = offset(hinge, shutYaw, DOOR_W);
  const t = 0.07;
  const rect: Rect = [Math.min(hinge[0], end[0]) - t, Math.min(hinge[1], end[1]) - t, Math.max(hinge[0], end[0]) + t, Math.max(hinge[1], end[1]) + t];
  return { id, hinge, shutYaw, openYaw, width: DOOR_W, centre, out, inn, inYaw, rect, plaque };
}

const W = -Math.PI / 2; // facing west (-x)
const E = Math.PI / 2; // facing east (+x)
const N = Math.PI; // facing north (-z)
const S = 0; // facing south (+z)

export const doors: Record<DeptId, Door> = {
  lounge: makeDoor("lounge", [-9, 5.3], S, W, W, "THE LOUNGE"),
  work: makeDoor("work", [-9, -5.7], S, W, W, "WORK STUDIO"),
  design: makeDoor("design", [-9, -15.7], S, W, W, "DESIGN ROOM"),
  tech: makeDoor("tech", [9, 5.3], S, E, E, "TECH LAB"),
  meet: makeDoor("meet", [9, -5.7], S, E, E, "MEETING ROOM"),
  ops: makeDoor("ops", [9, -15.7], S, E, E, "OPERATIONS"),
  boss: makeDoor("boss", [-0.7, -11], E, N, N, "BOSS CABIN"),
};
export const doorIds = Object.keys(doors) as DeptId[];

/** Main entrance (automatic sliding glass doors) and the iron gate in the boundary wall. */
export const ENTRANCE = { x0: -ENTRANCE_W / 2, x1: ENTRANCE_W / 2, z: 10 };
export const GATE = { x0: -GATE_W / 2, x1: GATE_W / 2, z: 16, rect: [-GATE_W / 2, 15.85, GATE_W / 2, 16.15] as Rect };

// ---------------------------------------------------------------- seats

export type SeatKind = "chair" | "armchair" | "sofa";
export type SeatRole = "visitor" | "admin" | "team" | "staff" | "boss" | "reception" | "guest" | "spare";

export type SeatAnchor = {
  id: string;
  /** Seat centre (where the hips rest) with the chair tucked in. */
  position: V2;
  /** Direction a seated person faces. */
  facingYaw: number;
  /** Free floor spot beside the seat that the walker heads for first. */
  approachPoint: V2;
  kind: SeatKind;
  role: SeatRole;
  dept: DeptId | "reception" | "office";
  /** Who sits here when the office opens: an NPC, nobody (reserved for the visitor) or nobody at all. */
  occupant: "npc" | "visitor" | null;
  deskId?: string;
  chairColor?: string;
};

const seat = (
  id: string,
  position: V2,
  facingYaw: number,
  approachPoint: V2,
  role: SeatRole,
  dept: SeatAnchor["dept"],
  occupant: SeatAnchor["occupant"],
  kind: SeatKind = "chair",
  extra: Partial<SeatAnchor> = {},
): SeatAnchor => ({ id, position, facingYaw, approachPoint, kind, role, dept, occupant, ...extra });

/** Approach point for seats nobody but NPCs uses: straight behind, clear of the chair. */
const behind = (p: V2, yaw: number): V2 => offset(p, yaw, -1.1);

const podSeats = (pod: string, cx: number, cz: number, busy: boolean[]): SeatAnchor[] => {
  const out: SeatAnchor[] = [];
  [-0.71, 0.71].forEach((dx, i) => {
    const south: V2 = [cx + dx, cz + 1.12];
    const north: V2 = [cx + dx, cz - 1.12];
    out.push(seat(`${pod}-s${i}`, south, N, behind(south, N), "staff", "office", busy[i] ? "npc" : null, "chair", { deskId: pod }));
    out.push(seat(`${pod}-n${i}`, north, S, behind(north, S), "staff", "office", busy[2 + i] ? "npc" : null, "chair", { deskId: pod }));
  });
  return out;
};

export const seats: SeatAnchor[] = [
  // reception
  seat("reception", [0.35, 4.23], S, [1.35, 3.95], "reception", "reception", "npc", "chair", { chairColor: "#2D5C8F" }),
  // open office pods (busy flags: south-left, south-right, north-left, north-right)
  ...podSeats("podW1", -4.6, -2.6, [true, false, false, true]),
  ...podSeats("podW2", -4.6, -7.6, [false, true, true, false]),
  ...podSeats("podE1", 4.6, -2.6, [true, false, true, true]),
  ...podSeats("podE2", 4.6, -7.6, [false, true, false, true]),
  // Work Studio: table for six, lead at the west end, visitor at the east end
  seat("work-lead", [-17.02, -5.0], E, [-17.2, -6.0], "admin", "work", "npc", "chair", { deskId: "work-table" }),
  seat("work-visitor", [-13.38, -5.0], W, [-13.2, -6.05], "visitor", "work", "visitor", "chair", { deskId: "work-table" }),
  seat("work-n0", [-15.9, -5.97], S, behind([-15.9, -5.97], S), "team", "work", "npc", "chair", { deskId: "work-table" }),
  seat("work-n1", [-14.5, -5.97], S, behind([-14.5, -5.97], S), "spare", "work", null, "chair", { deskId: "work-table" }),
  seat("work-s0", [-15.9, -4.03], N, behind([-15.9, -4.03], N), "spare", "work", null, "chair", { deskId: "work-table" }),
  seat("work-s1", [-14.5, -4.03], N, behind([-14.5, -4.03], N), "team", "work", "npc", "chair", { deskId: "work-table" }),
  // Design Room: round table
  seat("design-lead", [-15, -15.57], S, [-16.2, -16.3], "admin", "design", "npc", "chair", { deskId: "design-table" }),
  seat("design-visitor", [-13.93, -14.5], W, [-13.75, -13.45], "visitor", "design", "visitor", "chair", { deskId: "design-table" }),
  seat("design-s", [-15, -13.43], N, behind([-15, -13.43], N), "spare", "design", null, "chair", { deskId: "design-table" }),
  seat("design-w", [-16.07, -14.5], E, behind([-16.07, -14.5], E), "spare", "design", null, "chair", { deskId: "design-table" }),
  // Tech Lab: workbench facing the screens
  seat("tech-lead", [14.0, 3.95], N, [13.0, 4.35], "admin", "tech", "npc", "chair", { deskId: "tech-bench" }),
  seat("tech-visitor", [15.6, 3.95], N, [16.6, 4.25], "visitor", "tech", "visitor", "chair", { deskId: "tech-bench" }),
  // Meeting Room: table for eight, coordinator at the far end, visitor nearest the door
  seat("meet-lead", [17.72, -5.0], W, [17.9, -6.05], "admin", "meet", "npc", "chair", { deskId: "meet-table" }),
  seat("meet-visitor", [13.08, -5.0], E, [12.95, -6.05], "visitor", "meet", "visitor", "chair", { deskId: "meet-table" }),
  ...[14.2, 15.4, 16.6].flatMap((x, i) => [
    seat(`meet-n${i}`, [x, -5.97], S, behind([x, -5.97], S), "spare", "meet", null, "chair", { deskId: "meet-table" }),
    seat(`meet-s${i}`, [x, -4.03], N, behind([x, -4.03], N), "spare", "meet", null, "chair", { deskId: "meet-table" }),
  ]),
  // Operations: manager behind the desk, visitor across it
  seat("ops-lead", [16.82, -14.5], W, [17.9, -13.3], "admin", "ops", "npc", "chair", { deskId: "ops-desk" }),
  seat("ops-visitor", [15.18, -14.5], E, [14.95, -13.25], "visitor", "ops", "visitor", "chair", { deskId: "ops-desk" }),
  // Boss Cabin: the boss behind the big desk, two visitor chairs in front
  seat("boss", [0, -16.87], S, [1.6, -17.0], "boss", "boss", "npc", "chair", { deskId: "boss-desk", chairColor: "#2F3236" }),
  seat("boss-visitor", [-0.7, -15.13], N, [-1.65, -14.9], "visitor", "boss", "visitor", "chair", { deskId: "boss-desk", chairColor: "#6E4B3A" }),
  seat("boss-guest", [0.7, -15.13], N, behind([0.7, -15.13], N), "spare", "boss", null, "chair", { deskId: "boss-desk", chairColor: "#6E4B3A" }),
  // The Lounge: someone relaxing on the green sofa, the visitor takes an armchair
  seat("lounge-host", [-20.1, 4.3], E, [-19.2, 3.0], "guest", "lounge", "npc", "sofa"),
  seat("lounge-visitor", [-16.36, 5.9], W, [-16.3, 6.95], "visitor", "lounge", "visitor", "armchair"),
];

export const seatById = new Map(seats.map((s) => [s.id, s]));
export const visitorSeat = (d: DeptId) => seats.find((s) => s.dept === d && s.role === "visitor") as SeatAnchor;
export const hostSeat = (d: DeptId) => seats.find((s) => s.dept === d && (s.role === "admin" || s.role === "boss" || s.role === "guest"));

// ---------------------------------------------------------------- furniture

export type Monitor = "single" | "dual" | "laptop" | "none";

export type Furniture =
  | { kind: "pod"; id: string; x: number; z: number }
  | { kind: "table"; id: string; x: number; z: number; w: number; d: number; tone?: "oak" | "walnut" | "white" }
  | { kind: "roundTable"; id: string; x: number; z: number; r: number }
  | { kind: "desk"; id: string; x: number; z: number; yaw: number; w: number; d: number; monitor: Monitor; tone?: "oak" | "walnut" | "white" }
  | { kind: "reception"; x: number; z: number; w: number; d: number }
  | { kind: "sofa"; x: number; z: number; yaw: number; w: number; color: string }
  | { kind: "armchair"; x: number; z: number; yaw: number; color: string }
  | { kind: "coffeeTable"; x: number; z: number; yaw: number; w: number; d: number }
  | { kind: "plant"; x: number; z: number; s: number; variant: "palm" | "bush" | "tall" }
  | { kind: "bookshelf"; x: number; z: number; yaw: number; w: number }
  | { kind: "cabinet"; x: number; z: number; yaw: number; w: number; h: number }
  | { kind: "rack"; x: number; z: number; yaw: number }
  | { kind: "whiteboard"; x: number; z: number; yaw: number; w: number; notes: boolean }
  | { kind: "screen"; x: number; z: number; yaw: number; w: number; h: number; content: "skills" | "contact" | "ops" | "mood" }
  | { kind: "posterWall"; x: number; z: number; w: number }
  | { kind: "counter"; x: number; z: number; yaw: number; w: number }
  | { kind: "printer"; x: number; z: number; yaw: number }
  | { kind: "cooler"; x: number; z: number }
  | { kind: "lamp"; x: number; z: number }
  | { kind: "rug"; x: number; z: number; w: number; d: number; color: string };

export const furniture: Furniture[] = [
  // lobby
  { kind: "rug", x: 0, z: 7.4, w: 5.2, d: 2.6, color: "#86A99D" },
  { kind: "reception", x: 0, z: 5.0, w: 4.2, d: 0.9 },
  { kind: "plant", x: -2.6, z: 9.3, s: 1.1, variant: "palm" },
  { kind: "plant", x: 2.6, z: 9.3, s: 1.1, variant: "bush" },
  { kind: "sofa", x: -5.6, z: 9.3, yaw: N, w: 2.2, color: "#4F7C6C" },
  { kind: "coffeeTable", x: -5.6, z: 8.1, yaw: 0, w: 1.0, d: 0.55 },
  { kind: "plant", x: -7.9, z: 9.3, s: 1.0, variant: "tall" },
  { kind: "armchair", x: 4.8, z: 9.2, yaw: N, color: "#C98A6B" },
  { kind: "armchair", x: 6.4, z: 9.2, yaw: N, color: "#C98A6B" },
  { kind: "plant", x: 8.0, z: 9.3, s: 1.0, variant: "palm" },
  { kind: "plant", x: -8.3, z: 0.7, s: 0.9, variant: "bush" },
  { kind: "plant", x: 8.3, z: 0.7, s: 0.9, variant: "bush" },
  // open office
  { kind: "pod", id: "podW1", x: -4.6, z: -2.6 },
  { kind: "pod", id: "podW2", x: -4.6, z: -7.6 },
  { kind: "pod", id: "podE1", x: 4.6, z: -2.6 },
  { kind: "pod", id: "podE2", x: 4.6, z: -7.6 },
  { kind: "plant", x: -8.35, z: -10.45, s: 1.1, variant: "palm" },
  { kind: "plant", x: 8.35, z: -10.45, s: 1.1, variant: "palm" },
  { kind: "printer", x: 8.45, z: -8.4, yaw: W },
  { kind: "cooler", x: -8.55, z: -8.4 },
  { kind: "plant", x: -7.5, z: -18.4, s: 1.0, variant: "tall" },
  { kind: "plant", x: 7.5, z: -18.4, s: 1.0, variant: "tall" },
  // boss cabin
  { kind: "rug", x: 0, z: -15.6, w: 4.6, d: 3.6, color: "#3C6154" },
  { kind: "desk", id: "boss-desk", x: 0, z: -16.0, yaw: S, w: 2.4, d: 1.1, monitor: "laptop", tone: "walnut" },
  { kind: "bookshelf", x: -3.2, z: -18.6, yaw: S, w: 3.4 },
  { kind: "bookshelf", x: 3.2, z: -18.6, yaw: S, w: 3.4 },
  { kind: "cabinet", x: 0, z: -18.55, yaw: S, w: 2.2, h: 0.8 },
  { kind: "sofa", x: -5.3, z: -14.5, yaw: E, w: 1.8, color: "#2E4D41" },
  { kind: "coffeeTable", x: -4.2, z: -14.5, yaw: E, w: 0.9, d: 0.5 },
  { kind: "plant", x: 5.3, z: -11.7, s: 1.1, variant: "palm" },
  { kind: "plant", x: 5.3, z: -18.3, s: 1.0, variant: "bush" },
  { kind: "plant", x: -5.3, z: -11.75, s: 0.9, variant: "tall" },
  // Design Room
  { kind: "rug", x: -15, z: -14.5, w: 4.2, d: 4.2, color: "#E1CE95" },
  { kind: "roundTable", id: "design-table", x: -15, z: -14.5, r: 0.75 },
  { kind: "whiteboard", x: -20.8, z: -14.5, yaw: E, w: 4, notes: true },
  { kind: "screen", x: -15, z: -18.82, yaw: S, w: 3.2, h: 1.6, content: "mood" },
  { kind: "plant", x: -20.3, z: -10.7, s: 1.0, variant: "palm" },
  { kind: "plant", x: -10.0, z: -18.3, s: 0.9, variant: "bush" },
  { kind: "cabinet", x: -11.6, z: -18.6, yaw: S, w: 1.6, h: 1.0 },
  // Work Studio
  { kind: "table", id: "work-table", x: -15.2, z: -5.0, w: 3.0, d: 1.3, tone: "oak" },
  { kind: "posterWall", x: -15.3, z: -9.45, w: 10 },
  { kind: "plant", x: -20.3, z: -0.75, s: 1.0, variant: "palm" },
  { kind: "plant", x: -10.0, z: -0.75, s: 0.9, variant: "bush" },
  { kind: "cabinet", x: -20.6, z: -4.6, yaw: E, w: 1.6, h: 1.1 },
  // The Lounge
  { kind: "rug", x: -17.6, z: 5.0, w: 6.0, d: 4.6, color: "#D6A58A" },
  { kind: "sofa", x: -20.1, z: 5.0, yaw: E, w: 2.4, color: "#3F7A55" },
  { kind: "coffeeTable", x: -18.3, z: 5.0, yaw: E, w: 1.2, d: 0.6 },
  { kind: "armchair", x: -16.4, z: 4.1, yaw: W, color: "#C98A6B" },
  { kind: "armchair", x: -16.4, z: 5.9, yaw: W, color: "#C98A6B" },
  { kind: "counter", x: -18.0, z: 0.55, yaw: S, w: 4.0 },
  { kind: "bookshelf", x: -14.0, z: 9.6, yaw: N, w: 2.4 },
  { kind: "lamp", x: -20.4, z: 2.9 },
  { kind: "plant", x: -20.3, z: 9.3, s: 1.1, variant: "palm" },
  { kind: "plant", x: -10.0, z: 9.3, s: 0.9, variant: "tall" },
  // Tech Lab
  ...[1.5, 2.3, 3.1, 3.9, 4.7, 5.5].map((z): Furniture => ({ kind: "rack", x: 20.35, z, yaw: W })),
  { kind: "desk", id: "tech-bench", x: 14.8, z: 3.2, yaw: N, w: 3.2, d: 0.85, monitor: "dual", tone: "white" },
  { kind: "screen", x: 14.8, z: 0.14, yaw: S, w: 4.4, h: 1.8, content: "skills" },
  { kind: "plant", x: 9.8, z: 9.3, s: 1.0, variant: "bush" },
  { kind: "plant", x: 20.3, z: 9.3, s: 1.0, variant: "palm" },
  { kind: "cabinet", x: 17.5, z: 9.55, yaw: N, w: 2.0, h: 0.9 },
  // Meeting Room
  { kind: "table", id: "meet-table", x: 15.4, z: -5.0, w: 4.0, d: 1.3, tone: "walnut" },
  { kind: "screen", x: 20.82, z: -5.0, yaw: W, w: 3.6, h: 2.0, content: "contact" },
  { kind: "cabinet", x: 15.0, z: -9.6, yaw: S, w: 4.0, h: 0.8 },
  { kind: "plant", x: 9.8, z: -0.75, s: 0.9, variant: "bush" },
  { kind: "plant", x: 20.3, z: -9.3, s: 1.0, variant: "palm" },
  // Operations
  { kind: "desk", id: "ops-desk", x: 16.0, z: -14.5, yaw: W, w: 2.2, d: 1.0, monitor: "dual", tone: "oak" },
  { kind: "screen", x: 20.82, z: -14.5, yaw: W, w: 5.6, h: 2.0, content: "ops" },
  { kind: "cabinet", x: 11.4, z: -18.6, yaw: S, w: 1.4, h: 1.3 },
  { kind: "cabinet", x: 13.0, z: -18.6, yaw: S, w: 1.4, h: 1.3 },
  { kind: "plant", x: 9.8, z: -18.3, s: 1.0, variant: "palm" },
  { kind: "plant", x: 20.3, z: -10.7, s: 0.9, variant: "bush" },
];

/** Floor area a piece of furniture blocks, or null for things you can walk over or that sit on a wall. */
export function furnitureRect(f: Furniture): Rect | null {
  switch (f.kind) {
    case "pod":
      return [f.x - 1.42, f.z - 0.8, f.x + 1.42, f.z + 0.8];
    case "table":
      return [f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2];
    case "roundTable":
      return [f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r];
    case "desk":
      return footprint(f.x, f.z, f.w, f.d, f.yaw);
    case "reception":
      return [f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2];
    case "sofa":
      return footprint(f.x, f.z, f.w, 0.95, f.yaw);
    case "armchair":
      return footprint(f.x, f.z, 0.86, 0.86, f.yaw);
    case "coffeeTable":
      return footprint(f.x, f.z, f.w, f.d, f.yaw);
    case "plant":
      return [f.x - 0.36 * f.s, f.z - 0.36 * f.s, f.x + 0.36 * f.s, f.z + 0.36 * f.s];
    case "bookshelf":
      return footprint(f.x, f.z, f.w, 0.4, f.yaw);
    case "cabinet":
      return footprint(f.x, f.z, f.w, 0.5, f.yaw);
    case "rack":
      return footprint(f.x, f.z, 0.62, 0.9, f.yaw);
    case "posterWall":
      return [f.x - f.w / 2, f.z - 0.15, f.x + f.w / 2, f.z + 0.15];
    case "counter":
      return footprint(f.x, f.z, f.w, 0.62, f.yaw);
    case "printer":
      return footprint(f.x, f.z, 0.7, 0.55, f.yaw);
    case "cooler":
      return [f.x - 0.2, f.z - 0.2, f.x + 0.2, f.z + 0.2];
    case "lamp":
      return [f.x - 0.2, f.z - 0.2, f.x + 0.2, f.z + 0.2];
    case "whiteboard":
    case "screen":
    case "rug":
      return null;
  }
}

/** Chair footprint (tucked in). The back sits a little behind the seat centre. */
export function chairRect(s: SeatAnchor, pulled = 0): Rect | null {
  if (s.kind === "sofa") return null;
  const size = s.kind === "armchair" ? 0.86 : 0.58;
  const c = offset(s.position, s.facingYaw, s.kind === "armchair" ? 0 : -0.04 - pulled);
  return footprint(c[0], c[1], size, size, s.facingYaw);
}

// ---------------------------------------------------------------- entrance and garden

export const BOOTH = { x: 4.8, z: 13.6, w: 2.4, d: 2.0, h: 2.5 };
/** Big sage-green name board on posts just outside the boundary wall, west of the gate. */
export const NAME_BOARD = { x: -6.2, z: 16.45, w: 5.8, h: 1.7 };
/** Glass canopy over the main doors, on two posts standing in the hedges. */
export const CANOPY = { z0: 10.15, z1: 12.2, x: 2.6 };

export type GardenItem =
  | { kind: "tree"; x: number; z: number; s: number }
  | { kind: "lamp"; x: number; z: number }
  | { kind: "hedge"; x: number; z: number; w: number; d: number }
  | { kind: "flowers"; x: number; z: number; w: number; d: number; color: string }
  | { kind: "bikeRack"; x: number; z: number }
  | { kind: "bench"; x: number; z: number; yaw: number };

export const garden: GardenItem[] = [
  { kind: "hedge", x: -2.6, z: 11.9, w: 0.5, d: 2.6 },
  { kind: "hedge", x: 2.6, z: 11.9, w: 0.5, d: 2.6 },
  { kind: "flowers", x: -7.5, z: 12.4, w: 4.2, d: 1.3, color: "#E58C8A" },
  { kind: "flowers", x: -14.5, z: 12.4, w: 4.2, d: 1.3, color: "#F2C14E" },
  { kind: "flowers", x: 11.5, z: 12.2, w: 4.0, d: 1.2, color: "#C98AD6" },
  { kind: "flowers", x: 18.5, z: 12.2, w: 4.0, d: 1.2, color: "#E58C8A" },
  { kind: "lamp", x: -5.2, z: 14.6 },
  { kind: "lamp", x: 8.6, z: 14.6 },
  { kind: "bikeRack", x: -5.2, z: 10.95 },
  { kind: "bench", x: -10.8, z: 14.9, yaw: Math.PI },
  ...(
    [
      [-11, 14.3, 1.0], [-18.5, 13.4, 1.15], [-23, 12.6, 1.0], [12.6, 14.4, 1.0], [17.6, 14.5, 1.1], [22.8, 12.9, 1.0],
      [-23, 4, 1.1], [-23, -6, 1.0], [-23, -16, 1.15], [23, 4, 1.0], [23, -6, 1.1], [23, -16, 1.0],
      [-15, -21.2, 1.0], [-5, -21.3, 0.9], [5, -21.3, 1.0], [15, -21.2, 0.95],
    ] as [number, number, number][]
  ).map(([x, z, s]): GardenItem => ({ kind: "tree", x, z, s })),
];

export function gardenRect(g: GardenItem): Rect | null {
  switch (g.kind) {
    case "tree":
      return [g.x - 0.35, g.z - 0.35, g.x + 0.35, g.z + 0.35];
    case "lamp":
      return [g.x - 0.15, g.z - 0.15, g.x + 0.15, g.z + 0.15];
    case "hedge":
      return [g.x - g.w / 2, g.z - g.d / 2, g.x + g.w / 2, g.z + g.d / 2];
    case "bikeRack":
      return [g.x - 0.9, g.z - 0.3, g.x + 0.9, g.z + 0.3];
    case "bench":
      return footprint(g.x, g.z, 1.6, 0.6, g.yaw);
    case "flowers":
      return null;
  }
}

// ---------------------------------------------------------------- places

export type Place = {
  id: PlaceId;
  /** Floor that counts as being in the place. */
  zone: Rect;
  /** Walking into this rectangle on your own starts the sit-down (departments only). */
  tableZone?: Rect;
};

export const placeInfo: Record<PlaceId, Place> = {
  reception: { id: "reception", zone: [-9, 0, 9, 10] },
  work: { id: "work", zone: [-21, -10, -9, 0], tableZone: [-17.8, -6.8, -12.6, -3.2] },
  design: { id: "design", zone: [-21, -19, -9, -10], tableZone: [-16.9, -16.4, -13.1, -12.6] },
  tech: { id: "tech", zone: [9, 0, 21, 10], tableZone: [12.6, 2.3, 17.2, 5.1] },
  meet: { id: "meet", zone: [9, -10, 21, 0], tableZone: [12.4, -6.8, 18.4, -3.2] },
  ops: { id: "ops", zone: [9, -19, 21, -10], tableZone: [14.3, -16.2, 17.7, -12.8] },
  lounge: { id: "lounge", zone: [-21, 0, -9, 10], tableZone: [-21, 3.0, -15.6, 7.0] },
  boss: { id: "boss", zone: [-6, -19, 6, -11], tableZone: [-2.4, -17.6, 2.4, -14.2] },
};

/** Which department floor a point is on, if any. */
export function deptAt(x: number, z: number): DeptId | null {
  for (const id of doorIds) {
    const r = placeInfo[id].zone;
    if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return id;
  }
  return null;
}

// ---------------------------------------------------------------- key spots

/** The visitor starts on the far pavement across the main street. */
export const START: V2 = [0, 28.1];
export const KERB_FAR: V2 = [0, 26.6];
export const KERB_NEAR: V2 = [0, 18.4];
export const GATE_OUT: V2 = [0, 17.3];
export const GATE_IN: V2 = [0, 14.7];
export const ENTRANCE_OUT: V2 = [0, 11.2];
export const ENTRANCE_IN: V2 = [0, 8.9];
/** In front of the reception desk, facing north. */
export const RECEPTION_SPOT: V2 = [0, 6.45];
export const KNOCK_SPOT: V2 = [0, -10.5];
/** Where the guard stands beside the booth, and the yaw that watches the gate. */
export const GUARD_SPOT: V2 = [3.15, 14.85];
export const GUARD_YAW = -2.3;

/** Points every guided route may start or end at; scripts/check-routes.ts tests every pair. */
export function standPoints(): { id: string; p: V2 }[] {
  const pts: { id: string; p: V2 }[] = [
    { id: "start", p: START },
    { id: "kerb-near", p: KERB_NEAR },
    { id: "gate-out", p: GATE_OUT },
    { id: "gate-in", p: GATE_IN },
    { id: "entrance-out", p: ENTRANCE_OUT },
    { id: "entrance-in", p: ENTRANCE_IN },
    { id: "reception-spot", p: RECEPTION_SPOT },
    { id: "knock", p: KNOCK_SPOT },
  ];
  for (const d of doorIds) {
    pts.push({ id: `${d}-door-out`, p: doors[d].out });
    pts.push({ id: `${d}-door-in`, p: doors[d].inn });
  }
  for (const s of seats) if (s.role === "visitor" || s.role === "reception" || s.role === "admin" || s.role === "boss") pts.push({ id: `seat-${s.id}`, p: s.approachPoint });
  return pts;
}
