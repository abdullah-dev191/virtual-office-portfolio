/**
 * Camera rig (plain TypeScript): aerial intro, isometric follow cam with look-ahead, seated framing,
 * presets, zoom and drag-to-pan. The scene calls update() every frame and copies the result to the camera.
 */
import { clamp, smooth, type V2 } from "./geom";

export type CamMode = "intro" | "follow" | "seated" | "preset" | "pan";
export type Preset = "full" | "neighbourhood" | "football" | "park";

type Pose = { tx: number; ty: number; tz: number; dist: number; pitch: number; yaw: number };

export const PRESETS: Record<Preset, Pose> = {
  full: { tx: 0, ty: 0, tz: -3.5, dist: 54, pitch: 1.08, yaw: 0 },
  neighbourhood: { tx: 0, ty: 0, tz: 16, dist: 185, pitch: 1.0, yaw: 0.12 },
  football: { tx: 12, ty: 0, tz: 45, dist: 38, pitch: 0.92, yaw: -0.15 },
  park: { tx: -13, ty: 0, tz: 44, dist: 36, pitch: 0.95, yaw: 0.2 },
};

const AERIAL: Pose = { tx: 0, ty: 0, tz: 12, dist: 175, pitch: 1.05, yaw: 0.35 };
const INTRO_HOLD = 0.9;
const INTRO_GLIDE = 4.2;

export type Frame = { x: number; y: number; z: number; tx: number; ty: number; tz: number };

export type Viewport = { width: number; height: number; fov: number };

export class CameraRig {
  mode: CamMode = "intro";
  zoom = 1;
  reduced = false;
  preset: Preset | null = null;
  /** Seated framing: the visitor's seat and who they sit with. */
  seated: { a: V2; b: V2 | null } | null = null;
  /** Where the side card sits on wide screens, so framing keeps the subject clear of it. */
  cardSide: "right" | "bottom" | "none" = "none";
  private t = 0;
  private cur: Pose = { ...AERIAL };
  private pan: { tx: number; tz: number } | null = null;
  private onIntroDone?: () => void;

  startIntro(onDone?: () => void) {
    this.mode = "intro";
    this.t = 0;
    this.cur = { ...AERIAL };
    this.onIntroDone = onDone;
  }

  skipIntro() {
    if (this.mode !== "intro") return;
    this.t = INTRO_HOLD + INTRO_GLIDE;
  }

  get introRunning() {
    return this.mode === "intro" && this.t < INTRO_HOLD + INTRO_GLIDE;
  }

  follow() {
    this.mode = "follow";
    this.preset = null;
    this.pan = null;
  }

  setPreset(p: Preset) {
    this.mode = "preset";
    this.preset = p;
    this.pan = null;
  }

  setSeated(a: V2, b: V2 | null) {
    this.mode = "seated";
    this.seated = { a, b };
  }

  zoomBy(k: number) {
    this.zoom = clamp(this.zoom * k, 0.45, 2.6);
  }

  /** Starts free panning from wherever the camera looks now. */
  startPan() {
    if (this.mode !== "pan") this.pan = { tx: this.cur.tx, tz: this.cur.tz };
    this.mode = "pan";
  }

  /** Moves the view by a screen drag (pixels). */
  panBy(dx: number, dy: number, vp: Viewport) {
    if (!this.pan) this.startPan();
    const p = this.pan as { tx: number; tz: number };
    const metresPerPx = (2 * this.cur.dist * Math.tan((vp.fov * Math.PI) / 360)) / vp.height;
    const cy = Math.cos(this.cur.yaw);
    const sy = Math.sin(this.cur.yaw);
    p.tx -= (dx * cy + dy * sy / Math.sin(this.cur.pitch)) * metresPerPx;
    p.tz -= (-dx * sy + (dy * cy) / Math.sin(this.cur.pitch)) * metresPerPx;
    p.tx = clamp(p.tx, -95, 95);
    p.tz = clamp(p.tz, -90, 105);
  }

  private goal(visitor: { x: number; z: number; vx: number; vz: number }, vp: Viewport): Pose {
    const portrait = vp.height > vp.width * 1.05;
    const far = portrait ? 1 + (vp.height / vp.width - 1) * 0.85 : 1;
    if (this.mode === "preset" && this.preset) {
      const p = PRESETS[this.preset];
      return { ...p, dist: p.dist * this.zoom * (portrait ? 1.35 : 1) };
    }
    if (this.mode === "pan" && this.pan) return { tx: this.pan.tx, ty: 0, tz: this.pan.tz, dist: this.cur.dist, pitch: this.cur.pitch, yaw: this.cur.yaw };
    if (this.mode === "seated" && this.seated) {
      const { a, b } = this.seated;
      const mx = b ? (a[0] + b[0]) / 2 : a[0];
      const mz = b ? (a[1] + b[1]) / 2 : a[1];
      const span = b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 2;
      const dist = (6.2 + span * 1.1) * this.zoom * far;
      const half = dist * Math.tan((vp.fov * Math.PI) / 360);
      // push the subject away from the card: left of centre on desktop, upper half on phones
      const dx = this.cardSide === "right" ? half * (vp.width / vp.height) * 0.36 : 0;
      const dz = this.cardSide === "bottom" ? half * 0.55 : 0;
      return { tx: mx + dx, ty: 0.6, tz: mz + dz, dist, pitch: 0.86, yaw: 0 };
    }
    // follow: isometric-style from the south, a little look-ahead, visitor in the upper middle of the screen
    const dist = 18.5 * this.zoom * far;
    const ahead = 0.45;
    const lx = clamp(visitor.vx * ahead, -1.6, 1.6);
    const lz = clamp(visitor.vz * ahead, -1.6, 1.6);
    const lift = dist * 0.13 * (portrait ? 1.6 : 1);
    return { tx: visitor.x + lx, ty: 0.6, tz: visitor.z + lz + lift, dist, pitch: 0.92, yaw: 0 };
  }

  update(dt: number, visitor: { x: number; z: number; vx: number; vz: number }, vp: Viewport): Frame {
    const goal = this.goal(visitor, vp);
    if (this.mode === "intro") {
      this.t += dt;
      const k = this.reduced ? 1 : smooth(clamp((this.t - INTRO_HOLD) / INTRO_GLIDE, 0, 1));
      const follow = this.goalFollow(visitor, vp);
      this.cur = lerpPose(AERIAL, follow, k);
      if (k >= 1) {
        this.mode = "follow";
        this.onIntroDone?.();
        this.onIntroDone = undefined;
      }
    } else {
      const k = this.reduced ? 1 : 1 - Math.exp(-dt * (this.mode === "follow" ? 3.2 : 2.4));
      this.cur = lerpPose(this.cur, goal, k);
    }
    return toFrame(this.cur);
  }

  private goalFollow(visitor: { x: number; z: number; vx: number; vz: number }, vp: Viewport) {
    const mode = this.mode;
    this.mode = "follow";
    const g = this.goal(visitor, vp);
    this.mode = mode;
    return g;
  }

  /** Current distance from the look-at point (for fog, shadows and labels). */
  get distance() {
    return this.cur.dist;
  }
  get lookAt(): [number, number, number] {
    return [this.cur.tx, this.cur.ty, this.cur.tz];
  }
}

function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    tx: a.tx + (b.tx - a.tx) * k,
    ty: a.ty + (b.ty - a.ty) * k,
    tz: a.tz + (b.tz - a.tz) * k,
    dist: a.dist + (b.dist - a.dist) * k,
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    yaw: a.yaw + (b.yaw - a.yaw) * k,
  };
}

function toFrame(p: Pose): Frame {
  const h = Math.cos(p.pitch) * p.dist;
  return {
    x: p.tx + Math.sin(p.yaw) * h,
    y: p.ty + Math.sin(p.pitch) * p.dist,
    z: p.tz + Math.cos(p.yaw) * h,
    tx: p.tx,
    ty: p.ty,
    tz: p.tz,
  };
}
