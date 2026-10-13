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
  fair: "#EFCBAE",
  light: "#DDB293",
  wheat: "#C7977A",
  tan: "#AA7C5C",
  brown: "#80583F",
  deep: "#5D3E2E",
} as const;

export const HAIR = {
  black: "#1A1614",
  dark: "#2B1D16",
  brown: "#4A3426",
  chestnut: "#5E4130",
  auburn: "#6B3A24",
} as const;
