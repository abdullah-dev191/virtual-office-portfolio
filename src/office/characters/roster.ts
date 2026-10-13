/** Who wears what. Bodies are recoloured per role so a few files give a varied crowd. */
import { departments, type DeptId } from "@/content/departments";
import { seats } from "../layout";
import { HAIR, SKIN, type Look } from "./looks";

export type VisitorLook = { id: string; name: string; swatch: string; look: Look };

/** The three looks on the welcome card. The first is the default (blue tee, jeans, white sneakers). */
export const visitorLooks: VisitorLook[] = [
  {
    id: "tee",
    name: "Blue tee",
    swatch: "#3D6FB6",
    look: { body: "casual", colors: { top: "#3D6FB6", bottom: "#2E4A6E", shoes: "#F2F2EE", sole: "#C9C9C4", skin: SKIN.wheat, hair: HAIR.dark } },
  },
  {
    id: "hoodie",
    name: "Green hoodie",
    swatch: "#2E6B57",
    look: { body: "hoodie", colors: { top: "#2E6B57", bottom: "#36506E", shoes: "#2B2B2B", sole: "#EDEDED", skin: SKIN.tan, hair: HAIR.black } },
  },
  {
    id: "jacket",
    name: "Denim and white",
    swatch: "#F2EFE6",
    look: { body: "tee", colors: { top: "#F2EFE6", bottom: "#3B5A86", shoes: "#2B2B2B", skin: SKIN.light, hair: HAIR.brown } },
  },
];

export const receptionist: Look = {
  body: "dress",
  colors: { top: "#2F3E57", belt: "#C9A46A", shoes: "#2B2B2B", skin: SKIN.wheat, hair: HAIR.dark },
};

export const guard: Look = {
  body: "suit",
  colors: { top: "#1F2A3A", bottom: "#1F2A3A", shirt: "#A9BCD0", tie: "#14181F", shoes: "#141414", skin: SKIN.brown, hair: HAIR.black },
  cap: true,
};

export const boss: Look = {
  body: "suit",
  colors: { top: "#2E3135", bottom: "#2E3135", shirt: "#F4F2EC", tie: "#7A2E34", shoes: "#1B1B1B", skin: SKIN.tan, hair: HAIR.black },
};

/** The person who hosts each department. */
export const hosts: Record<DeptId, Look> = {
  work: { body: "casual", colors: { top: "#6E948A", bottom: "#2B3A55", shoes: "#3B3B3B", sole: "#E8E8E2", skin: SKIN.brown, hair: HAIR.black } },
  design: { body: "tee", colors: { top: "#D9B24C", bottom: "#2B3A55", shoes: "#7A2E34", skin: SKIN.light, hair: HAIR.auburn } },
  tech: { body: "hoodie", colors: { top: "#33373C", bottom: "#4A5A6A", shoes: "#D5D5D0", sole: "#FFFFFF", skin: SKIN.wheat, hair: HAIR.dark } },
  meet: { body: "suit", colors: { top: "#8D7B68", bottom: "#2B3A55", shirt: "#F4F2EC", tie: "#F4F2EC", shoes: "#3A2A20", skin: SKIN.fair, hair: HAIR.chestnut } },
  ops: { body: "dress", colors: { top: "#2E5E62", belt: "#2B2B2B", shoes: "#2B2B2B", skin: SKIN.tan, hair: HAIR.black } },
  lounge: { body: "punk", colors: { top: "#B9A3D6", accent: "#3A3F4B", hair: HAIR.brown, bottom: "#3B4A63", shoes: "#EDEDED", skin: SKIN.light } },
  boss,
};

/** Work Studio teammates. */
export const teammates: Look[] = [
  { body: "tee", colors: { top: "#E07B5F", bottom: "#33414F", shoes: "#EDEDED", skin: SKIN.brown, hair: HAIR.black } },
  { body: "hoodie", colors: { top: "#4A73A8", bottom: "#2E3A48", shoes: "#2B2B2B", skin: SKIN.light, hair: HAIR.blond } },
];

const tops = ["#C98A6B", "#6E8F83", "#8D7BA8", "#D9B24C", "#5F83B1", "#B05A5A", "#3F6C59", "#E0B8A0", "#7C8A96", "#A3B86C"];
const bottoms = ["#33414F", "#2B3A55", "#4A4A4A", "#5A4636", "#3B4A63"];
const skins = Object.values(SKIN);
const hairs = Object.values(HAIR);

/** Open-office staff, varied deterministically by index. */
export function staffLook(i: number): Look {
  const bodies = ["suit", "tee", "casual", "dress", "hoodie", "tee", "casual", "dress", "suit", "punk"] as const;
  const body = bodies[i % bodies.length];
  const top = tops[(i * 3) % tops.length];
  const colors: Look["colors"] = { top, bottom: bottoms[i % bottoms.length], skin: skins[(i * 5 + 1) % skins.length], hair: hairs[(i * 7 + 2) % hairs.length] };
  if (body === "suit") Object.assign(colors, { shirt: "#F4F2EC", tie: tops[(i * 3 + 4) % tops.length], bottom: top });
  if (body === "punk") Object.assign(colors, { hair: HAIR.dark, accent: "#3A3F4B" });
  return { body, colors };
}

/** Pedestrians: every body, everyday colours. */
export function pedestrianLook(i: number): Look {
  const bodies = ["casual", "tee", "worker", "explorer", "hoodie", "dress", "punk", "suit", "casual", "tee", "explorer", "hoodie", "dress", "casual"] as const;
  const body = bodies[i % bodies.length];
  const colors: Look["colors"] = {
    top: tops[(i * 7 + 3) % tops.length],
    bottom: bottoms[(i * 3 + 1) % bottoms.length],
    skin: skins[(i * 11 + 2) % skins.length],
    hair: hairs[(i * 5 + 3) % hairs.length],
  };
  if (body === "worker") Object.assign(colors, { vest: "#E07B2E", stripes: "#F2E4A0", hat: "#F2C14E", top: "#8A8F96", bottom: "#4A4A4A" });
  if (body === "suit") Object.assign(colors, { shirt: "#F4F2EC", bottom: colors.top });
  return { body, colors };
}

export type Cast = { look: Look; label?: string; staff: boolean };

/** The look and name pill of whoever sits on each NPC seat (used by the director and the renderer alike). */
export const seatCast: Map<string, Cast> = (() => {
  const out = new Map<string, Cast>();
  let team = 0;
  let staff = 0;
  for (const s of seats) {
    if (s.occupant !== "npc") continue;
    if (s.role === "reception") out.set(s.id, { look: receptionist, label: "RECEPTIONIST", staff: false });
    else if (s.role === "boss") out.set(s.id, { look: boss, label: departments.boss.host, staff: false });
    else if (s.role === "admin" || s.role === "guest") {
      const d = s.dept as DeptId;
      out.set(s.id, { look: hosts[d], label: departments[d].host || undefined, staff: false });
    } else if (s.role === "team") out.set(s.id, { look: teammates[team++ % teammates.length], staff: false });
    else out.set(s.id, { look: staffLook(staff++), staff: true });
  }
  return out;
})();

/** Footballers: two teams, shorts bodies. */
export function footballerLook(team: 0 | 1, i: number): Look {
  const kit = team === 0 ? { top: "#C8443A", bottom: "#F4F2EC" } : { top: "#2F5FA8", bottom: "#1E2A3A" };
  return {
    body: i % 2 ? "hoodie" : "explorer",
    colors: { ...kit, vest: kit.top, shirt: kit.top, shoes: "#202020", sole: "#EDEDED", socks: kit.top, skin: skins[(i * 3 + team * 2) % skins.length], hair: hairs[(i + team * 3) % hairs.length] },
  };
}
