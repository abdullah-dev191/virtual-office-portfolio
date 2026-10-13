/**
 * Walking routes: grid A* over the collision map (obstacles inflated by the body clearance), then string pulling
 * so routes are short straight runs that still keep the clearance. Doorways count as open; the director opens a
 * door before walking through it.
 */
import { NAV_BOUNDS, colliderRects } from "./colliders";
import { dist, rectDist, type Rect, type V2 } from "./geom";

/** Body clearance: every guided route stays at least this far from walls and furniture. */
export const CLEARANCE = 0.45;
/** Tighter clearance used only when a click lands somewhere the full clearance cannot reach. */
const FALLBACK = 0.34;

const CS = 0.15;
const [X0, Z0, X1, Z1] = NAV_BOUNDS;
const W = Math.ceil((X1 - X0) / CS);
const H = Math.ceil((Z1 - Z0) / CS);
const N = W * H;

const grids = new Map<number, Uint8Array>();

function gridFor(pad: number, rects: Rect[] = colliderRects): Uint8Array {
  const cached = rects === colliderRects ? grids.get(pad) : undefined;
  if (cached) return cached;
  const g = new Uint8Array(N);
  // bounds act as walls
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = X0 + (i + 0.5) * CS;
      const z = Z0 + (j + 0.5) * CS;
      if (x - X0 < pad || X1 - x < pad || z - Z0 < pad || Z1 - z < pad) g[j * W + i] = 1;
    }
  }
  for (const r of rects) {
    const i0 = Math.max(0, Math.floor((r[0] - pad - X0) / CS) - 1);
    const i1 = Math.min(W - 1, Math.ceil((r[2] + pad - X0) / CS) + 1);
    const j0 = Math.max(0, Math.floor((r[1] - pad - Z0) / CS) - 1);
    const j1 = Math.min(H - 1, Math.ceil((r[3] + pad - Z0) / CS) + 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (rectDist(X0 + (i + 0.5) * CS, Z0 + (j + 0.5) * CS, r) < pad) g[j * W + i] = 1;
      }
    }
  }
  if (rects === colliderRects) grids.set(pad, g);
  return g;
}

const cellOf = (p: V2): [number, number] => [
  Math.min(W - 1, Math.max(0, Math.floor((p[0] - X0) / CS))),
  Math.min(H - 1, Math.max(0, Math.floor((p[1] - Z0) / CS))),
];
const centre = (i: number, j: number): V2 => [X0 + (i + 0.5) * CS, Z0 + (j + 0.5) * CS];

/** Nearest free cell to a point (the point's own cell if free). */
function snap(g: Uint8Array, p: V2): [number, number] | null {
  const [ci, cj] = cellOf(p);
  if (!g[cj * W + ci]) return [ci, cj];
  for (let r = 1; r < 40; r++) {
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

/** True when the straight segment a-b keeps at least `pad` from every collider and stays in bounds. */
export function segmentClear(a: V2, b: V2, pad = CLEARANCE, rects: Rect[] = colliderRects): boolean {
  const minX = Math.min(a[0], b[0]) - pad;
  const maxX = Math.max(a[0], b[0]) + pad;
  const minZ = Math.min(a[1], b[1]) - pad;
  const maxZ = Math.max(a[1], b[1]) + pad;
  const near = rects.filter((r) => r[2] > minX && r[0] < maxX && r[3] > minZ && r[1] < maxZ);
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.05));
  for (let k = 0; k <= n; k++) {
    const x = a[0] + ((b[0] - a[0]) * k) / n;
    const z = a[1] + ((b[1] - a[1]) * k) / n;
    if (x - X0 < pad || X1 - x < pad || z - Z0 < pad || Z1 - z < pad) return false;
    for (const r of near) if (rectDist(x, z, r) < pad) return false;
  }
  return true;
}

// Reused search buffers; `stamp` marks which entries belong to the current search.
const gScore = new Float32Array(N);
const parent = new Int32Array(N);
const seen = new Uint32Array(N);
const closed = new Uint32Array(N);
let stamp = 0;
const heapI: number[] = [];
const heapF: number[] = [];

function heapPush(idx: number, f: number) {
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
}

function heapPop() {
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
}

function search(g: Uint8Array, s: [number, number], t: [number, number]): V2[] | null {
  stamp++;
  heapI.length = 0;
  heapF.length = 0;
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - t[0]);
    const dz = Math.abs(j - t[1]);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  };
  const si = s[1] * W + s[0];
  const ti = t[1] * W + t[0];
  gScore[si] = 0;
  parent[si] = -1;
  seen[si] = stamp;
  heapPush(si, h(s[0], s[1]));
  while (heapI.length) {
    const cur = heapPop();
    if (closed[cur] === stamp) continue;
    closed[cur] = stamp;
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
        if (g[nIdx] || closed[nIdx] === stamp) continue;
        // no squeezing diagonally past a blocked corner
        if (di && dj && (g[cj * W + ni] || g[nj * W + ci])) continue;
        const ng = gScore[cur] + (di && dj ? 1.4142 : 1);
        if (seen[nIdx] !== stamp || ng < gScore[nIdx]) {
          seen[nIdx] = stamp;
          gScore[nIdx] = ng;
          parent[nIdx] = cur;
          heapPush(nIdx, ng + h(ni, nj));
        }
      }
    }
  }
  if (closed[ti] !== stamp) return null;
  const cells: V2[] = [];
  for (let c = ti; c !== -1; c = parent[c]) {
    const i = c % W;
    cells.push(centre(i, (c - i) / W));
    if (c === si) break;
  }
  return cells.reverse();
}

/** Greedy string pulling: from each point, jump to the furthest later point still in clear sight. */
function pull(pts: V2[], pad: number): V2[] {
  const out: V2[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !segmentClear(pts[i], pts[j], pad)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

function dedupe(p: V2[]): V2[] {
  const out: V2[] = [p[0]];
  for (let i = 1; i < p.length; i++) if (dist(out[out.length - 1], p[i]) > 0.04) out.push(p[i]);
  return out.length > 1 ? out : [p[0], p[p.length - 1]];
}

function plan(from: V2, to: V2, pad: number): V2[] | null {
  const g = gridFor(pad);
  const s = snap(g, from);
  const t = snap(g, to);
  if (!s || !t) return null;
  const cells = search(g, s, t);
  if (!cells) return null;
  const startFree = segmentClear(from, from, pad);
  const endFree = segmentClear(to, to, pad);
  const pts: V2[] = [startFree ? from : centre(s[0], s[1]), ...cells.slice(1, -1), endFree ? to : centre(t[0], t[1])];
  const pulled = dedupe(pull(pts, pad));
  // a start point inside the clearance zone (e.g. standing at a seat) leads straight to the first clear cell
  if (!startFree) pulled.unshift(from);
  return pulled;
}

/**
 * Route from `from` to `to` keeping CLEARANCE from everything. When `to` is inside furniture the route ends at the
 * nearest free spot. `strict` routes never fall back to the tighter clearance (guided walks use it).
 */
export function findPath(from: V2, to: V2, strict = false): V2[] {
  const p = plan(from, to, CLEARANCE) ?? (strict ? null : plan(from, to, FALLBACK));
  return p ?? [from, to];
}

/** Like findPath but returns null when no clear route exists (used by the route checker). */
export function findStrictPath(from: V2, to: V2): V2[] | null {
  return plan(from, to, CLEARANCE);
}

/** Nearest point with full clearance (for snapping clicks on furniture). */
export function nearestFree(p: V2, pad = CLEARANCE): V2 {
  const g = gridFor(pad);
  const c = snap(g, p);
  return c ? centre(c[0], c[1]) : p;
}

/** A spot beside the end of a route, so a guide can step out of the visitor's way. */
export function stepAside(path: V2[], gap = 1.0): V2 {
  const p = path[path.length - 1];
  const q = path[path.length - 2] ?? p;
  const len = dist(p, q) || 1;
  const nx = -(p[1] - q[1]) / len;
  const nz = (p[0] - q[0]) / len;
  for (const k of [gap, gap * 0.75, gap * 0.5]) {
    for (const s of [1, -1]) {
      const c: V2 = [p[0] + nx * k * s, p[1] + nz * k * s];
      if (segmentClear(p, c, CLEARANCE)) return c;
    }
  }
  return p;
}
