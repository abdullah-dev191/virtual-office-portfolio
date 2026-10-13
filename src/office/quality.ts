/** Graphics quality: pixel ratio, shadow map size, antialiasing and how many cars, walkers and staff are drawn. */
export type Quality = "low" | "medium" | "high";

export const QUALITY: Record<Quality, { dpr: number; shadows: number; aa: boolean; cars: number; walkers: number; staff: number }> = {
  low: { dpr: 1, shadows: 0, aa: false, cars: 8, walkers: 5, staff: 4 },
  medium: { dpr: 1.5, shadows: 1024, aa: true, cars: 11, walkers: 9, staff: 7 },
  high: { dpr: 2, shadows: 2048, aa: true, cars: 14, walkers: 14, staff: 10 },
};

/** Phones and small or slow devices start on Low. */
export function autoQuality(): Quality {
  if (typeof window === "undefined") return "high";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  if (coarse || small) return "low";
  const cores = navigator.hardwareConcurrency ?? 8;
  return cores <= 4 ? "medium" : "high";
}
