/** Floor-plane maths shared by the plan, navigation, traffic and the director (metres, x east, z south). */

export type V2 = [number, number];
/** Axis-aligned rectangle [x0, z0, x1, z1]. */
export type Rect = [number, number, number, number];

export const TAU = Math.PI * 2;

export const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (k: number) => k * k * (3 - 2 * k);
export const lerp2 = (a: V2, b: V2, k: number): V2 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

/** Yaw that faces from `a` towards `b`. Yaw 0 faces +z (south); forward is (sin yaw, cos yaw). */
export const yawTo = (a: V2, b: V2) => Math.atan2(b[0] - a[0], b[1] - a[1]);
export const forward = (yaw: number): V2 => [Math.sin(yaw), Math.cos(yaw)];
/** `p` moved `ahead` along the facing and `side` to the walker's left (people face +z, their left is +x). */
export const offset = (p: V2, yaw: number, ahead: number, side = 0): V2 => [
  p[0] + Math.sin(yaw) * ahead + Math.cos(yaw) * side,
  p[1] + Math.cos(yaw) * ahead - Math.sin(yaw) * side,
];

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Turns `a` towards `b` by at most `step` radians. */
export function turnToward(a: number, b: number, step: number) {
  const d = wrapAngle(b - a);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}

export const angleGap = (a: number, b: number) => Math.abs(wrapAngle(b - a));

export function inRect(x: number, z: number, r: Rect, pad = 0) {
  return x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad;
}

/** Distance from a point to a rectangle (0 inside). */
export function rectDist(x: number, z: number, r: Rect) {
  const dx = Math.max(r[0] - x, 0, x - r[2]);
  const dz = Math.max(r[1] - z, 0, z - r[3]);
  return Math.hypot(dx, dz);
}

/** Rectangle of size w (local x) by d (local z) centred on (x, z), rotated by `yaw` (any angle; returns its bounds). */
export function footprint(x: number, z: number, w: number, d: number, yaw = 0): Rect {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}

export const grow = (r: Rect, m: number): Rect => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];

/** Length of a polyline. */
export function pathLength(p: V2[]) {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]);
  return s;
}

/** Point at arc length `s` along a polyline (clamped), plus the segment's yaw. */
export function pointAt(p: V2[], s: number): { p: V2; yaw: number } {
  let left = Math.max(0, s);
  for (let i = 1; i < p.length; i++) {
    const seg = dist(p[i - 1], p[i]);
    if (left <= seg || i === p.length - 1) {
      const k = seg > 0 ? Math.min(1, left / seg) : 1;
      return { p: lerp2(p[i - 1], p[i], k), yaw: yawTo(p[i - 1], p[i]) };
    }
    left -= seg;
  }
  return { p: p[0], yaw: 0 };
}

/** Shortens a route so it stops `d` metres before its end. */
export function trimEnd(path: V2[], d: number): V2[] {
  const out = path.slice();
  let left = d;
  while (out.length > 1 && left > 0) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const seg = dist(a, b);
    if (seg > left) {
      out[out.length - 1] = lerp2(b, a, left / seg);
      return out;
    }
    left -= seg;
    out.pop();
  }
  return out;
}

/** Small deterministic PRNG so the city looks the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
