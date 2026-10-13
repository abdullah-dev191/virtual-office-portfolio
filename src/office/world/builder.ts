/**
 * Merges many simple shapes into one vertex-coloured geometry, so a room full of furniture or a street full of
 * lamps is one draw call instead of hundreds.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix3,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

const colorCache = new Map<string, Color>();
function lin(hex: string) {
  let c = colorCache.get(hex);
  if (!c) {
    c = new Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

const templates = {
  box: new BoxGeometry(1, 1, 1),
  plane: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  sphere: new SphereGeometry(0.5, 14, 10),
  lowSphere: new SphereGeometry(0.5, 8, 6),
};
const cylCache = new Map<string, BufferGeometry>();
function cylTemplate(top: number, seg: number, open = false) {
  const key = `${top}|${seg}|${open}`;
  let g = cylCache.get(key);
  if (!g) {
    g = new CylinderGeometry(top, 1, 1, seg, 1, open);
    cylCache.set(key, g);
  }
  return g;
}
const coneCache = new Map<number, BufferGeometry>();
function coneTemplate(seg: number) {
  let g = coneCache.get(seg);
  if (!g) {
    g = new ConeGeometry(1, 1, seg);
    coneCache.set(seg, g);
  }
  return g;
}

const m4 = new Matrix4();
const m3 = new Matrix3();
const v3 = new Vector3();
const q = new Quaternion();
const e = new Euler();
const s3 = new Vector3();
const p3 = new Vector3();

export type Pose = { x?: number; y?: number; z?: number; yaw?: number; rx?: number; rz?: number };

/** Solid, glass and glowing builders sharing one transform stack. */
export function makeBuilders() {
  const stack = [new Matrix4()];
  return { solid: new GeoBuilder(stack), glass: new GeoBuilder(stack), glow: new GeoBuilder(stack) };
}

export class GeoBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];

  /** Builders that share a stack share local frames: `at()` on one places shapes in all of them. */
  constructor(private stack: Matrix4[] = [new Matrix4()]) {}

  get empty() {
    return this.idx.length === 0;
  }

  /** Runs `fn` with everything placed relative to a local frame (position plus yaw). */
  at(p: Pose, fn: () => void) {
    const top = this.stack[this.stack.length - 1];
    e.set(p.rx ?? 0, p.yaw ?? 0, p.rz ?? 0, "YXZ");
    const m = new Matrix4().compose(p3.set(p.x ?? 0, p.y ?? 0, p.z ?? 0), q.setFromEuler(e), s3.set(1, 1, 1));
    this.stack.push(top.clone().multiply(m));
    fn();
    this.stack.pop();
  }

  /** Appends a geometry transformed by `local` (relative to the current frame) with one colour. */
  add(g: BufferGeometry, local: Matrix4, color: string) {
    const world = m4.copy(this.stack[this.stack.length - 1]).multiply(local);
    m3.getNormalMatrix(world);
    const base = this.pos.length / 3;
    const P = g.getAttribute("position");
    const N = g.getAttribute("normal");
    const c = lin(color);
    for (let i = 0; i < P.count; i++) {
      v3.fromBufferAttribute(P, i).applyMatrix4(world);
      this.pos.push(v3.x, v3.y, v3.z);
      v3.fromBufferAttribute(N, i).applyMatrix3(m3).normalize();
      this.nrm.push(v3.x, v3.y, v3.z);
      this.col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
  }

  private placed(x: number, y: number, z: number, sx: number, sy: number, sz: number, p?: Pose) {
    e.set(p?.rx ?? 0, p?.yaw ?? 0, p?.rz ?? 0, "YXZ");
    return new Matrix4().compose(p3.set(x, y, z), q.setFromEuler(e), s3.set(sx, sy, sz));
  }

  /** Box centred at (x, y, z). */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rot?: Pose) {
    this.add(templates.box, this.placed(x, y, z, sx, sy, sz, rot), color);
  }

  /** Box sitting on y0 (bottom face at y0). */
  block(x: number, y0: number, z: number, sx: number, sy: number, sz: number, color: string, rot?: Pose) {
    this.box(x, y0 + sy / 2, z, sx, sy, sz, color, rot);
  }

  /** Cylinder (or tapered cylinder) standing on y0. */
  cyl(x: number, y0: number, z: number, r: number, h: number, color: string, seg = 12, rTop = r, rot?: Pose) {
    this.add(cylTemplate(rTop / r, seg), this.placed(x, y0 + h / 2, z, r, h, r, rot), color);
  }

  cone(x: number, y0: number, z: number, r: number, h: number, color: string, seg = 8) {
    this.add(coneTemplate(seg), this.placed(x, y0 + h / 2, z, r, h, r), color);
  }

  sphere(x: number, y: number, z: number, rx: number, ry: number, rz: number, color: string, low = false) {
    this.add(low ? templates.lowSphere : templates.sphere, this.placed(x, y, z, rx * 2, ry * 2, rz * 2), color);
  }

  /** Flat rectangle facing up at height y. */
  flat(x: number, y: number, z: number, w: number, d: number, color: string, yaw = 0) {
    this.add(templates.plane, this.placed(x, y, z, w, 1, d, { yaw }), color);
  }

  build(): BufferGeometry {
    if (this.stack.length !== 1) throw new Error("GeoBuilder: unbalanced at()");
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(this.col), 3));
    const n = this.pos.length / 3;
    g.setIndex(new BufferAttribute(n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
