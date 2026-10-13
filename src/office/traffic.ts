/**
 * Cars and pedestrians. Plain TypeScript, updated from the render loop.
 *  - Cars drive closed lane loops, keep a safe gap to whatever is ahead, slow for corners, take turns at junctions
 *    and stop at the stop line when someone is waiting at or walking on a zebra crossing.
 *  - Pedestrians walk pavement loops, wait at the kerb until approaching cars have stopped, then cross.
 */
import { crossings, groundY, junctionRect, junctions, lanes, pedRoutes, sampleLoop, windows, type Crossing, type Loop } from "./city";
import { clamp, inRect, rng, turnToward, wrapAngle } from "./geom";
import { makePuppet, setAnim, walkSpeed, type Puppet, type Sex } from "./characters/rig";

export type CarShape = "hatch" | "suv" | "van";
export const CAR_COLORS = ["#B8423C", "#3E6E8C", "#E0B94F", "#F2F2EE", "#2B2F33", "#6E948A", "#C98A6B", "#8D7BA8"];
const CAR_LEN: Record<CarShape, number> = { hatch: 3.9, suv: 4.5, van: 5.0 };

export type Car = {
  id: number;
  lane: number;
  s: number;
  v: number;
  vmax: number;
  shape: CarShape;
  color: number;
  len: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  braking: boolean;
  /** Junction this car currently holds, if any. */
  holds: number;
};

type Win = { id: string; s0: number; s1: number };
type LaneInfo = { loop: Loop; cross: Win[]; junc: Win[]; curve: Float32Array };

export type Walker = {
  puppet: Puppet;
  sex: Sex;
  route: number;
  s: number;
  v: number;
  /** Crossing the walker has been cleared to walk over, if any. */
  crossing: string | null;
  waiting: boolean;
  /** Sideways step (m, + is the walker's left) used to pass the visitor. */
  side: number;
};

const DECEL = 3.2;
const ACCEL = 2.0;
const STOP_GAP = 2.4;
const CORNER_G = 2.4;

const ahead = (from: number, to: number, L: number) => (((to - from) % L) + L) % L;

export class Traffic {
  cars: Car[] = [];
  walkers: Walker[] = [];
  /** Crossings someone is waiting to use or walking on (visitor included). */
  demand = new Set<string>();
  /** Set by the director while the visitor waits at or walks over a crossing. */
  visitorDemand = new Set<string>();
  private lanes: LaneInfo[];
  private routeCross: Win[][];
  private holder: number[] = junctions.map(() => -1);

  constructor(cars: number, walkers: number, walkerSex: (i: number) => Sex) {
    // only the two main-street junctions have crossing paths; ring corners are parallel arcs
    const junctionRects = junctions.slice(0, 2).map((j, i) => ({ id: String(i), rect: junctionRect(j) }));
    const crossRects = crossings.map((c) => ({ id: c.id, rect: c.rect }));
    this.lanes = lanes.map((loop) => {
      // speed limit from curvature, looked up per metre
      const n = Math.ceil(loop.length);
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const a = sampleLoop(loop, i);
        const b = sampleLoop(loop, i + 2);
        const k = Math.abs(wrapAngle(b.yaw - a.yaw)) / 2;
        curve[i] = k > 0.01 ? Math.sqrt(CORNER_G / k) : 99;
      }
      return { loop, cross: windows(loop, crossRects), junc: windows(loop, junctionRects), curve };
    });
    this.routeCross = pedRoutes.map((r) => windows(r, crossRects));
    this.reset(cars, walkers, walkerSex);
  }

  reset(cars: number, walkers: number, walkerSex: (i: number) => Sex) {
    const rnd = rng(11);
    const shapes: CarShape[] = ["hatch", "suv", "van", "hatch", "suv", "hatch"];
    this.cars = [];
    this.holder = junctions.map(() => -1);
    for (let i = 0; i < cars; i++) {
      const lane = i % this.lanes.length;
      const L = this.lanes[lane].loop.length;
      const nOn = Math.ceil(cars / this.lanes.length);
      const shape = shapes[i % shapes.length];
      this.cars.push({
        id: i,
        lane,
        s: ((Math.floor(i / this.lanes.length) + rnd() * 0.4) / nOn) * L,
        v: 0,
        vmax: 7 + rnd() * 3,
        shape,
        color: i % CAR_COLORS.length,
        len: CAR_LEN[shape],
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        braking: false,
        holds: -1,
      });
    }
    this.walkers = [];
    for (let i = 0; i < walkers; i++) {
      const route = i % pedRoutes.length;
      const sex = walkerSex(i);
      const r = pedRoutes[route];
      const s = ((Math.floor(i / pedRoutes.length) * 0.37 + rnd() * 0.2) % 1) * r.length;
      const p = sampleLoop(r, s);
      this.walkers.push({ puppet: makePuppet(p.x, p.z, p.yaw, "Walk"), sex, route, s, v: 1.1 + rnd() * 0.35, crossing: null, waiting: false, side: 0 });
    }
    this.place();
  }

  private place() {
    for (const c of this.cars) {
      const p = sampleLoop(this.lanes[c.lane].loop, c.s);
      c.x = p.x;
      c.z = p.z;
      c.yaw = p.yaw;
    }
  }

  /** Someone (or the visitor) is on or waiting at a crossing. */
  private crossingBusy(id: string) {
    return this.demand.has(id) || this.visitorDemand.has(id);
  }

  /** True when no car is on the crossing and every car near it has stopped or is far enough away. */
  canCross(id: string) {
    const c = crossings.find((k) => k.id === id) as Crossing;
    for (const car of this.cars) {
      if (inRect(car.x, car.z, c.rect, 1.2)) return false;
      const lane = this.lanes[car.lane];
      for (const w of lane.cross) {
        if (w.id !== id) continue;
        const d = ahead(car.s, w.s0, lane.loop.length);
        if (d < 16 && car.v > 0.4) return false;
      }
    }
    return true;
  }

  update(dt: number, visitor?: { x: number; z: number }) {
    dt = Math.min(dt, 0.05);
    this.updateWalkers(dt, visitor);
    this.updateCars(dt);
  }

  private updateCars(dt: number) {
    for (const car of this.cars) {
      const lane = this.lanes[car.lane];
      const L = lane.loop.length;
      let vDes = car.vmax;
      // corners: the tightest bend in the next 12 m
      for (let k = 0; k < 12; k += 2) {
        const lim = lane.curve[Math.floor((car.s + k) % L) % lane.curve.length];
        if (lim < vDes) vDes = Math.min(vDes, Math.sqrt(lim * lim + 2 * DECEL * k * 0.5));
      }
      const stopAt = (d: number) => {
        vDes = Math.min(vDes, Math.sqrt(2 * DECEL * Math.max(0, d)) * 0.9);
      };
      // zebra crossings: stop at the line if someone is waiting or crossing, and we can still stop comfortably
      for (const w of lane.cross) {
        const d = ahead(car.s + car.len / 2, w.s0, L);
        if (d > 30 || ahead(car.s, w.s1, L) < ahead(car.s, w.s0, L)) continue;
        if (this.crossingBusy(w.id)) {
          const line = d - STOP_GAP;
          if (line > (car.v * car.v) / (2 * DECEL * 1.6) - 0.5 || car.v < 1) stopAt(line);
        }
      }
      // junctions: one car in a box at a time
      for (const w of lane.junc) {
        const j = Number(w.id);
        const dIn = ahead(car.s + car.len / 2, w.s0, L);
        const inside = ahead(car.s, w.s0, L) > ahead(car.s, w.s1, L) || dIn < 0.01;
        if (car.holds === j) {
          // release once the tail has left the box
          if (!inside && ahead(car.s - car.len / 2, w.s1, L) > L / 2) {
            car.holds = -1;
            this.holder[j] = -1;
          }
          continue;
        }
        if (dIn < 9) {
          if (this.holder[j] === -1) {
            this.holder[j] = car.id;
            car.holds = j;
          } else if (this.holder[j] !== car.id) stopAt(dIn - 1.2);
        }
      }
      // car ahead (any lane) in a narrow cone
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      for (const o of this.cars) {
        if (o === car) continue;
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const f = dx * fx + dz * fz;
        if (f <= 0 || f > 22) continue;
        const lat = Math.abs(dx * fz - dz * fx);
        if (lat > 1.7) continue;
        if (Math.abs(wrapAngle(o.yaw - car.yaw)) > 1.2) continue;
        const gap = f - (car.len + o.len) / 2;
        vDes = Math.min(vDes, Math.max(0, (gap - 1.8) / 1.1), o.v + Math.max(0, gap - 4) * 0.6);
      }
      const dv = clamp(vDes - car.v, -DECEL * 2 * dt, ACCEL * dt);
      car.braking = dv < -0.02 || car.v < 0.2;
      car.v = Math.max(0, car.v + dv);
      car.s = (car.s + car.v * dt) % L;
      const p = sampleLoop(lane.loop, car.s);
      car.x = p.x;
      car.z = p.z;
      car.y = 0;
      car.yaw = turnToward(car.yaw, p.yaw, dt * 6);
    }
  }

  private updateWalkers(dt: number, visitor?: { x: number; z: number }) {
    this.demand.clear();
    for (const w of this.walkers) {
      const route = pedRoutes[w.route];
      const L = route.length;
      let v = w.v;
      w.waiting = false;
      // approaching a crossing: wait at the kerb until cars have stopped
      for (const win of this.routeCross[w.route]) {
        const d = ahead(w.s, win.s0, L);
        const onIt = ahead(w.s, win.s1, L) < ahead(w.s, win.s0, L);
        if (onIt) {
          this.demand.add(win.id);
          w.crossing = win.id;
          continue;
        }
        if (d < 1.2) {
          this.demand.add(win.id);
          if (w.crossing !== win.id) {
            if (this.canCross(win.id)) w.crossing = win.id;
            else {
              v = 0;
              w.waiting = true;
            }
          }
        }
      }
      if (w.crossing && !this.demand.has(w.crossing)) w.crossing = null;
      w.s = (w.s + v * dt) % L;
      const p = sampleLoop(route, w.s);
      // step round the visitor instead of walking through them
      let want = 0;
      if (visitor) {
        const dx = visitor.x - p.x;
        const dz = visitor.z - p.z;
        if (dx * dx + dz * dz < 4) want = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw) > 0 ? -0.9 : 0.9;
      }
      w.side += (want - w.side) * Math.min(1, dt * 3);
      const pup = w.puppet;
      pup.x = p.x + Math.cos(p.yaw) * w.side;
      pup.z = p.z - Math.sin(p.yaw) * w.side;
      pup.y = groundY(pup.x, pup.z);
      pup.yaw = turnToward(pup.yaw, p.yaw, dt * 5);
      if (v > 0.05) setAnimIf(pup, "Walk", v / walkSpeed(w.sex));
      else setAnimIf(pup, "Idle", 1);
    }
  }
}

function setAnimIf(p: Puppet, anim: "Walk" | "Idle", rate: number) {
  if (p.anim !== anim) setAnim(p, anim, rate);
  else p.rate = rate;
}
