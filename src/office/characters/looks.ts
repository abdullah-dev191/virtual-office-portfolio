/**
 * Looks: which body a person uses and how its clothes, hair and skin are recoloured.
 * Each vertex of a body carries a palette slot (_matid); a look maps slot roles to colours (see lookGeometry.ts).
 */
import type { BodyKey } from "./rig";

export type Role =
  | "skin" | "skinShade" | "hair" | "hair2" | "brows" | "eyes"
  | "top" | "shirt" | "tie" | "bottom" | "shoes" | "sole"
  | "belt" | "accent" | "vest" | "stripes" | "hat" | "socks";

export type Look = {
  body: BodyKey;
  colors: Partial<Record<Role, string>>;
  /** Security cap on the head bone. */
  cap?: boolean;
};

export const SKIN = {
  fair: "#F1C7A0",
  light: "#E0AC86",
  wheat: "#C99068",
  tan: "#B07650",
  brown: "#8D5A3B",
  deep: "#6B4430",
} as const;

export const HAIR = {
  black: "#1A1614",
  dark: "#2B1D16",
  brown: "#4A3426",
  chestnut: "#6B4A32",
  auburn: "#7A3B22",
  blond: "#C9A46A",
  grey: "#8E8A86",
} as const;
