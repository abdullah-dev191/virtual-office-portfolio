/** Canvas-drawn textures: signs, plaques, posters, wall screens, floors and building facades. */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

const cache = new Map<string, Texture>();

/** Font stacks from the page's CSS variables (Newsreader for display, Geist for body). */
export function fontStack(kind: "display" | "body") {
  if (typeof document === "undefined") return kind === "display" ? "Georgia, serif" : "system-ui, sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue(kind === "display" ? "--font-display" : "--font-body").trim();
  return v ? `${v}, ${kind === "display" ? "Georgia, serif" : "system-ui, sans-serif"}` : kind === "display" ? "Georgia, serif" : "system-ui, sans-serif";
}

export function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  draw(g, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  cache.set(key, t);
  return t;
}

export type Line = { text: string; size: number; font?: "display" | "body"; weight?: number; color?: string; spacing?: number; gap?: number };

/** Board with lines of text, vertically centred. Sizes are in canvas pixels. */
export function textBoard(key: string, w: number, h: number, bg: string, lines: Line[], opts: { align?: "center" | "left"; pad?: number; border?: string; radius?: number } = {}) {
  return canvasTexture(`board:${key}`, w, h, (g) => {
    const pad = opts.pad ?? 40;
    g.fillStyle = bg;
    if (opts.radius) {
      g.beginPath();
      g.roundRect(0, 0, w, h, opts.radius);
      g.fill();
    } else g.fillRect(0, 0, w, h);
    if (opts.border) {
      g.strokeStyle = opts.border;
      g.lineWidth = 6;
      g.strokeRect(8, 8, w - 16, h - 16);
    }
    const heights = lines.map((l) => l.size * 1.22 + (l.gap ?? 0));
    let y = h / 2 - heights.reduce((a, b) => a + b, 0) / 2;
    g.textBaseline = "middle";
    g.textAlign = opts.align ?? "center";
    for (const [i, l] of lines.entries()) {
      g.font = `${l.weight ?? 600} ${l.size}px ${fontStack(l.font ?? "body")}`;
      g.fillStyle = l.color ?? "#ffffff";
      (g as unknown as { letterSpacing: string }).letterSpacing = `${l.spacing ?? 0}px`;
      y += heights[i] / 2;
      g.fillText(l.text, opts.align === "left" ? pad : w / 2, y, w - pad * 2);
      y += heights[i] / 2;
    }
  });
}

/** Light oak planks. */
export function woodFloor(tone = "#E8DCC6") {
  return canvasTexture(`wood:${tone}`, 512, 512, (g, w, h) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, w, h);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      const off = (r % 2) * 160 + (r % 3) * 40;
      for (let x = -off; x < w; x += 320) {
        g.fillStyle = `rgba(120,90,60,${0.04 + ((r * 7 + x) % 5) * 0.012})`;
        g.fillRect(x, y, 320, h / rows);
        g.fillStyle = "rgba(110,80,50,0.18)";
        g.fillRect(x, y, 2, h / rows);
      }
      g.fillStyle = "rgba(110,80,50,0.22)";
      g.fillRect(0, y, w, 2);
    }
  }, [1, 1]);
}

/** Pale grey tiles. */
export function tileFloor(tone = "#E4E6E3") {
  return canvasTexture(`tile:${tone}`, 256, 256, (g, w, h) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(4, 4, w / 2 - 8, h / 2 - 8);
    g.fillRect(w / 2 + 4, h / 2 + 4, w / 2 - 8, h / 2 - 8);
    g.strokeStyle = "rgba(120,130,125,0.35)";
    g.lineWidth = 3;
    g.strokeRect(0, 0, w / 2, h / 2);
    g.strokeRect(w / 2, 0, w / 2, h / 2);
    g.strokeRect(0, h / 2, w / 2, h / 2);
    g.strokeRect(w / 2, h / 2, w / 2, h / 2);
  }, [1, 1]);
}

/** Paving slabs for paths and plazas. */
export function paving(tone = "#D9D5CA") {
  return canvasTexture(`paving:${tone}`, 256, 256, (g, w, h) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,85,75,0.22)";
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * h) / 4);
      g.lineTo(w, (i * h) / 4);
      g.stroke();
    }
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i <= 2; i++) {
        const x = ((i + (r % 2) * 0.5) * w) / 2;
        g.beginPath();
        g.moveTo(x, (r * h) / 4);
        g.lineTo(x, ((r + 1) * h) / 4);
        g.stroke();
      }
    }
  }, [1, 1]);
}

export function grass(tone = "#A9CB93") {
  return canvasTexture(`grass:${tone}`, 256, 256, (g, w, h) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, w, h);
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = rnd() < 0.5 ? "rgba(70,110,60,0.10)" : "rgba(255,255,230,0.08)";
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
  }, [1, 1]);
}

/** Building facade: one floor tall, one bay wide, repeated over the walls. */
export function facade(style: "brick" | "glass" | "concrete" | "shops", ground = false) {
  return canvasTexture(`facade:${style}:${ground}`, 256, 256, (g, w, h) => {
    const wall = { brick: "#B4654A", glass: "#7FA6B8", concrete: "#C9C6BE", shops: "#C8A27A" }[style];
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    if (style === "brick" || style === "shops") {
      g.strokeStyle = "rgba(255,240,225,0.18)";
      g.lineWidth = 2;
      for (let y = 0; y < h; y += 16) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
        for (let x = (y / 16) % 2 ? 0 : 20; x < w; x += 40) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 16);
          g.stroke();
        }
      }
    }
    if (style === "glass") {
      g.fillStyle = "#8FB8C8";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,0.22)";
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(w * 0.55, 0);
      g.lineTo(w * 0.8, 0);
      g.lineTo(w * 0.25, h);
      g.fill();
      g.fillStyle = "#2E3B44";
      g.fillRect(0, h - 10, w, 10);
      g.fillRect(w / 2 - 3, 0, 6, h);
      g.fillRect(0, 0, 6, h);
      return;
    }
    if (ground && style === "shops") {
      g.fillStyle = "#3C4A52";
      g.fillRect(20, 60, w - 40, h - 60);
      g.fillStyle = "#9CC3D2";
      g.fillRect(28, 70, w - 56, h - 78);
      g.fillStyle = "#2E4D41";
      g.fillRect(10, 20, w - 20, 34);
      return;
    }
    // two windows per bay
    for (const x of [32, 144]) {
      g.fillStyle = style === "concrete" ? "#55606A" : "#E9E2D6";
      g.fillRect(x - 6, 54, 92, 132);
      g.fillStyle = "#6E93A6";
      g.fillRect(x, 60, 80, 120);
      g.fillStyle = "rgba(255,255,255,0.28)";
      g.fillRect(x, 60, 34, 120);
      g.fillStyle = style === "concrete" ? "#55606A" : "#E9E2D6";
      g.fillRect(x + 37, 60, 6, 120);
    }
  }, [1, 1]);
}

/** Soft vertical sky gradient for the background dome. */
export function skyGradient() {
  return canvasTexture("sky", 16, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#9CC6DE");
    grd.addColorStop(0.45, "#CFE4EA");
    grd.addColorStop(0.62, "#E8EFE4");
    grd.addColorStop(1, "#E8EFE4");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}
