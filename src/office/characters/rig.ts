/** Clip names, playback rules and measured numbers for the rigged people (see rig.generated.ts). */
import { BODIES, RIGS } from "./rig.generated";

export type BodyKey = keyof typeof BODIES;
export type Sex = "m" | "f";
export type ClipName = keyof (typeof RIGS)["m"]["clips"];

export const bodyKeys = Object.keys(BODIES) as BodyKey[];
export const sexOf = (b: BodyKey): Sex => BODIES[b].sex;

/** Clips that play once and hold their last frame. */
export const ONCE: ReadonlySet<ClipName> = new Set<ClipName>(["SitDown", "StandUp", "Reach", "Knock", "Kick", "Wave"]);

/** Cross-fade time into each clip (seconds). */
export const FADE: Partial<Record<ClipName, number>> = { SitDown: 0.2, StandUp: 0.15, Kick: 0.12, Reach: 0.2 };
export const DEFAULT_FADE = 0.25;

export const clipLength = (sex: Sex, clip: ClipName) => RIGS[sex].clips[clip];
/** Speed (m/s) at which each walk / run cycle keeps the planted foot still. */
export const walkSpeed = (sex: Sex) => RIGS[sex].walkSpeed;
export const runSpeed = (sex: Sex) => RIGS[sex].runSpeed;

/** Where the hips start (in front of the seat) when SitDown begins and where StandUp leaves them. */
export const SIT_START = Math.max(RIGS.m.sitStart[1], RIGS.f.sitStart[1]);

/**
 * Anything that can be drawn as a person: director actors, pedestrians, footballers.
 * Plain mutable fields, read every frame by CharacterModel.
 */
export interface Puppet {
  x: number;
  y: number;
  z: number;
  yaw: number;
  anim: ClipName;
  /** Bump to restart a one-shot clip even when the name does not change. */
  animKey: number;
  /** Playback rate (walk and run cycles are matched to ground speed). */
  rate: number;
  /** World point to turn the head towards, or null. */
  look: [number, number, number] | null;
  visible: boolean;
  /** Speech bubble text, or null. */
  bubble: string | null;
}

export function makePuppet(x = 0, z = 0, yaw = 0, anim: ClipName = "Idle"): Puppet {
  return { x, y: 0, z, yaw, anim, animKey: 0, rate: 1, look: null, visible: true, bubble: null };
}

/** Starts a clip on a puppet (restarting one-shots). */
export function setAnim(p: Puppet, anim: ClipName, rate = 1) {
  if (p.anim !== anim || ONCE.has(anim)) p.animKey++;
  p.anim = anim;
  p.rate = rate;
}
