import { DESK_BACK, GATE_OUT, START, colliders, doors, gateRect, inRect, roomAt, roomOrder, type RoomId, type V2 } from "./layout";
import { findPath } from "./nav";

export class Actor {
  x: number;
  z: number;
  yaw: number;
  moving = false;
  /** Seconds left of the "reach out and push the door / knock" gesture. */
  reach = 0;
  /** Whether this actor is on stage (the guide hides while the receptionist sits at the desk). */
  active = true;
  idx = 0;
  constructor(p: V2, yaw = 0) {
    this.x = p[0];
    this.z = p[1];
    this.yaw = yaw;
  }
}

export type Step =
  | { t: "walk"; path: V2[]; guide?: V2[]; lead?: number }
  | { t: "turn"; yaw: number }
  | { t: "wait"; ms: number }
  | { t: "fn"; fn: () => void };

export type DoorState = {
  /** -1 = swung out into the corridor, 0 = shut, 1 = swung into the room. */
  open: number;
  target: -1 | 0 | 1;
  /** Delay before the leaf starts moving, so the hand reaches the handle first. */
  lag: number;
};

const SPEED = 3;
const RADIUS = 0.34;
const DOOR_TIME = 0.6;
const REACH_TIME = 0.9;

function turn(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function angleGap(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Runs scripted walks (intro, guided visits) and, when idle, free movement.
 * Pure TypeScript so it can be driven from the render loop and from React handlers alike.
 */
export class Director {
  player = new Actor(START, Math.PI);
  guide = new Actor(DESK_BACK, 0);
  gateOpen = false;
  door = Object.fromEntries(roomOrder.map((id) => [id, { open: 0, target: 0, lag: 0 } as DoorState])) as Record<RoomId, DoorState>;
  keys = { up: false, down: false, left: false, right: false };
  zone: RoomId | null = null;
  onZone?: (z: RoomId | null) => void;

  private route: V2[] | null = null;
  private routeIdx = 0;
  private steps: Step[] = [];
  private cur: Step | null = null;
  private waitLeft = 0;
  private delayLeft = 0;
  private turnLeft = 0;
  private pDone = false;
  private gDone = true;
  private guideHome: V2[] | null = null;

  constructor() {
    this.guide.active = false;
    this.player.yaw = Math.PI; // facing north (-z) is yaw = PI with forward = +z local
  }

  setGate(open: boolean) {
    this.gateOpen = open;
  }

  /** The player pushes a door open (into the room, or out into the corridor when leaving). */
  openDoor(id: RoomId, side: 1 | -1 = 1, by: Actor = this.player) {
    const s = this.door[id];
    if (s.target === side) return;
    s.target = side;
    s.lag = 0.35;
    by.reach = REACH_TIME;
  }

  closeDoor(id: RoomId) {
    const s = this.door[id];
    s.target = 0;
    s.lag = 0;
  }

  setZoneHandler(fn?: (z: RoomId | null) => void) {
    this.onZone = fn;
  }

  setKey(k: keyof Director["keys"], v: boolean) {
    this.keys[k] = v;
  }

  /** Tap-to-walk: plans a clear route around furniture and follows it. */
  moveTo(x: number, z: number) {
    const p = this.player;
    this.route = findPath([p.x, p.z], [x, z]);
    this.routeIdx = 1;
  }

  placePlayer(p: V2) {
    this.player.x = p[0];
    this.player.z = p[1];
  }

  /** Bring the receptionist out from behind the desk. */
  summonGuide() {
    const g = this.guide;
    this.guideHome = null;
    g.active = true;
    g.x = DESK_BACK[0];
    g.z = DESK_BACK[1];
    g.yaw = 0;
  }

  /** The receptionist walks back to her desk by herself, then sits down. */
  sendGuideHome() {
    const g = this.guide;
    if (!g.active) return;
    this.guideHome = findPath([g.x, g.z], DESK_BACK);
    g.idx = 1;
  }

  get busy() {
    return this.cur !== null;
  }

  run(steps: Step[]) {
    this.steps = steps.slice();
    this.cur = null;
    this.route = null;
    this.advance();
  }

  private advance() {
    for (;;) {
      const s = this.steps.shift();
      if (!s) {
        this.cur = null;
        this.player.moving = false;
        if (!this.guideHome) this.guide.moving = false;
        return;
      }
      if (s.t === "fn") {
        s.fn();
        continue;
      }
      this.cur = s;
      if (s.t === "wait") this.waitLeft = s.ms / 1000;
      else if (s.t === "turn") this.turnLeft = 1.2;
      else {
        this.player.idx = 1;
        this.guide.idx = 1;
        this.delayLeft = s.lead ?? 0;
        this.pDone = false;
        this.gDone = !s.guide;
      }
      return;
    }
  }

  /** Finish every remaining step immediately. */
  skip() {
    let guard = 0;
    while ((this.cur || this.steps.length) && guard++ < 80) {
      const c = this.cur;
      if (c && c.t === "walk") {
        const e = c.path[c.path.length - 1];
        this.player.x = e[0];
        this.player.z = e[1];
        if (c.guide) {
          const g = c.guide[c.guide.length - 1];
          this.guide.x = g[0];
          this.guide.z = g[1];
        }
      } else if (c && c.t === "turn") {
        this.player.yaw = c.yaw;
      }
      this.advance();
    }
    for (const id of roomOrder) {
      this.door[id].open = this.door[id].target;
      this.door[id].lag = 0;
    }
  }

  private follow(a: Actor, path: V2[], dt: number, speed = SPEED): boolean {
    while (a.idx < path.length) {
      const p = path[a.idx];
      const dx = p[0] - a.x;
      const dz = p[1] - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        a.idx++;
        continue;
      }
      const step = Math.min(d, speed * dt);
      a.x += (dx / d) * step;
      a.z += (dz / d) * step;
      a.yaw = turn(a.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
      a.moving = true;
      return true;
    }
    a.moving = false;
    return false;
  }

  /** Closed doors and the closed gate stop anyone walking into them. */
  private shut(x: number, z: number) {
    if (!this.gateOpen && inRect(x, z, gateRect, RADIUS)) return true;
    for (const id of roomOrder) {
      if (Math.abs(this.door[id].open) < 0.55 && inRect(x, z, doors[id].rect, RADIUS)) return true;
    }
    return false;
  }

  private blocked(x: number, z: number) {
    if (x < -30 || x > 30 || z < -19 || z > 40) return true;
    if (this.shut(x, z)) return true;
    for (const r of colliders) if (inRect(x, z, r, RADIUS)) return true;
    return false;
  }

  private tickDoors(dt: number) {
    for (const id of roomOrder) {
      const s = this.door[id];
      if (s.lag > 0) {
        s.lag -= dt;
        continue;
      }
      const d = s.target - s.open;
      const step = dt / DOOR_TIME;
      s.open = Math.abs(d) <= step ? s.target : s.open + Math.sign(d) * step;
    }
  }

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    this.tickDoors(dt);
    this.player.reach = Math.max(0, this.player.reach - dt);
    this.guide.reach = Math.max(0, this.guide.reach - dt);
    if (this.guideHome) {
      if (!this.follow(this.guide, this.guideHome, dt, SPEED * 0.85)) {
        this.guideHome = null;
        this.guide.active = false;
      }
    }
    const c = this.cur;
    if (c) {
      if (c.t === "wait") {
        this.waitLeft -= dt;
        this.player.moving = false;
        if (!this.guideHome) this.guide.moving = false;
        if (this.waitLeft <= 0) this.advance();
        return;
      }
      if (c.t === "turn") {
        const p = this.player;
        p.moving = false;
        this.turnLeft -= dt;
        p.yaw = turn(p.yaw, c.yaw, Math.min(1, dt * 9));
        if (angleGap(p.yaw, c.yaw) < 0.05 || this.turnLeft <= 0) this.advance();
        return;
      }
      const w = c as Extract<Step, { t: "walk" }>;
      if (w.guide && !this.gDone) this.gDone = !this.follow(this.guide, w.guide, dt);
      if (this.delayLeft > 0) {
        this.delayLeft -= dt;
        this.player.moving = false;
      } else if (!this.pDone) {
        this.pDone = !this.follow(this.player, w.path, dt);
      }
      if (this.pDone && this.gDone && this.delayLeft <= 0) this.advance();
      return;
    }
    this.free(dt);
  }

  /** Doors swing open by themselves when the walker reaches for them. */
  private autoDoors() {
    const p = this.player;
    for (const id of roomOrder) {
      const d = doors[id];
      const s = this.door[id];
      const dist = Math.hypot(p.x - d.c[0], p.z - d.c[1]);
      if (dist < 1.9 && s.target === 0) {
        const inside = (p.x - d.c[0]) * (d.inn[0] - d.c[0]) + (p.z - d.c[1]) * (d.inn[1] - d.c[1]) > 0;
        this.openDoor(id, inside ? -1 : 1);
      } else if (dist > 2.6 && s.target !== 0) this.closeDoor(id);
    }
  }

  private free(dt: number) {
    const p = this.player;
    this.autoDoors();
    const dx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const dz = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    if (dx || dz) {
      this.route = null;
      const len = Math.hypot(dx, dz);
      const nx = p.x + (dx / len) * SPEED * dt;
      const nz = p.z + (dz / len) * SPEED * dt;
      let moved = false;
      if (!this.blocked(nx, p.z)) {
        p.x = nx;
        moved = true;
      }
      if (!this.blocked(p.x, nz)) {
        p.z = nz;
        moved = true;
      }
      p.yaw = turn(p.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
      p.moving = moved;
    } else if (this.route) {
      p.idx = this.routeIdx;
      const tx = this.route[Math.min(p.idx, this.route.length - 1)];
      const ahead = Math.hypot(tx[0] - p.x, tx[1] - p.z) || 1;
      const probeX = p.x + ((tx[0] - p.x) / ahead) * 0.3;
      const probeZ = p.z + ((tx[1] - p.z) / ahead) * 0.3;
      if (this.shut(probeX, probeZ)) {
        p.moving = false; // wait for the door to swing open
      } else if (!this.follow(p, this.route, dt)) {
        this.route = null;
      }
      this.routeIdx = p.idx;
    } else p.moving = false;

    const z = roomAt(p.x, p.z);
    if (z !== this.zone) {
      this.zone = z;
      this.onZone?.(z);
    }
  }

  /** Put the player back outside the gate. */
  reset() {
    this.player.x = START[0];
    this.player.z = START[1];
    this.player.yaw = Math.PI;
    this.gateOpen = false;
    for (const id of roomOrder) this.door[id] = { open: 0, target: 0, lag: 0 };
    this.guide.active = false;
    this.guideHome = null;
    this.zone = null;
  }
}

export { GATE_OUT };
