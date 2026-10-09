export type V2 = [number, number]; // [x, z] on the floor plane (metres)
export type Rect = [number, number, number, number]; // [x0, z0, x1, z1]
export type RoomId = "work" | "tech" | "ops" | "meet" | "boss";

/** Key places. x grows east (right), z grows south (towards the camera). */
export const START: V2 = [0, 22];
export const GATE_OUT: V2 = [0, 12.4];
export const GATE_IN: V2 = [0, 9];
export const LOBBY: V2 = [0, 7.7];
export const DESK_BACK: V2 = [0, 4.2];

export type WallKind = "low" | "glass";
export type Wall = { a: V2; b: V2; kind: WallKind };

/** Clear width of every room doorway. */
export const DOOR_W = 1.6;

// Building shell is x:-18..18, z:-16..10. Camera looks north (towards -z).
export const walls: Wall[] = [
  // perimeter (low cream walls with wood coping), gate gap at x -2..2 on the south side
  { a: [-18, 10], b: [-2, 10], kind: "low" },
  { a: [2, 10], b: [18, 10], kind: "low" },
  { a: [-18, 10], b: [-18, -16], kind: "low" },
  { a: [18, 10], b: [18, -16], kind: "low" },
  { a: [-18, -16], b: [18, -16], kind: "low" },
  // west rooms: Work Studio (z -6.5..2) and Operations (z -16..-6.5); doorways at z -2 and z -11
  { a: [-18, 2], b: [-7, 2], kind: "glass" },
  { a: [-18, -6.5], b: [-7, -6.5], kind: "glass" },
  { a: [-7, 2], b: [-7, -1.2], kind: "glass" },
  { a: [-7, -2.8], b: [-7, -6.5], kind: "glass" },
  { a: [-7, -6.5], b: [-7, -10.2], kind: "glass" },
  { a: [-7, -11.8], b: [-7, -16], kind: "glass" },
  // east rooms: Tech Lab and Meeting Room
  { a: [18, 2], b: [7, 2], kind: "glass" },
  { a: [18, -6.5], b: [7, -6.5], kind: "glass" },
  { a: [7, 2], b: [7, -1.2], kind: "glass" },
  { a: [7, -2.8], b: [7, -6.5], kind: "glass" },
  { a: [7, -6.5], b: [7, -10.2], kind: "glass" },
  { a: [7, -11.8], b: [7, -16], kind: "glass" },
  // boss cabin, doorway at x -0.8..0.8
  { a: [-5, -9], b: [-0.8, -9], kind: "glass" },
  { a: [0.8, -9], b: [5, -9], kind: "glass" },
  { a: [-5, -9], b: [-5, -16], kind: "glass" },
  { a: [5, -9], b: [5, -16], kind: "glass" },
];

export const WALL_T = 0.18;

export type Door = {
  id: RoomId;
  /** Centre of the doorway on the wall line. */
  c: V2;
  /** Hinge post; the closed leaf runs from here along `dir`. */
  hinge: V2;
  dir: V2;
  /** Leaf rotation about Y (radians) when pushed fully open into the room. */
  swing: number;
  /** Where a visitor stands to open it from the corridor side, and the yaw that faces the door. */
  out: V2;
  face: number;
  /** The same spot on the room side, and the yaw that faces the door from inside. */
  inn: V2;
  faceIn: number;
  /** Point in the corridor that is clear of the outward swing, for closing the door behind you. */
  clear: V2;
  /** Blocks the doorway while the leaf is shut. */
  rect: Rect;
};

export const doors: Record<RoomId, Door> = {
  work: { id: "work", c: [-7, -2], hinge: [-7, -2.8], dir: [0, 1], swing: -1.7, out: [-5.95, -2], face: -Math.PI / 2, inn: [-8.05, -2], faceIn: Math.PI / 2, clear: [-4.2, -2], rect: [-7.1, -2.8, -6.9, -1.2] },
  tech: { id: "tech", c: [7, -2], hinge: [7, -2.8], dir: [0, 1], swing: 1.7, out: [5.95, -2], face: Math.PI / 2, inn: [8.05, -2], faceIn: -Math.PI / 2, clear: [4.2, -2], rect: [6.9, -2.8, 7.1, -1.2] },
  ops: { id: "ops", c: [-7, -11], hinge: [-7, -11.8], dir: [0, 1], swing: -1.7, out: [-5.95, -11], face: -Math.PI / 2, inn: [-8.05, -11], faceIn: Math.PI / 2, clear: [-6, -9.5], rect: [-7.1, -11.8, -6.9, -10.2] },
  meet: { id: "meet", c: [7, -11], hinge: [7, -11.8], dir: [0, 1], swing: 1.7, out: [5.95, -11], face: Math.PI / 2, inn: [8.05, -11], faceIn: -Math.PI / 2, clear: [6, -9.5], rect: [6.9, -11.8, 7.1, -10.2] },
  boss: { id: "boss", c: [0, -9], hinge: [-0.8, -9], dir: [1, 0], swing: 1.7, out: [0, -7.95], face: Math.PI, inn: [0, -10.05], faceIn: 0, clear: [0, -6.6], rect: [-0.8, -9.1, 0.8, -8.9] },
};

/** Open-plan workstations: desk centre, chair sits to the south, person faces north. */
export const workstations: { x: number; z: number; seated: boolean; shirt: string }[] = [
  { x: -3.8, z: 0.4, seated: true, shirt: "#C98A6B" },
  { x: -5.9, z: 0.4, seated: true, shirt: "#6E8F83" },
  { x: -3.8, z: -4.6, seated: true, shirt: "#8D7BA8" },
  { x: -5.9, z: -4.6, seated: false, shirt: "#C98A6B" },
  { x: 3.8, z: 0.4, seated: true, shirt: "#D9B24C" },
  { x: 5.9, z: 0.4, seated: false, shirt: "#6E8F83" },
  { x: 3.8, z: -4.6, seated: true, shirt: "#C98A6B" },
  { x: 5.9, z: -4.6, seated: true, shirt: "#5F83B1" },
];

const desk = (x: number, z: number): Rect => [x - 0.85, z - 0.45, x + 0.85, z + 0.45];
const chair = (x: number, z: number): Rect => [x - 0.3, z - 0.3, x + 0.3, z + 0.3];
const plant = (x: number, z: number, s = 1): Rect => [x - 0.42 * s, z - 0.42 * s, x + 0.42 * s, z + 0.42 * s];
const tree = (x: number, z: number): Rect => [x - 0.5, z - 0.5, x + 0.5, z + 0.5];

/** Every solid piece of furniture, in the same places the scene draws it. */
const staticBlocks: Rect[] = [
  // outside: security booth, planters, parked cars, trees
  [3.9, 11.4, 6.1, 13.6],
  [2.55, 10.75, 3.25, 11.45], // security guard at the gate
  ...[-14, -9, 9, 14].map((x) => plant(x, 11.4, 1.1)),
  ...[-8, -4, 4, 8].map((x): Rect => [x - 0.5, 19.5, x + 0.5, 20.5]),
  [-16.1, 33.4, -11.9, 35.4],
  [13.9, 30.6, 18.1, 32.6],
  [-26.1, 30.6, -21.9, 32.6],
  ...[
    [-26, 14], [-21, 16], [21, 18], [26, 14], [-30, 16], [30, 18],
    [-26, -6], [-24, -8], [24, -10], [26, -12], [-28, -14], [28, -16],
  ].map(([x, z]) => tree(x, z)),
  // lobby
  [-2.7, 4.65, 2.7, 5.95], // reception desk
  [-10.6, 4.65, -9.45, 7.35], // sofas
  [9.45, 4.65, 10.6, 7.35],
  [-9, 5.4, -7.8, 6.6], // coffee tables
  [7.8, 5.4, 9, 6.6],
  plant(-16.5, 8.6, 1.3),
  plant(16.5, 8.6, 1.3),
  plant(-4.6, 7.4, 1.1),
  plant(4.6, 7.4, 1.1),
  // open office
  ...workstations.map((w) => desk(w.x, w.z)),
  ...workstations.map((w) => chair(w.x, w.z + 0.95)),
  plant(-6.4, 2.9, 1.1),
  plant(6.4, 2.9, 1.1),
  // Work Studio
  [-17.3, -6.5, -7.7, -6],
  [-15.4, -3.2, -13.4, -2.2],
  [-12.2, -3.2, -10.2, -2.2],
  chair(-14.4, -1.5),
  chair(-11.2, -1.5),
  [-17.7, -1.5, -17.1, 0.5],
  plant(-17, 1.2, 1.1),
  plant(-8.2, -5.4, 0.9),
  // Tech Lab
  [8.7, -6.4, 15.2, -5.5],
  [10, -1.4, 14, -0.4],
  chair(11, 0.5),
  [14.1, -3.6, 17.1, -3.2],
  plant(17, 1.2, 1.1),
  plant(8, 1.1, 0.9),
  // Operations
  [-17.2, -15.6, -8.2, -14.8],
  [-14.4, -11.6, -11.4, -10.4],
  chair(-12.9, -12.1),
  [-17.8, -9.8, -17.2, -8.2],
  [-17.8, -11.6, -17.2, -10],
  plant(-8.1, -14.7, 1),
  // Meeting room (table and the chairs tucked around it)
  [10.1, -12.6, 14.9, -9.4],
  [8, -15.8, 16, -15],
  plant(17, -7.4, 1.1),
  plant(17, -14.8, 1),
  // Boss cabin
  [-2, -15.3, 2, -13.2],
  [-4.8, -15.9, 4.8, -15.2],
  [-4.75, -12.05, -3.75, -9.95],
  plant(4.2, -9.9, 1.2),
  plant(4.2, -14.4, 1),
];

/** Walls become thin blocking rectangles. */
function wallRect(w: Wall): Rect {
  const [ax, az] = w.a;
  const [bx, bz] = w.b;
  const t = WALL_T / 2 + 0.05;
  return [Math.min(ax, bx) - t, Math.min(az, bz) - t, Math.max(ax, bx) + t, Math.max(az, bz) + t];
}

export const colliders: Rect[] = [...walls.map(wallRect), ...staticBlocks];
/** Blocks the gate gap until security opens it. */
export const gateRect: Rect = [-2, 9.7, 2, 10.3];

export type Room = {
  id: RoomId;
  name: string;
  /** Floor area that counts as being "in" the room (used for walking in on your own). */
  zone: Rect;
  /** Open floor inside the room where a visit ends. */
  dest: V2;
};

export const rooms: Record<RoomId, Room> = {
  work: { id: "work", name: "Work Studio", zone: [-17.5, -6.2, -7.4, 1.8], dest: [-9.6, -1.4] },
  tech: { id: "tech", name: "Tech Lab", zone: [7.4, -6.2, 17.5, 1.8], dest: [10.6, -2.6] },
  ops: { id: "ops", name: "Operations", zone: [-17.5, -15.6, -7.4, -6.8], dest: [-9.8, -11] },
  meet: { id: "meet", name: "Meeting Room", zone: [7.4, -15.6, 17.5, -6.8], dest: [9.3, -11] },
  boss: { id: "boss", name: "Boss Cabin", zone: [-4.8, -15.6, 4.8, -9.3], dest: [0, -11.8] },
};

export const roomOrder: RoomId[] = ["work", "tech", "ops", "meet", "boss"];

export function inRect(x: number, z: number, r: Rect, pad = 0) {
  return x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad;
}

/** Which room's floor a point is on, if any. */
export function roomAt(x: number, z: number): RoomId | null {
  let found: RoomId | null = null;
  for (const id of roomOrder) if (inRect(x, z, rooms[id].zone)) found = id;
  return found;
}
