/**
 * Collision map, generated from the plan (layout.ts) and the site (city.ts). Nothing here is typed by hand twice:
 * add furniture to layout.ts and it blocks walking automatically.
 */
import { bollards, benches, crossings, lamps, roads } from "./city";
import { footprint, inRect, offset, rectDist, type Rect } from "./geom";
import {
  BOOTH,
  CANOPY,
  GATE,
  GUARD_SPOT,
  NAME_BOARD,
  chairRect,
  doors,
  furniture,
  furnitureRect,
  garden,
  gardenRect,
  seats,
  wallRect,
  walls,
} from "./layout";

/** Area the visitor can walk in: the office plot, the pavement outside the gate, the crossing and the far pavement. */
export const NAV_BOUNDS: Rect = [-25.6, -23.6, 25.6, 29.4];

export type Collider = { rect: Rect; tag: string };

/** Open door leaves stand in the room beside the doorway; walkers keep clear of them. */
function openLeafRect(hinge: [number, number], yaw: number, len: number): Rect {
  const end = offset(hinge, yaw, len);
  const t = 0.09;
  return [Math.min(hinge[0], end[0]) - t, Math.min(hinge[1], end[1]) - t, Math.max(hinge[0], end[0]) + t, Math.max(hinge[1], end[1]) + t];
}

function build(): Collider[] {
  const out: Collider[] = [];
  for (const w of walls) out.push({ rect: wallRect(w), tag: `wall:${w.kind}` });
  for (const f of furniture) {
    const r = furnitureRect(f);
    if (r) out.push({ rect: r, tag: `furniture:${f.kind}` });
  }
  for (const s of seats) {
    const r = chairRect(s);
    if (r) out.push({ rect: r, tag: `chair:${s.id}` });
  }
  for (const g of garden) {
    const r = gardenRect(g);
    if (r) out.push({ rect: r, tag: `garden:${g.kind}` });
  }
  for (const d of Object.values(doors)) out.push({ rect: openLeafRect(d.hinge, d.openYaw, d.width), tag: `leaf:${d.id}` });
  // the two gate leaves swing in towards the garden
  out.push({ rect: openLeafRect([GATE.x0, GATE.z], Math.PI, (GATE.x1 - GATE.x0) / 2), tag: "leaf:gate-w" });
  out.push({ rect: openLeafRect([GATE.x1, GATE.z], Math.PI, (GATE.x1 - GATE.x0) / 2), tag: "leaf:gate-e" });
  out.push({ rect: [BOOTH.x - BOOTH.w / 2, BOOTH.z - BOOTH.d / 2, BOOTH.x + BOOTH.w / 2, BOOTH.z + BOOTH.d / 2], tag: "booth" });
  out.push({ rect: [GUARD_SPOT[0] - 0.3, GUARD_SPOT[1] - 0.3, GUARD_SPOT[0] + 0.3, GUARD_SPOT[1] + 0.3], tag: "guard" });
  out.push({ rect: [NAME_BOARD.x - NAME_BOARD.w / 2, NAME_BOARD.z - 0.2, NAME_BOARD.x + NAME_BOARD.w / 2, NAME_BOARD.z + 0.2], tag: "name-board" });
  for (const sx of [-1, 1]) out.push({ rect: [sx * CANOPY.x - 0.08, CANOPY.z1 - 0.18, sx * CANOPY.x + 0.08, CANOPY.z1 - 0.02], tag: "canopy-post" });
  // outside: the road everywhere except on the zebra stripes, and the street furniture
  const [bx0, bz0, bx1, bz1] = NAV_BOUNDS;
  for (const r of roads) {
    const clip: Rect = [Math.max(r.rect[0], bx0), Math.max(r.rect[1], bz0), Math.min(r.rect[2], bx1), Math.min(r.rect[3], bz1)];
    if (clip[0] >= clip[2] || clip[1] >= clip[3]) continue;
    const gaps = crossings.filter((c) => c.road === r.id && c.rect[0] < clip[2] && c.rect[2] > clip[0] && c.rect[1] < clip[3] && c.rect[3] > clip[1]);
    let x = clip[0];
    for (const c of gaps.sort((a, b) => a.rect[0] - b.rect[0])) {
      if (c.rect[0] > x) out.push({ rect: [x, clip[1], c.rect[0], clip[3]], tag: `road:${r.id}` });
      x = c.rect[2];
    }
    if (x < clip[2]) out.push({ rect: [x, clip[1], clip[2], clip[3]], tag: `road:${r.id}` });
  }
  for (const [x, z] of lamps) if (inRect(x, z, NAV_BOUNDS)) out.push({ rect: [x - 0.14, z - 0.14, x + 0.14, z + 0.14], tag: "lamp" });
  for (const [x, z] of bollards) if (inRect(x, z, NAV_BOUNDS)) out.push({ rect: [x - 0.12, z - 0.12, x + 0.12, z + 0.12], tag: "bollard" });
  for (const [x, z, yaw] of benches) if (inRect(x, z, NAV_BOUNDS)) out.push({ rect: footprint(x, z, 1.6, 0.6, yaw), tag: "bench" });
  return out;
}

export const colliders: Collider[] = build();
export const colliderRects: Rect[] = colliders.map((c) => c.rect);

/** Distance to the nearest collider (bounds count as walls). */
export function clearanceAt(x: number, z: number, rects: Rect[] = colliderRects): number {
  const [bx0, bz0, bx1, bz1] = NAV_BOUNDS;
  let best = Math.min(x - bx0, bx1 - x, z - bz0, bz1 - z);
  for (const r of rects) {
    const d = rectDist(x, z, r);
    if (d < best) best = d;
  }
  return best;
}

/** First collider closer than `pad` to the point, if any (for error messages). */
export function hitAt(x: number, z: number, pad: number): Collider | null {
  for (const c of colliders) if (rectDist(x, z, c.rect) < pad) return c;
  return null;
}
