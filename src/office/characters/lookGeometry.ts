/** Recolouring: a look's palette written into a per-look vertex colour attribute. */
import { BufferAttribute, BufferGeometry, Color, MeshStandardMaterial } from "three";
import type { Look } from "./looks";
import { BODIES } from "./rig.generated";

function shade(hex: string, k: number) {
  const c = new Color(hex);
  return `#${c.multiplyScalar(k).getHexString()}`;
}

function slotColor(role: string, base: string, colors: Look["colors"]): string {
  const c = colors as Record<string, string | undefined>;
  if (c[role]) return c[role] as string;
  if (role === "hair2" && c.hair) return shade(c.hair, 0.72);
  if (role === "skinShade" && c.skin) return shade(c.skin, 0.86);
  if (role === "brows" && c.hair) return shade(c.hair, 0.65);
  if (role === "socks" && c.bottom) return shade(c.bottom, 0.9);
  return base;
}

const lookKey = (l: Look) => `${l.body}|${Object.entries(l.colors).sort().map(([k, v]) => `${k}=${v}`).join(",")}`;
const cache = new Map<string, BufferGeometry>();

/** Geometry for a body in a look: shares every attribute with the source except a per-look colour attribute. */
export function lookGeometry(base: BufferGeometry, look: Look): BufferGeometry {
  const key = lookKey(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const ids = base.getAttribute("_matid");
  const slots = BODIES[look.body].slots;
  const palette = slots.map((s) => new Color(slotColor(s.role, s.color, look.colors)));
  const col = new Float32Array(ids.count * 3);
  for (let i = 0; i < ids.count; i++) {
    const c = palette[ids.getX(i)] ?? palette[0];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(base.attributes)) if (name !== "_matid") g.setAttribute(name, attr);
  g.setIndex(base.index);
  g.setAttribute("color", new BufferAttribute(col, 3));
  g.boundingBox = base.boundingBox;
  g.boundingSphere = base.boundingSphere;
  cache.set(key, g);
  return g;
}

/** One material for every person (colour comes from the vertices). */
export const personMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
