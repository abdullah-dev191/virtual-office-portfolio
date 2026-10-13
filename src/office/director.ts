/**
 * The director runs everything people do in the office: the walk in from the street, guided visits behind the
 * receptionist, opening doors, knocking, sitting down and standing up, and free walking with collisions.
 * Plain TypeScript (no React): the scene reads its state every frame and the UI listens to its events.
 */
import { departments, type DeptId, type PlaceId } from "@/content/departments";
import { groundY } from "./city";
import { clearanceAt } from "./colliders";
import { angleGap, clamp, dist, inRect, offset, rectDist, smooth, turnToward, wrapAngle, yawTo, type V2 } from "./geom";
import {
  BUILDING,
  ENTRANCE,
  GATE,
  GUARD_SPOT,
  GUARD_YAW,
  KERB_FAR,
  KERB_NEAR,
  KNOCK_SPOT,
  PULL,
  RECEPTION_SPOT,
  START,
  deptAt,
  doorIds,
  doors,
  placeInfo,
  seatById,
  seats,
  visitorSeat,
  type SeatAnchor,
} from "./layout";
import { findPath, findStrictPath, stepAside } from "./nav";
import { SIT_START, clipLength, setAnim, sexOf, walkSpeed, type ClipName, type Puppet, type Sex } from "./characters/rig";
import { seatCast } from "./characters/roster";
import type { Traffic } from "./traffic";

/** Walking speed for guided walks (m/s); clips are sped up to match so feet stay planted. */
export const WALK = 1.45;
const FREE_WALK = 1.7;
const BODY_R = 0.28;
const DOOR_SWING = 1.2;
const GATE_SWING = 1.6;

export type Phase = "intro" | "reception" | "visit" | "seated" | "free" | "leaving" | "outside";

export class Actor implements Puppet {
  x: number;
  y = 0;
  z: number;
  yaw: number;
  anim: ClipName = "Idle";
  animKey = 0;
  rate = 1;
  look: [number, number, number] | null = null;
  visible = true;
  bubble: string | null = null;
  /** Seat the actor is sitting on. */
  seat: SeatAnchor | null = null;
  /** Distance covered in the current walk, and its total length (used to lead and follow). */
  walked = 0;
  walkTotal = 0;
  /** Speed over the last frame, for the camera's look-ahead. */
  vx = 0;
  vz = 0;
  constructor(
    public id: string,
    public sex: Sex,
    p: V2,
    yaw = 0,
  ) {
    this.x = p[0];
    this.z = p[1];
    this.yaw = yaw;
  }
  get pos(): V2 {
    return [this.x, this.z];
  }
  head(): [number, number, number] {
    const seated = this.anim.startsWith("Sit") || this.anim === "StandUp";
    return [this.x, this.y + (seated ? 1.12 : 1.6), this.z];
  }
}

export type Step =
  | { t: "walk"; a: Actor; path: V2[]; speed?: number; follow?: Actor; gap?: number; after?: Actor; lead?: number; doors?: boolean }
  | { t: "turn"; a: Actor; yaw: number }
  | { t: "anim"; a: Actor; clip: ClipName; hold?: number }
  | { t: "wait"; ms: number }
  | { t: "until"; test: () => boolean; max?: number }
  | { t: "fn"; fn: () => void }
  | { t: "par"; lanes: Step[][] }
  | { t: "move"; a: Actor; to: V2; dur: number; yaw?: number }
  | { t: "chair"; seat: string; to: number; dur: number; carry?: Actor }
  | { t: "lazy"; make: () => Step[] };

interface Task {
  update(dt: number): boolean;
  finish(): void;
}

type DoorState = { open: number; target: 0 | 1; lag: number; idle: number };

type Events = {
  phase: Phase;
  place: PlaceId | null;
  seated: DeptId;
  stood: DeptId;
  status: string;
};
type Listener<K extends keyof Events> = (v: Events[K]) => void;

function walkAnim(a: Actor, v: number) {
  if (v > 0.05) {
    if (a.anim !== "Walk") setAnim(a, "Walk", v / walkSpeed(a.sex));
    else a.rate = v / walkSpeed(a.sex);
  } else if (a.anim !== "Idle" && !a.seat) setAnim(a, "Idle");
}

class Runner {
  private queue: Step[];
  private cur: Task | null = null;
  constructor(
    steps: Step[],
    private d: Director,
  ) {
    this.queue = steps.slice();
  }
  get done() {
    return !this.cur && this.queue.length === 0;
  }
  update(dt: number): boolean {
    for (let guard = 0; guard < 64; guard++) {
      if (!this.cur) {
        const s = this.queue.shift();
        if (!s) return true;
        this.cur = this.d.task(s);
      }
      if (this.cur.update(dt)) {
        this.cur = null;
        dt = 0;
        continue;
      }
      return false;
    }
    return false;
  }
  finish() {
    for (let guard = 0; guard < 800; guard++) {
      if (!this.cur) {
        const s = this.queue.shift();
        if (!s) return;
        this.cur = this.d.task(s);
      }
      this.cur.finish();
      this.cur = null;
    }
  }
}

export class Director {
  visitor: Actor;
  receptionist: Actor;
  guard: Actor;
  boss: Actor;
  /** Everyone seated when the office opens (receptionist, hosts, staff, the boss). */
  npcs: Actor[] = [];
  hosts: Partial<Record<DeptId, Actor>> = {};
  doors = Object.fromEntries(doorIds.map((id) => [id, { open: 0, target: 0, lag: 0, idle: 0 }])) as Record<DeptId, DoorState>;
  gate = { open: 0, target: 0 as 0 | 1 };
  entrance = { open: 0 };
  /** How far each chair is pulled out (0 = tucked in). */
  chairs = new Map<string, number>();
  phase: Phase = "intro";
  place: PlaceId | null = null;
  keys = { up: false, down: false, left: false, right: false };
  traffic: Traffic | null = null;
  reducedMotion = false;
  time = 0;

  private main: Runner | null = null;
  private side = new Map<Actor, Runner>();
  private speech = new Map<Actor, number>();
  private idleSwap = new Map<Actor, number>();
  private listeners: { [K in keyof Events]?: Listener<K>[] } = {};
  private gateWaved = false;
  private freeRoute: Runner | null = null;
  /** Table zone the visitor just stood up in; walking around it must not sit them straight back down. */
  private justLeft: DeptId | null = null;

  constructor(visitorSex: Sex = "m") {
    this.visitor = new Actor("visitor", visitorSex, START, Math.PI);
    this.guard = new Actor("guard", "m", GUARD_SPOT, GUARD_YAW);
    let receptionist: Actor | null = null;
    let boss: Actor | null = null;
    for (const s of seats) {
      if (s.occupant !== "npc") continue;
      const cast = seatCast.get(s.id);
      const sex: Sex = cast ? sexOf(cast.look.body) : "m";
      const a = new Actor(s.id, sex, s.position, s.facingYaw);
      a.seat = s;
      setAnim(a, s.deskId ? "SitTyping" : "SitIdle");
      this.npcs.push(a);
      if (s.id === "reception") receptionist = a;
      if (s.role === "boss") boss = a;
      if (s.role === "admin" || s.role === "boss" || s.role === "guest") this.hosts[s.dept as DeptId] = a;
      this.idleSwap.set(a, 4 + ((s.position[0] * 13.7 + s.position[1] * 7.1) % 9 + 9) % 9);
    }
    this.receptionist = receptionist as Actor;
    this.boss = boss as Actor;
  }

  /** Sex of the visitor's body (their walk clip speed differs). */
  setVisitorSex(sex: Sex) {
    this.visitor.sex = sex;
  }

  // ------------------------------------------------------------ events

  on<K extends keyof Events>(k: K, cb: Listener<K>): () => void {
    const list = (this.listeners[k] ??= []) as Listener<K>[];
    list.push(cb);
    return () => {
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    };
  }
  private emit<K extends keyof Events>(k: K, v: Events[K]) {
    for (const cb of (this.listeners[k] ?? []) as Listener<K>[]) cb(v);
  }
  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.emit("phase", p);
  }
  private status(text: string) {
    this.emit("status", text);
  }

  /** Shows a speech bubble for a while. */
  speak(a: Actor, text: string, ms = 2600) {
    a.bubble = text;
    this.speech.set(a, this.time + ms / 1000);
  }

  // ------------------------------------------------------------ tasks

  task(s: Step): Task {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- task closures need the director
    const d = this;
    switch (s.t) {
      case "fn":
        return {
          update() {
            s.fn();
            return true;
          },
          finish() {
            s.fn();
          },
        };
      case "wait": {
        let left = s.ms / 1000;
        return {
          update(dt) {
            left -= dt;
            return left <= 0;
          },
          finish() {},
        };
      }
      case "until": {
        let t = 0;
        return {
          update(dt) {
            t += dt;
            return s.test() || t * 1000 > (s.max ?? 15000);
          },
          finish() {},
        };
      }
      case "turn": {
        let t = 0;
        return {
          update(dt) {
            t += dt;
            s.a.yaw = turnToward(s.a.yaw, s.yaw, dt * 6);
            if (!s.a.seat && s.a.anim !== "Idle") setAnim(s.a, "Idle");
            return angleGap(s.a.yaw, s.yaw) < 0.02 || t > 1.6;
          },
          finish() {
            s.a.yaw = s.yaw;
          },
        };
      }
      case "anim": {
        let left = -1;
        return {
          update(dt) {
            if (left < 0) {
              setAnim(s.a, s.clip);
              left = s.hold ?? clipLength(s.a.sex, s.clip);
            }
            left -= dt;
            return left <= 0;
          },
          finish() {},
        };
      }
      case "move": {
        let t = 0;
        let from: V2 | null = null;
        let yaw0 = 0;
        return {
          update(dt) {
            const a = s.a;
            if (!from) {
              from = [a.x, a.z];
              yaw0 = a.yaw;
              setAnim(a, "Walk", 0.55);
            }
            t = Math.min(1, t + dt / s.dur);
            const k = smooth(t);
            a.x = from[0] + (s.to[0] - from[0]) * k;
            a.z = from[1] + (s.to[1] - from[1]) * k;
            if (s.yaw !== undefined) a.yaw = yaw0 + wrapAngle(s.yaw - yaw0) * k;
            if (t >= 1) setAnim(a, "Idle");
            return t >= 1;
          },
          finish() {
            s.a.x = s.to[0];
            s.a.z = s.to[1];
            if (s.yaw !== undefined) s.a.yaw = s.yaw;
          },
        };
      }
      case "chair": {
        let t = 0;
        let from = -1;
        const seat = seatById.get(s.seat) as SeatAnchor;
        const place = (v: number) => {
          d.chairs.set(s.seat, v);
          if (s.carry) {
            const p = offset(seat.position, seat.facingYaw, -v);
            s.carry.x = p[0];
            s.carry.z = p[1];
          }
        };
        return {
          update(dt) {
            if (from < 0) from = d.chairs.get(s.seat) ?? 0;
            t = Math.min(1, t + dt / s.dur);
            place(from + (s.to - from) * smooth(t));
            return t >= 1;
          },
          finish() {
            place(s.to);
          },
        };
      }
      case "par": {
        let runners: Runner[] | null = null;
        return {
          update(dt) {
            runners ??= s.lanes.map((l) => new Runner(l, d));
            let all = true;
            for (const r of runners) if (!r.update(dt)) all = false;
            return all;
          },
          finish() {
            runners ??= s.lanes.map((l) => new Runner(l, d));
            for (const r of runners) r.finish();
          },
        };
      }
      case "lazy": {
        let r: Runner | null = null;
        return {
          update(dt) {
            r ??= new Runner(s.make(), d);
            return r.update(dt);
          },
          finish() {
            r ??= new Runner(s.make(), d);
            r.finish();
          },
        };
      }
      case "walk":
        return this.walkTask(s);
    }
  }

  private walkTask(s: Extract<Step, { t: "walk" }>): Task {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- task closures need the director
    const d = this;
    const a = s.a;
    let i = 1;
    let started = false;
    let opening: DeptId | null = null;
    const path = s.path;
    let total = 0;
    for (let k = 1; k < path.length; k++) total += dist(path[k - 1], path[k]);
    return {
      update(dt) {
        if (!started) {
          started = true;
          a.walked = 0;
          a.walkTotal = total;
        }
        if (s.after && s.after.walked < Math.min(s.lead ?? 0, Math.max(0.01, s.after.walkTotal - 0.05))) {
          walkAnim(a, 0);
          return false;
        }
        let v = s.speed ?? WALK;
        if (s.follow) v *= clamp((dist(a.pos, s.follow.pos) - (s.gap ?? 1.6)) / 0.7, 0, 1);
        if (s.doors) {
          const door = d.closedDoorAhead(a, path, i, 1.05);
          if (door) {
            if (opening !== door) {
              opening = door;
              d.openDoor(door, a);
            }
            a.yaw = turnToward(a.yaw, yawTo(a.pos, doors[door].centre), dt * 8);
            walkAnim(a, 0);
            if (d.doors[door].open < 0.85) return false;
          }
        }
        let step = v * dt;
        while (step > 1e-6 && i < path.length) {
          const p = path[i];
          const dx = p[0] - a.x;
          const dz = p[1] - a.z;
          const dd = Math.hypot(dx, dz);
          if (dd <= step) {
            a.x = p[0];
            a.z = p[1];
            step -= dd;
            a.walked += dd;
            i++;
          } else {
            a.x += (dx / dd) * step;
            a.z += (dz / dd) * step;
            a.walked += step;
            step = 0;
          }
        }
        const tgt = path[Math.min(i, path.length - 1)];
        if (dist(a.pos, tgt) > 0.02) a.yaw = turnToward(a.yaw, yawTo(a.pos, tgt), dt * 9);
        a.y = groundY(a.x, a.z);
        if (i >= path.length) {
          walkAnim(a, 0);
          return true;
        }
        walkAnim(a, v);
        return false;
      },
      finish() {
        const e = path[path.length - 1];
        a.x = e[0];
        a.z = e[1];
        a.y = groundY(a.x, a.z);
        if (path.length > 1 && dist(path[path.length - 2], e) > 0.01) a.yaw = yawTo(path[path.length - 2], e);
        a.walked = a.walkTotal = total;
        walkAnim(a, 0);
      },
    };
  }

  /** Runs the visitor's script (replacing any running one). */
  run(steps: Step[]) {
    this.freeRoute = null;
    this.main = new Runner(steps, this);
  }
  /** Runs a background script for another actor. */
  runFor(a: Actor, steps: Step[]) {
    this.side.set(a, new Runner(steps, this));
  }
  get busy() {
    return this.main !== null;
  }

  /** Finishes the visitor's script (and the receptionist's) immediately. */
  skip() {
    let guard = 0;
    while (this.main && guard++ < 5) {
      const m = this.main;
      m.finish();
      if (this.main === m) this.main = null;
    }
    for (const [a, r] of this.side) {
      r.finish();
      this.side.delete(a);
    }
    for (const id of doorIds) {
      const s = this.doors[id];
      s.open = s.target;
      s.lag = 0;
    }
    this.gate.open = this.gate.target;
  }

  // ------------------------------------------------------------ doors, gate, chairs

  openDoor(id: DeptId, by?: Actor) {
    const s = this.doors[id];
    if (s.target === 1) return;
    s.target = 1;
    s.lag = by ? 0.4 : 0;
    s.idle = 0;
    if (by) setAnim(by, "Reach");
  }

  doorOpen(id: DeptId) {
    return this.doors[id].open;
  }

  /** The first shut door the walker would bump into within `reach` metres along its route. */
  closedDoorAhead(a: Actor, path: V2[], i: number, reach: number): DeptId | null {
    const pts: V2[] = [a.pos, ...path.slice(i)];
    let left = reach;
    for (let k = 1; k < pts.length && left > 0; k++) {
      const seg = dist(pts[k - 1], pts[k]);
      const n = Math.max(1, Math.ceil(Math.min(seg, left) / 0.1));
      for (let m = 1; m <= n; m++) {
        const u = Math.min(seg, left) * (m / n);
        const x = pts[k - 1][0] + ((pts[k][0] - pts[k - 1][0]) * u) / (seg || 1);
        const z = pts[k - 1][1] + ((pts[k][1] - pts[k - 1][1]) * u) / (seg || 1);
        for (const id of doorIds) if (this.doors[id].open < 0.85 && rectDist(x, z, doors[id].rect) < 0.3) return id;
      }
      left -= seg;
    }
    return null;
  }

  private tickDoors(dt: number) {
    const walkers = [this.visitor, this.receptionist];
    for (const id of doorIds) {
      const s = this.doors[id];
      if (s.lag > 0) s.lag -= dt;
      else s.open = clamp(s.open + Math.sign(s.target - s.open) * (dt / DOOR_SWING), 0, 1);
      if (s.target === 1 && s.open >= 1) {
        const near = walkers.some((w) => dist(w.pos, doors[id].centre) < 2.1);
        s.idle = near ? 0 : s.idle + dt;
        if (s.idle > 0.6) s.target = 0;
      }
    }
    // the gate opens when the visitor walks up to it; the guard waves them through
    const g = this.gate;
    const dGate = dist(this.visitor.pos, [0, GATE.z]);
    const want = dGate < 6.5 && (this.busy || this.phase === "free") ? 1 : dGate > 9 ? 0 : g.target;
    if (want === 1 && g.target === 0 && !this.gateWaved) {
      this.gateWaved = true;
      this.runFor(this.guard, [{ t: "anim", a: this.guard, clip: "Wave" }, { t: "fn", fn: () => setAnim(this.guard, "Idle") }]);
      this.speak(this.guard, "Welcome!", 2000);
    }
    if (want === 0) this.gateWaved = false;
    g.target = want as 0 | 1;
    g.open = clamp(g.open + Math.sign(g.target - g.open) * (dt / GATE_SWING), 0, 1);
    // automatic sliding glass doors
    const nearEntrance = [this.visitor, this.receptionist].some((w) => dist(w.pos, [0, ENTRANCE.z]) < 3.2);
    this.entrance.open = clamp(this.entrance.open + (nearEntrance ? 1 : -1) * dt * 1.8, 0, 1);
  }

  /** Closed doors, the shut gate and the entrance block free walking. */
  private blockedAt(x: number, z: number) {
    if (clearanceAt(x, z) < BODY_R) return true;
    for (const id of doorIds) if (this.doors[id].open < 0.6 && rectDist(x, z, doors[id].rect) < BODY_R) return true;
    if (this.gate.open < 0.7 && rectDist(x, z, GATE.rect) < BODY_R) return true;
    if (this.entrance.open < 0.6 && rectDist(x, z, [ENTRANCE.x0, ENTRANCE.z - 0.12, ENTRANCE.x1, ENTRANCE.z + 0.12]) < BODY_R) return true;
    return false;
  }

  // ------------------------------------------------------------ building blocks

  private walkTo(a: Actor, to: V2, extra: Partial<Extract<Step, { t: "walk" }>> = {}): Step {
    return { t: "walk", a, path: findStrictPath(a.pos, to) ?? findPath(a.pos, to), ...extra };
  }

  /** Builds steps when they are reached, so routes start from wherever the walker really is. */
  private lazy(make: () => Step[]): Step {
    return { t: "lazy", make };
  }

  /** Sit on a seat: face the chair, pull it out, step in front of it, sit, and slide in. */
  sitSteps(a: Actor, s: SeatAnchor): Step[] {
    const chair = s.kind === "chair";
    const pulled = chair ? offset(s.position, s.facingYaw, -PULL) : s.position;
    const standAt = offset(pulled, s.facingYaw, SIT_START);
    const out: Step[] = [{ t: "turn", a, yaw: yawTo(s.approachPoint, pulled) }];
    if (chair) {
      out.push({
        t: "par",
        lanes: [[{ t: "anim", a, clip: "Reach", hold: 0.9 }], [{ t: "wait", ms: 250 }, { t: "chair", seat: s.id, to: PULL, dur: 0.6 }]],
      });
    }
    out.push(
      { t: "move", a, to: standAt, dur: 0.75, yaw: s.facingYaw },
      {
        t: "fn",
        fn: () => {
          // root onto the seat; the clip starts with the hips SIT_START in front of it, where the walker stands
          a.x = pulled[0];
          a.z = pulled[1];
          a.yaw = s.facingYaw;
          a.seat = s;
        },
      },
      { t: "anim", a, clip: "SitDown" },
    );
    if (chair) out.push({ t: "chair", seat: s.id, to: 0, dur: 0.5, carry: a });
    out.push({ t: "fn", fn: () => setAnim(a, s.deskId && a !== this.visitor ? "SitTyping" : "SitIdle") });
    return out;
  }

  /** Stand up: slide the chair back, stand, step out to the approach point and tuck the chair in. */
  standSteps(a: Actor, s: SeatAnchor): Step[] {
    const chair = s.kind === "chair";
    const pulled = chair ? offset(s.position, s.facingYaw, -PULL) : s.position;
    const standAt = offset(pulled, s.facingYaw, SIT_START);
    const out: Step[] = [];
    if (chair) out.push({ t: "chair", seat: s.id, to: PULL, dur: 0.5, carry: a });
    out.push(
      { t: "anim", a, clip: "StandUp" },
      {
        t: "fn",
        fn: () => {
          a.x = standAt[0];
          a.z = standAt[1];
          a.seat = null;
          setAnim(a, "Idle");
        },
      },
      { t: "move", a, to: s.approachPoint, dur: 0.7 },
    );
    if (chair) out.push({ t: "chair", seat: s.id, to: 0, dur: 0.6 });
    return out;
  }

  /** Walk through a department door (in or out), opening it first. */
  private doorSteps(a: Actor, id: DeptId, inward: boolean): Step[] {
    const d = doors[id];
    const from = inward ? d.out : d.inn;
    const to = inward ? d.inn : d.out;
    return [
      this.lazy(() => (dist(a.pos, from) > 0.05 ? [this.walkTo(a, from)] : [])),
      { t: "turn", a, yaw: inward ? d.inYaw : wrapAngle(d.inYaw + Math.PI) },
      {
        t: "fn",
        fn: () => {
          if (this.doors[id].open < 0.85) {
            this.openDoor(id, a);
            this.status(`Opening the ${departments[id].name} door.`);
          }
        },
      },
      { t: "until", test: () => this.doors[id].open > 0.82, max: 3000 },
      { t: "walk", a, path: [from, to] },
    ];
  }

  /** Steps that get the visitor up and out of whatever room they are in. */
  private leaveSteps(): Step[] {
    const v = this.visitor;
    const out: Step[] = [];
    if (v.seat) {
      const s = v.seat;
      out.push(...this.standSteps(v, s), {
        t: "fn",
        fn: () => {
          this.justLeft = s.dept as DeptId;
          this.emit("stood", s.dept as DeptId);
        },
      });
    }
    const here = deptAt(v.x, v.z) ?? (v.seat ? (v.seat.dept as DeptId) : null);
    if (here) out.push(...this.doorSteps(v, here, false));
    return out;
  }

  /** Has the receptionist at her desk and the visitor standing at reception? */
  private canGuide() {
    const r = this.receptionist;
    return r.seat?.id === "reception" && !this.side.has(r) && dist(this.visitor.pos, RECEPTION_SPOT) < 3.5 && !this.visitor.seat;
  }

  private hostReact(dept: DeptId) {
    const host = this.hosts[dept];
    if (!host) return;
    const v = this.visitor;
    host.look = v.head();
    this.speak(host, departments[dept].greeting, 3200);
    setAnim(host, "SitTalk");
    this.runFor(host, [
      { t: "wait", ms: 3300 },
      { t: "fn", fn: () => setAnim(host, host.seat?.deskId && dept !== "boss" ? "SitTyping" : "SitIdle") },
    ]);
  }

  // ------------------------------------------------------------ flows used by the UI

  /** From the street to reception. With reduced motion the visitor starts at the desk. */
  startIntro() {
    const v = this.visitor;
    this.reset();
    if (this.reducedMotion) {
      v.x = RECEPTION_SPOT[0];
      v.z = RECEPTION_SPOT[1];
      v.yaw = Math.PI;
      this.gate.open = 0;
      this.arriveAtReception();
      return;
    }
    this.setPhase("intro");
    this.run(this.walkInSteps(900));
  }

  private walkInSteps(delayMs: number): Step[] {
    const v = this.visitor;
    const traffic = this.traffic;
    return [
      { t: "wait", ms: delayMs },
      { t: "walk", a: v, path: [START, KERB_FAR] },
      { t: "turn", a: v, yaw: Math.PI },
      { t: "fn", fn: () => traffic?.visitorDemand.add("gate") },
      { t: "until", test: () => !traffic || traffic.canCross("gate"), max: 12000 },
      { t: "walk", a: v, path: [KERB_FAR, KERB_NEAR] },
      { t: "fn", fn: () => traffic?.visitorDemand.delete("gate") },
      this.lazy(() => [this.walkTo(v, RECEPTION_SPOT)]),
      { t: "turn", a: v, yaw: Math.PI },
      { t: "fn", fn: () => this.arriveAtReception() },
    ];
  }

  private arriveAtReception() {
    this.main = null;
    this.setPhase("reception");
    this.speak(this.receptionist, "Welcome in!", 2600);
    this.status("At reception.");
  }

  /** Walks the visitor to a place: reception, or a department (guided by the receptionist when possible). */
  goTo(place: PlaceId) {
    // a new destination mid-walk: finish the current walk first so nobody is left halfway
    if (this.main) this.skip();
    if (place === "reception") return this.toReception();
    const dept = place;
    const v = this.visitor;
    const name = departments[dept].name;
    if (v.seat?.dept === dept) return;
    const guided = this.canGuide();
    this.setPhase("visit");
    this.status(guided ? `Follow your receptionist to ${name}.` : `Heading to ${name}.`);
    const steps: Step[] = [...this.leaveSteps()];
    const already = deptAt(v.x, v.z) === dept;
    const door = doors[dept];
    const front = dept === "boss" ? KNOCK_SPOT : door.out;
    if (!already) {
      if (guided) {
        const r = this.receptionist;
        const rs = seatById.get("reception") as SeatAnchor;
        const lead = findStrictPath(rs.approachPoint, door.out) ?? [rs.approachPoint, door.out];
        let total = 0;
        for (let k = 1; k < lead.length; k++) total += dist(lead[k - 1], lead[k]);
        const trimmed = trimTo(lead, Math.max(0.5, total - 1.5));
        const aside = stepAside(trimmed, 1.05);
        steps.push({
          t: "fn",
          fn: () => {
            r.walked = 0;
            r.walkTotal = 0;
          },
        });
        steps.push({
          t: "par",
          lanes: [
            [
              ...this.standSteps(r, rs),
              { t: "fn", fn: () => this.speak(r, "This way, please.", 2200) },
              { t: "walk", a: r, path: [...trimmed, aside] },
              { t: "turn", a: r, yaw: yawTo(aside, RECEPTION_SPOT) },
            ],
            [
              { t: "wait", ms: 400 },
              this.lazy(() => [this.walkTo(v, front, { after: r, lead: 2.6, follow: r, gap: 1.5 })]),
            ],
          ],
        });
        steps.push({
          t: "fn",
          fn: () => {
            r.look = v.head();
            this.speak(r, dept === "boss" ? "Knock first!" : "Here we are!", 2200);
            setAnim(r, "Wave");
          },
        });
      } else {
        steps.push(this.lazy(() => [this.walkTo(v, front)]));
      }
    }
    if (dept === "boss" && !already) {
      steps.push(
        { t: "turn", a: v, yaw: Math.PI },
        {
          t: "fn",
          fn: () => {
            this.speak(v, "KNOCK KNOCK", 1800);
            this.status("Knocking on the boss's door.");
          },
        },
        { t: "anim", a: v, clip: "Knock" },
        { t: "fn", fn: () => this.speak(this.boss, "Come in!", 1800) },
        { t: "wait", ms: 900 },
      );
    }
    if (!already) steps.push(...this.doorSteps(v, dept, true));
    if (guided) steps.push({ t: "fn", fn: () => this.sendReceptionistBack() });
    steps.push(...this.sitInSteps(dept));
    this.run(steps);
  }

  /** Walk to the department's visitor seat and sit down. */
  private sitInSteps(dept: DeptId): Step[] {
    const v = this.visitor;
    const s = visitorSeat(dept);
    return [
      this.lazy(() => [this.walkTo(v, s.approachPoint)]),
      { t: "fn", fn: () => this.status(`Taking a seat in the ${departments[dept].name}.`) },
      ...this.sitSteps(v, s),
      {
        t: "fn",
        fn: () => {
          this.main = null;
          this.setPhase("seated");
          this.hostReact(dept);
          this.emit("seated", dept);
          this.status(`Seated in the ${departments[dept].name}.`);
        },
      },
    ];
  }

  private sendReceptionistBack() {
    const r = this.receptionist;
    const rs = seatById.get("reception") as SeatAnchor;
    this.runFor(r, [
      { t: "wait", ms: 900 },
      { t: "fn", fn: () => (r.look = null) },
      this.lazy(() => [this.walkTo(r, rs.approachPoint)]),
      ...this.sitSteps(r, rs),
      { t: "fn", fn: () => setAnim(r, "SitTyping") },
    ]);
  }

  toReception() {
    const v = this.visitor;
    this.setPhase("visit");
    this.status("Back to reception.");
    this.run([...this.leaveSteps(), this.lazy(() => [this.walkTo(v, RECEPTION_SPOT)]), { t: "turn", a: v, yaw: Math.PI }, { t: "fn", fn: () => this.arriveAtReception() }]);
  }

  /** Just exploring: free walking from wherever the visitor is. */
  explore() {
    this.main = null;
    this.setPhase("free");
  }

  standUp() {
    const v = this.visitor;
    if (!v.seat || this.main) return;
    const s = v.seat;
    this.setPhase("visit");
    this.run([
      ...this.standSteps(v, s),
      {
        t: "fn",
        fn: () => {
          this.main = null;
          this.justLeft = s.dept as DeptId;
          this.emit("stood", s.dept as DeptId);
          this.setPhase("free");
        },
      },
    ]);
  }

  /** Out through the entrance and the gate onto the pavement. */
  exit() {
    const v = this.visitor;
    this.setPhase("leaving");
    this.status("Heading out.");
    this.run([
      ...this.leaveSteps(),
      this.lazy(() => [this.walkTo(v, [0, 17.7])]),
      { t: "turn", a: v, yaw: 0 },
      {
        t: "fn",
        fn: () => {
          this.main = null;
          this.setPhase("outside");
        },
      },
    ]);
  }

  /** From the pavement back in to reception. */
  reenter() {
    const v = this.visitor;
    this.setPhase("intro");
    this.run([this.lazy(() => [this.walkTo(v, RECEPTION_SPOT)]), { t: "turn", a: v, yaw: Math.PI }, { t: "fn", fn: () => this.arriveAtReception() }]);
  }

  /** Click or tap: walk there (standing up first if seated). */
  moveTo(x: number, z: number) {
    if (this.main || this.phase === "intro" || this.phase === "leaving" || this.phase === "visit") return;
    const v = this.visitor;
    if (v.seat) return;
    if (this.phase !== "free") this.setPhase("free");
    const path = findPath(v.pos, [x, z]);
    this.freeRoute = new Runner([{ t: "walk", a: v, path, doors: true, speed: FREE_WALK }], this);
  }

  setKey(k: keyof Director["keys"], on: boolean) {
    this.keys[k] = on;
  }

  /** Put everyone back where the office starts. */
  reset() {
    this.main = null;
    this.freeRoute = null;
    this.side.clear();
    const v = this.visitor;
    v.x = START[0];
    v.z = START[1];
    v.yaw = Math.PI;
    v.seat = null;
    v.bubble = null;
    setAnim(v, "Idle");
    for (const id of doorIds) this.doors[id] = { open: 0, target: 0, lag: 0, idle: 0 };
    this.gate.open = 0;
    this.gate.target = 0;
    this.chairs.clear();
    for (const a of this.npcs) {
      const s = a.seat ?? (seatById.get(a.id) as SeatAnchor);
      a.seat = s;
      a.x = s.position[0];
      a.z = s.position[1];
      a.yaw = s.facingYaw;
      a.look = null;
      setAnim(a, s.deskId ? "SitTyping" : "SitIdle");
    }
    this.traffic?.visitorDemand.clear();
    this.place = null;
  }

  // ------------------------------------------------------------ per frame

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const v = this.visitor;
    const px = v.x;
    const pz = v.z;
    this.tickDoors(dt);

    if (this.main && this.main.update(dt)) this.main = null;
    for (const [a, r] of this.side) if (r.update(dt)) this.side.delete(a);
    if (!this.main) this.freeWalk(dt);

    // speech bubbles expire
    for (const [a, until] of this.speech) {
      if (this.time > until) {
        a.bubble = null;
        this.speech.delete(a);
      }
    }
    this.background(dt);

    v.vx = (v.x - px) / Math.max(dt, 1e-3);
    v.vz = (v.z - pz) / Math.max(dt, 1e-3);
    this.trackPlace();
  }

  private freeWalk(dt: number) {
    const v = this.visitor;
    if (this.phase !== "free" && this.phase !== "reception") return;
    const dx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const dz = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    if ((dx || dz) && !v.seat) {
      this.freeRoute = null;
      if (this.phase !== "free") this.setPhase("free");
      const len = Math.hypot(dx, dz);
      const nx = v.x + (dx / len) * FREE_WALK * dt;
      const nz = v.z + (dz / len) * FREE_WALK * dt;
      let moved = 0;
      if (!this.blockedAt(nx, v.z)) {
        moved += Math.abs(nx - v.x);
        v.x = nx;
      }
      if (!this.blockedAt(v.x, nz)) {
        moved += Math.abs(nz - v.z);
        v.z = nz;
      }
      // walking into a shut door opens it
      for (const id of doorIds) {
        if (this.doors[id].open < 0.6 && rectDist(v.x + (dx / len) * 0.5, v.z + (dz / len) * 0.5, doors[id].rect) < BODY_R) this.openDoor(id, v);
      }
      v.yaw = turnToward(v.yaw, Math.atan2(dx, dz), dt * 10);
      v.y = groundY(v.x, v.z);
      walkAnim(v, moved > 0 ? FREE_WALK : 0);
    } else if (this.freeRoute) {
      if (this.freeRoute.update(dt)) this.freeRoute = null;
    } else if (!v.seat && v.anim === "Walk") walkAnim(v, 0);

    // walking up to a department table on your own sits you down
    if (this.justLeft) {
      const z = placeInfo[this.justLeft].tableZone;
      if (!z || !inRect(v.x, v.z, z, 0.3)) this.justLeft = null;
    }
    if (this.phase === "free" && !v.seat && !this.main) {
      for (const id of doorIds) {
        const z = placeInfo[id].tableZone;
        if (z && id !== this.justLeft && inRect(v.x, v.z, z)) {
          this.freeRoute = null;
          this.keys = { up: false, down: false, left: false, right: false };
          this.setPhase("visit");
          this.run(this.sitInSteps(id));
          break;
        }
      }
    }
  }

  /** Small things that keep the place alive. */
  private background(dt: number) {
    const v = this.visitor;
    const head = v.head();
    // the guard watches the visitor
    const g = this.guard;
    const dg = dist(g.pos, v.pos);
    g.look = dg < 22 ? head : null;
    if (!this.side.has(g)) {
      const toward = dg < 22 ? yawTo(g.pos, v.pos) : GUARD_YAW;
      const off = clamp(wrapAngle(toward - GUARD_YAW), -0.9, 0.9);
      g.yaw = turnToward(g.yaw, GUARD_YAW + off, dt * 1.5);
    }
    // the receptionist looks up when the visitor is near the desk
    const r = this.receptionist;
    if (r.seat?.id === "reception" && !this.side.has(r)) r.look = dist(r.pos, v.pos) < 7 ? head : null;
    // hosts look at the visitor while they sit at their table
    for (const [dept, host] of Object.entries(this.hosts) as [DeptId, Actor][]) {
      if (this.side.has(host)) continue;
      host.look = v.seat?.dept === dept || (dist(host.pos, v.pos) < 3.5 && deptAt(v.x, v.z) === dept) ? head : null;
    }
    // seated staff switch between typing, thinking and chatting
    for (const a of this.npcs) {
      if (!a.seat || a === r || this.side.has(a) || a.look) continue;
      const t = (this.idleSwap.get(a) ?? 0) - dt;
      if (t > 0) {
        this.idleSwap.set(a, t);
        continue;
      }
      const roll = ((a.x * 31.7 + this.time * 17.3) % 1 + 1) % 1;
      const next: ClipName = a.seat.deskId ? (roll < 0.65 ? "SitTyping" : roll < 0.9 ? "SitIdle" : "SitTalk") : roll < 0.75 ? "SitIdle" : "SitTalk";
      if (next !== a.anim) setAnim(a, next);
      this.idleSwap.set(a, next === "SitTalk" ? 3 : 6 + roll * 10);
    }
  }

  private trackPlace() {
    const v = this.visitor;
    let p: PlaceId | null = deptAt(v.x, v.z) ?? (v.seat ? (v.seat.dept as PlaceId) : null);
    if (!p && inRect(v.x, v.z, BUILDING)) p = "reception";
    if (p !== this.place) {
      this.place = p;
      this.emit("place", p);
    }
  }
}

/** Cuts a polyline to length L. */
function trimTo(path: V2[], L: number): V2[] {
  const out: V2[] = [path[0]];
  let left = L;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (seg >= left) {
      const k = left / (seg || 1);
      out.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k]);
      return out;
    }
    out.push(path[i]);
    left -= seg;
  }
  return out;
}
