/**
 * Furniture shapes, written into merged builders. Local frame: origin on the floor at the item's centre and
 * +z is the way a seated person faces (for desks: towards the monitors; for sofas: out of the seat).
 */
import { TABLE_H, SEAT_H, type Furniture } from "../layout";
import { GeoBuilder } from "./builder";

export type Builders = { solid: GeoBuilder; glass: GeoBuilder; glow: GeoBuilder };

export const P = {
  oak: "#DDBB8D",
  oakDark: "#B98F5E",
  walnut: "#8A5A3B",
  white: "#F3F2EE",
  metal: "#2B2F33",
  chrome: "#A9B0B4",
  black: "#1E2226",
  green: "#2E4D41",
  sage: "#8FB1A6",
  cream: "#F3F0E8",
  terracotta: "#D38E6A",
  screen: "#20262B",
  pot: "#E9E4D8",
  soil: "#5B4630",
  leafA: "#3F7A55",
  leafB: "#2F6647",
  leafC: "#4B8A5F",
};
const TONE = { oak: P.oak, walnut: P.walnut, white: P.white };

function monitor(b: Builders, x: number, z: number, w = 0.56) {
  b.solid.block(x, TABLE_H, z, 0.2, 0.012, 0.14, P.metal);
  b.solid.block(x, TABLE_H, z + 0.02, 0.04, 0.2, 0.03, P.metal);
  b.solid.box(x, TABLE_H + 0.36, z + 0.02, w, 0.34, 0.035, P.black);
  b.glow.box(x, TABLE_H + 0.36, z, w - 0.04, 0.3, 0.012, "#9CC9DA");
}

function keyboard(b: Builders, x: number, z: number) {
  b.solid.block(x, TABLE_H, z, 0.38, 0.018, 0.13, "#D9DAD6");
  b.solid.block(x + 0.28, TABLE_H, z + 0.01, 0.07, 0.02, 0.1, "#D9DAD6");
}

/** Open laptop with the screen towards the user (user sits on -z). */
export function laptop(b: Builders, x: number, z: number, open = true) {
  b.solid.block(x, TABLE_H, z, 0.34, 0.018, 0.24, "#B8BEC2");
  if (open) {
    b.solid.box(x, TABLE_H + 0.125, z + 0.14, 0.34, 0.24, 0.012, "#B8BEC2", { rx: 0.22 });
    b.glow.box(x, TABLE_H + 0.125, z + 0.132, 0.3, 0.2, 0.004, "#A9D1E0", { rx: 0.22 });
  }
}

function mug(b: Builders, x: number, z: number, c = "#F2F2EE") {
  b.solid.cyl(x, TABLE_H, z, 0.04, 0.1, c, 10);
}

function deskBody(b: Builders, w: number, d: number, tone: string) {
  b.solid.block(0, TABLE_H - 0.04, 0, w, 0.04, d, tone);
  for (const sx of [-1, 1]) {
    b.solid.block((sx * (w - 0.1)) / 2, 0, 0, 0.05, TABLE_H - 0.04, d - 0.1, P.metal);
  }
}

export function desk(b: Builders, f: Extract<Furniture, { kind: "desk" }>) {
  const tone = TONE[f.tone ?? "oak"];
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    deskBody(b, f.w, f.d, tone);
    const back = f.d / 2 - 0.2;
    if (f.monitor === "single") monitor(b, 0, back);
    if (f.monitor === "dual") {
      // a pair of screens in front of each seat along a long bench, one pair for a short desk
      const pairs = f.w > 2.6 ? [-0.8, 0.8] : [0];
      for (const c of pairs) {
        monitor(b, c - 0.3, back, 0.52);
        monitor(b, c + 0.3, back, 0.52);
        keyboard(b, c, -f.d / 2 + 0.2);
      }
    }
    if (f.monitor === "laptop") laptop(b, 0, -f.d / 2 + 0.3);
    mug(b, f.w / 2 - 0.25, -f.d / 2 + 0.2, P.terracotta);
  });
}

/** Four desks facing each other across a frosted glass divider. */
export function pod(b: Builders, x: number, z: number) {
  for (const [dx, dz, yaw] of [
    [-0.71, 0.4, Math.PI],
    [0.71, 0.4, Math.PI],
    [-0.71, -0.4, 0],
    [0.71, -0.4, 0],
  ] as [number, number, number][]) {
    b.solid.at({ x: x + dx, z: z + dz, yaw }, () => {
      deskBody(b, 1.4, 0.75, P.white);
      monitor(b, 0, 0.2);
      keyboard(b, 0, -0.15);
    });
  }
  b.solid.at({ x, z }, () => {
    b.glass.box(0, TABLE_H + 0.27, 0, 2.84, 0.5, 0.02, "#DCEBEE");
    b.solid.box(0, TABLE_H + 0.53, 0, 2.86, 0.025, 0.035, P.metal);
    b.solid.box(-1.42, TABLE_H + 0.27, 0, 0.025, 0.54, 0.035, P.metal);
    b.solid.box(1.42, TABLE_H + 0.27, 0, 0.025, 0.54, 0.035, P.metal);
    b.solid.cyl(0.35, TABLE_H, 0.05, 0.06, 0.12, P.terracotta, 10);
    b.solid.sphere(0.35, TABLE_H + 0.17, 0.05, 0.09, 0.08, 0.09, P.leafC, true);
  });
}

export function table(b: Builders, f: Extract<Furniture, { kind: "table" }>) {
  const tone = TONE[f.tone ?? "oak"];
  b.solid.at({ x: f.x, z: f.z }, () => {
    b.solid.block(0, TABLE_H - 0.05, 0, f.w, 0.05, f.d, tone);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b.solid.block((sx * (f.w - 0.2)) / 2, 0, (sz * (f.d - 0.2)) / 2, 0.07, TABLE_H - 0.05, 0.07, P.metal);
    }
    b.solid.block(0, TABLE_H - 0.09, 0, f.w * 0.3, 0.04, 0.18, P.metal);
  });
}

export function roundTable(b: Builders, f: Extract<Furniture, { kind: "roundTable" }>) {
  b.solid.at({ x: f.x, z: f.z }, () => {
    b.solid.cyl(0, TABLE_H - 0.045, 0, f.r, 0.045, P.white, 28);
    b.solid.cyl(0, 0.05, 0, 0.06, TABLE_H - 0.1, P.metal, 10);
    b.solid.cyl(0, 0, 0, 0.32, 0.05, P.metal, 16);
    // sketches and sticky notes on the table
    b.solid.block(-0.25, TABLE_H, 0.1, 0.3, 0.004, 0.42, "#FAFAF5", { yaw: 0.3 });
    b.solid.block(0.2, TABLE_H, -0.2, 0.08, 0.005, 0.08, "#F2C14E");
    b.solid.block(0.32, TABLE_H, -0.1, 0.08, 0.005, 0.08, "#8FD0C3");
    b.solid.block(0.15, TABLE_H, 0.3, 0.08, 0.005, 0.08, "#F29C9C");
  });
}

/** Wooden slatted reception desk: high counter facing the entrance, low work surface behind. */
export function reception(b: Builders, f: Extract<Furniture, { kind: "reception" }>) {
  const { w, d } = f;
  b.solid.at({ x: f.x, z: f.z }, () => {
    // front counter (south half)
    b.solid.block(0, 0, d / 4, w, 1.0, d / 2, P.cream);
    b.solid.block(0, 1.0, d / 4, w + 0.12, 0.06, d / 2 + 0.12, P.oak);
    const n = Math.floor(w / 0.16);
    for (let i = 0; i <= n; i++) b.solid.block(-w / 2 + 0.04 + (i * (w - 0.08)) / n, 0.04, d / 2 + 0.02, 0.07, 0.92, 0.05, P.oakDark);
    // low work surface for the receptionist (north half)
    b.solid.block(0, TABLE_H - 0.04, -d / 4, w, 0.04, d / 2, P.oak);
    b.solid.block(-w / 2 + 0.03, 0, -d / 4, 0.06, TABLE_H - 0.04, d / 2, P.cream);
    b.solid.block(w / 2 - 0.03, 0, -d / 4, 0.06, TABLE_H - 0.04, d / 2, P.cream);
    // laptop in front of the receptionist's chair, a bell and a small plant on the counter
    laptop(b, 0.35, -d / 4 + 0.02);
    b.solid.cyl(-1.4, 1.06, d / 4, 0.09, 0.12, P.terracotta, 12);
    b.solid.sphere(-1.4, 1.27, d / 4, 0.14, 0.12, 0.14, P.leafC, true);
    b.solid.cyl(1.2, 1.06, d / 4, 0.05, 0.03, P.chrome, 12);
    b.solid.sphere(1.2, 1.1, d / 4, 0.045, 0.035, 0.045, P.chrome, true);
  });
}

function cushionSeat(b: Builders, w: number, color: string, seats: number) {
  const dark = shade(color, 0.82);
  b.solid.block(0, 0.08, 0, w, 0.24, 0.9, dark);
  for (let i = 0; i < seats; i++) {
    const cw = (w - 0.3) / seats;
    b.solid.block(-w / 2 + 0.15 + cw * (i + 0.5), 0.32, 0.06, cw - 0.03, SEAT_H - 0.32, 0.66, color);
    b.solid.block(-w / 2 + 0.15 + cw * (i + 0.5), 0.36, -0.3, cw - 0.03, 0.42, 0.18, color, { rx: -0.12 });
  }
  b.solid.block(0, 0.32, -0.37, w, 0.5, 0.16, dark);
  for (const sx of [-1, 1]) b.solid.block((sx * (w - 0.14)) / 2, 0.32, 0, 0.14, 0.3, 0.9, dark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.solid.block((sx * (w - 0.12)) / 2, 0, (sz * 0.36), 0.05, 0.08, 0.05, P.metal);
}

export function sofa(b: Builders, f: Extract<Furniture, { kind: "sofa" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => cushionSeat(b, f.w, f.color, f.w > 2 ? 3 : 2));
}

export function armchair(b: Builders, f: Extract<Furniture, { kind: "armchair" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => cushionSeat(b, 0.86, f.color, 1));
}

export function coffeeTable(b: Builders, f: Extract<Furniture, { kind: "coffeeTable" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0.36, 0, f.w, 0.04, f.d, P.oak);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.solid.block((sx * (f.w - 0.1)) / 2, 0, (sz * (f.d - 0.1)) / 2, 0.04, 0.36, 0.04, P.metal);
    b.solid.cyl(f.w * 0.2, 0.4, 0, 0.05, 0.09, P.white, 10);
    b.solid.block(-f.w * 0.15, 0.4, 0, 0.22, 0.02, 0.28, "#C98A6B", { yaw: 0.2 });
  });
}

export function plant(b: Builders, f: Extract<Furniture, { kind: "plant" }>) {
  const s = f.s;
  b.solid.at({ x: f.x, z: f.z }, () => {
    b.solid.cyl(0, 0, 0, 0.27 * s, 0.5 * s, P.pot, 14, 0.31 * s);
    b.solid.cyl(0, 0.48 * s, 0, 0.28 * s, 0.03, P.soil, 14);
    if (f.variant === "bush") {
      b.solid.sphere(0, 0.95 * s, 0, 0.46 * s, 0.42 * s, 0.46 * s, P.leafC, true);
      b.solid.sphere(0.12 * s, 1.2 * s, 0.05, 0.3 * s, 0.28 * s, 0.3 * s, P.leafA, true);
    } else if (f.variant === "tall") {
      b.solid.cyl(0, 0.5 * s, 0, 0.03 * s, 0.6 * s, "#6B4A32", 6);
      for (let i = 0; i < 4; i++) b.solid.sphere(Math.sin(i * 2.4) * 0.15 * s, (1.05 + i * 0.22) * s, Math.cos(i * 2.4) * 0.15 * s, 0.26 * s, 0.22 * s, 0.26 * s, i % 2 ? P.leafA : P.leafB, true);
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.solid.at({ x: Math.sin(a) * 0.2 * s, y: 0.75 * s, z: Math.cos(a) * 0.2 * s, yaw: a, rx: 0.75 }, () => b.solid.cone(0, 0, 0, 0.13 * s, 0.95 * s, i % 2 ? P.leafA : P.leafB, 5));
      }
      b.solid.cone(0, 0.5 * s, 0, 0.13 * s, 1.15 * s, P.leafC, 5);
    }
  });
}

const BOOKS = ["#6E948A", "#D38E6A", "#E5CE8B", "#3F6C59", "#B9C7D0", "#C98A6B", "#8D7BA8", "#2E4D41"];

export function bookshelf(b: Builders, f: Extract<Furniture, { kind: "bookshelf" }>) {
  const h = 2.0;
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0, -0.17, f.w, h, 0.06, P.walnut);
    for (const sx of [-1, 1]) b.solid.block((sx * (f.w - 0.04)) / 2, 0, 0, 0.04, h, 0.4, P.walnut);
    for (let r = 0; r < 5; r++) {
      const y = 0.05 + r * 0.45;
      b.solid.block(0, y, 0, f.w, 0.03, 0.38, P.walnut);
      if (r === 4) continue;
      let x = -f.w / 2 + 0.08;
      let i = r * 3;
      while (x < f.w / 2 - 0.12) {
        const bw = 0.05 + ((i * 7) % 4) * 0.012;
        const bh = 0.26 + ((i * 5) % 3) * 0.05;
        if ((i * 11) % 9 === 0) {
          x += 0.14;
          i++;
          continue;
        }
        b.solid.block(x + bw / 2, y + 0.03, 0.02, bw, bh, 0.24, BOOKS[i % BOOKS.length]);
        x += bw + 0.008;
        i++;
      }
    }
  });
}

export function cabinet(b: Builders, f: Extract<Furniture, { kind: "cabinet" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0, 0, f.w, f.h, 0.5, "#CDD0CB");
    b.solid.block(0, f.h, 0, f.w + 0.02, 0.03, 0.52, P.oak);
    const n = Math.max(1, Math.round(f.w / 0.8));
    for (let i = 0; i < n; i++) {
      const x = -f.w / 2 + (f.w / n) * (i + 0.5);
      b.solid.block(x, f.h * 0.15, 0.255, f.w / n - 0.04, f.h * 0.75, 0.01, "#D9DBD6");
      b.solid.block(x, f.h * 0.75, 0.265, 0.18, 0.02, 0.02, P.metal);
    }
    if (f.h < 1) {
      b.solid.cyl(-f.w / 2 + 0.25, f.h + 0.03, 0, 0.08, 0.16, P.terracotta, 10);
      b.solid.sphere(-f.w / 2 + 0.25, f.h + 0.3, 0, 0.13, 0.12, 0.13, P.leafA, true);
    }
  });
}

export function rack(b: Builders, f: Extract<Furniture, { kind: "rack" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0, 0, 0.62, 2.0, 0.9, "#2F353A");
    for (let i = 0; i < 7; i++) {
      const y = 0.2 + i * 0.25;
      b.solid.box(0, y, 0.452, 0.54, 0.17, 0.01, "#3C444A");
      b.glow.box(-0.18, y, 0.46, 0.04, 0.03, 0.01, i % 3 ? "#6BE3A0" : "#F2C14E");
      b.glow.box(-0.1, y, 0.46, 0.04, 0.03, 0.01, "#6BE3A0");
    }
  });
}

export function whiteboard(b: Builders, f: Extract<Furniture, { kind: "whiteboard" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.box(0, 1.55, 0, f.w + 0.08, 1.24, 0.04, P.chrome);
    b.solid.box(0, 1.55, 0.025, f.w, 1.16, 0.01, "#FBFBF8");
    b.solid.box(0, 0.94, 0.06, f.w * 0.6, 0.03, 0.08, P.chrome);
    if (f.notes) {
      const cols = ["#F2C14E", "#8FD0C3", "#F29C9C", "#B9A3D6", "#A3B86C"];
      for (let i = 0; i < 14; i++) {
        const x = -f.w / 2 + 0.3 + (i % 7) * (f.w - 0.6) / 6;
        const y = 1.85 - Math.floor(i / 7) * 0.32 - ((i * 3) % 4) * 0.03;
        b.solid.box(x, y, 0.035, 0.18, 0.18, 0.006, cols[i % cols.length]);
      }
      // wireframe sketch lines
      for (let i = 0; i < 3; i++) b.solid.box(-f.w / 4 + i * 0.5, 1.2, 0.034, 0.36, 0.22, 0.004, "#DCE6EA");
    }
  });
}

export function counter(b: Builders, f: Extract<Furniture, { kind: "counter" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0, 0, f.w, 0.9, 0.6, P.green);
    b.solid.block(0, 0.9, 0, f.w + 0.04, 0.04, 0.64, P.oak);
    // coffee machine, cups, fruit bowl
    b.solid.block(-f.w / 2 + 0.4, 0.94, -0.05, 0.36, 0.42, 0.34, P.metal);
    b.solid.block(-f.w / 2 + 0.4, 1.12, 0.13, 0.22, 0.08, 0.02, P.chrome);
    for (let i = 0; i < 4; i++) b.solid.cyl(-f.w / 2 + 0.85 + i * 0.12, 0.94, 0.1, 0.035, 0.08, P.white, 8);
    b.solid.cyl(f.w / 2 - 0.5, 0.94, 0, 0.16, 0.08, P.white, 14, 0.2);
    for (let i = 0; i < 4; i++) b.solid.sphere(f.w / 2 - 0.5 + Math.sin(i * 1.7) * 0.07, 1.04, Math.cos(i * 1.7) * 0.07, 0.05, 0.05, 0.05, i % 2 ? "#E07B2E" : "#C8443A", true);
  });
}

export function printer(b: Builders, f: Extract<Furniture, { kind: "printer" }>) {
  b.solid.at({ x: f.x, z: f.z, yaw: f.yaw }, () => {
    b.solid.block(0, 0, 0, 0.62, 0.62, 0.5, "#4A5157");
    b.solid.block(0, 0.62, 0, 0.66, 0.36, 0.52, "#E6E7E3");
    b.solid.block(0, 0.98, -0.05, 0.5, 0.04, 0.36, "#CFD1CD");
    b.glow.box(0.22, 0.86, 0.265, 0.1, 0.06, 0.01, "#7FC7A5");
  });
}

export function cooler(b: Builders, f: Extract<Furniture, { kind: "cooler" }>) {
  b.solid.at({ x: f.x, z: f.z }, () => {
    b.solid.block(0, 0, 0, 0.34, 1.0, 0.34, P.white);
    b.glass.cyl(0, 1.0, 0, 0.14, 0.38, "#9FD3EA", 14);
    b.solid.block(0, 0.75, 0.18, 0.12, 0.08, 0.04, P.metal);
  });
}

export function floorLamp(b: Builders, f: Extract<Furniture, { kind: "lamp" }>) {
  b.solid.at({ x: f.x, z: f.z }, () => {
    b.solid.cyl(0, 0, 0, 0.16, 0.03, P.metal, 14);
    b.solid.cyl(0, 0.03, 0, 0.015, 1.45, P.metal, 6);
    b.glow.cyl(0, 1.42, 0, 0.17, 0.26, "#FFF1D6", 16, 0.12);
  });
}

/** Office chair for the instanced chair meshes: frame (metal) and upholstery (tinted per chair). */
export function officeChair(frame: GeoBuilder, cloth: GeoBuilder) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    frame.at({ yaw: a }, () => {
      frame.box(0, 0.06, 0.15, 0.04, 0.03, 0.3, P.metal);
      frame.sphere(0, 0.03, 0.29, 0.03, 0.03, 0.03, P.black, true);
    });
  }
  frame.cyl(0, 0.07, 0, 0.025, SEAT_H - 0.13, P.chrome, 8);
  frame.block(0, SEAT_H - 0.07, 0, 0.36, 0.03, 0.34, P.metal);
  cloth.block(0, SEAT_H - 0.06, 0.02, 0.5, 0.07, 0.48, "#ffffff");
  frame.box(0, SEAT_H + 0.2, -0.25, 0.04, 0.4, 0.03, P.metal);
  cloth.box(0, SEAT_H + 0.36, -0.27, 0.46, 0.46, 0.06, "#ffffff", { rx: 0.12 });
  for (const sx of [-1, 1]) {
    frame.box(sx * 0.25, SEAT_H + 0.1, 0, 0.03, 0.2, 0.03, P.metal);
    frame.box(sx * 0.25, SEAT_H + 0.2, 0.02, 0.05, 0.03, 0.3, P.black);
  }
}

/** Lighten or darken a hex colour. */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
