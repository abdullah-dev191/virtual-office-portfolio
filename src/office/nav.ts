import { colliders, inRect, type Rect, type V2 } from "./layout";

/** Walkable area (metres). Matches the limits the free-walk collision uses. */
const X0 = -30;
const X1 = 30;
const Z0 = -19;
const Z1 = 40;
const CS = 0.15;
const W = Math.ceil((X1 - X0) / CS);
const H = Math.ceil((Z1 - Z0) / CS);

/** Preferred clearance from furniture and walls, then a tighter fallback for cramped spots. */
const CLEARANCES = [0.5, 0.36];

const grids = new Map<number, Uint8Array>();

const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function blockedAt(x: number, z: number, pad: number) {
  if (x < X0 || x > X1 || z < Z0 || z > Z1) return true;
  for (const r of colliders) if (inRect(x, z, r, pad)) return true;
  return false;
}

function gridFor(pad: number) {
  let g = grids.get(pad);
  if (g) return g;
  g = new Uint8Array(W * H);
  for (const r of colliders) {
    const i0 = Math.max(0, Math.floor((r[0] - pad - X0) / CS) - 1);
    const i1 = Math.min(W - 1, Math.ceil((r[2] + pad - X0) / CS) + 1);
    const j0 = Math.max(0, Math.floor((r[1] - pad - Z0) / CS) - 1);
    const j1 = Math.min(H - 1, Math.ceil((r[3] + pad - Z0) / CS) + 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (inRect(X0 + (i + 0.5) * CS, Z0 + (j + 0.5) * CS, r, pad)) g[j * W + i] = 1;
      }
    }
  }
  grids.set(pad, g);
  return g;
}

const cellOf = (p: V2): [number, number] => [
  Math.min(W - 1, Math.max(0, Math.floor((p[0] - X0) / CS))),
  Math.min(H - 1, Math.max(0, Math.floor((p[1] - Z0) / CS))),
];
const centre = (i: number, j: number): V2 => [X0 + (i + 0.5) * CS, Z0 + (j + 0.5) * CS];

/** Nearest free cell to a point (the point itself if it is already free). */
function snap(g: Uint8Array, p: V2): [number, number] | null {
  const [ci, cj] = cellOf(p);
  if (!g[cj * W + ci]) return [ci, cj];
  for (let r = 1; r < 60; r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (i < 0 || j < 0 || i >= W || j >= H || g[j * W + i]) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Straight segment that stays `pad` away from every collider. */
function clear(a: V2, b: V2, pad: number) {
  const near: Rect[] = colliders.filter(
    (r) => r[2] + pad > Math.min(a[0], b[0]) && r[0] - pad < Math.max(a[0], b[0]) && r[3] + pad > Math.min(a[1], b[1]) && r[1] - pad < Math.max(a[1], b[1]),
  );
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.08));
  for (let k = 0; k <= n; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / n;
    const z = a[1] + ((b[1] - a[1]) * k) / n;
    if (x < X0 || x > X1 || z < Z0 || z > Z1) return false;
    for (const r of near) if (inRect(x, z, r, pad)) return false;
  }
  return true;
}

function smooth(pts: V2[], pad: number): V2[] {
  const out: V2[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j], pad)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

function search(g: Uint8Array, s: [number, number], t: [number, number]): V2[] | null {
  const N = W * H;
  const gs = new Float32Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const heapI: number[] = [];
  const heapF: number[] = [];
  const push = (idx: number, f: number) => {
    let k = heapI.length;
    heapI.push(idx);
    heapF.push(f);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= heapF[k]) break;
      [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
      [heapI[p], heapI[k]] = [heapI[k], heapI[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heapI[0];
    const li = heapI.pop() as number;
    const lf = heapF.pop() as number;
    if (heapI.length) {
      heapI[0] = li;
      heapF[0] = lf;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heapI.length && heapF[l] < heapF[m]) m = l;
        if (r < heapI.length && heapF[r] < heapF[m]) m = r;
        if (m === k) break;
        [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
        [heapI[m], heapI[k]] = [heapI[k], heapI[m]];
        k = m;
      }
    }
    return top;
  };
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - t[0]);
    const dz = Math.abs(j - t[1]);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  };
  const si = s[1] * W + s[0];
  const ti = t[1] * W + t[0];
  gs[si] = 0;
  push(si, h(s[0], s[1]));
  while (heapI.length) {
    const cur = pop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === ti) break;
    const ci = cur % W;
    const cj = (cur - ci) / W;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const nIdx = nj * W + ni;
        if (g[nIdx] || done[nIdx]) continue;
        // no squeezing diagonally between two blocked neighbours
        if (di && dj && (g[cj * W + ni] || g[nj * W + ci])) continue;
        const ng = gs[cur] + (di && dj ? 1.414 : 1);
        if (ng < gs[nIdx]) {
          gs[nIdx] = ng;
          parent[nIdx] = cur;
          push(nIdx, ng + h(ni, nj));
        }
      }
    }
  }
  if (!done[ti]) return null;
  const cells: V2[] = [];
  for (let c = ti; c !== -1; c = parent[c]) {
    const i = c % W;
    cells.push(centre(i, (c - i) / W));
  }
  return cells.reverse();
}

/**
 * Walkable route between two floor points that keeps clear of desks, chairs, plants and walls.
 * Doorways count as open, so callers open the door before walking through it.
 * The result starts at `from` and ends at `to` (nudged to the nearest free spot if `to` is inside furniture).
 */
export function findPath(from: V2, to: V2): V2[] {
  for (const pad of CLEARANCES) {
    const g = gridFor(pad);
    const s = snap(g, from);
    const t = snap(g, to);
    if (!s || !t) continue;
    const cells = search(g, s, t);
    if (!cells) continue;
    const end: V2 = blockedAt(to[0], to[1], pad) ? centre(t[0], t[1]) : to;
    const raw: V2[] = [from, ...cells.slice(1, -1), end];
    return dedupe(smooth(raw, pad));
  }
  return [from, to];
}

function dedupe(p: V2[]): V2[] {
  const out: V2[] = [p[0]];
  for (let i = 1; i < p.length; i++) if (dist(out[out.length - 1], p[i]) > 0.05) out.push(p[i]);
  return out.length > 1 ? out : [p[0], p[p.length - 1]];
}

/** Shorten a route so it stops `d` metres before its end. */
export function trimEnd(path: V2[], d: number): V2[] {
  const out = path.slice();
  let left = d;
  while (out.length > 1 && left > 0) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    const seg = dist(a, b);
    if (seg > left) {
      const k = (seg - left) / seg;
      out[out.length - 1] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      return out;
    }
    left -= seg;
    out.pop();
  }
  return out;
}

/** A spot just beside the end of `path`, so a guide can step out of the visitor's way. */
export function stepAside(path: V2[], gap = 0.95): V2 {
  const p = path[path.length - 1];
  const q = path[path.length - 2] ?? p;
  const len = dist(p, q) || 1;
  const nx = -(p[1] - q[1]) / len;
  const nz = (p[0] - q[0]) / len;
  for (const k of [gap, gap * 0.7]) {
    for (const s of [1, -1]) {
      const c: V2 = [p[0] + nx * k * s, p[1] + nz * k * s];
      if (!blockedAt(c[0], c[1], CLEARANCES[1])) return c;
    }
  }
  return p;
}
