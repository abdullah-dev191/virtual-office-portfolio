import { profile } from "./profile";

export type DeptId = "work" | "design" | "tech" | "meet" | "ops" | "lounge" | "boss";
export type PlaceId = "reception" | DeptId;

/** The numbered places in the left-hand list, in order. */
export const places: { id: PlaceId; no: string; name: string }[] = [
  { id: "reception", no: "01", name: "Reception" },
  { id: "work", no: "02", name: "Work Studio" },
  { id: "design", no: "03", name: "Design Room" },
  { id: "tech", no: "04", name: "Tech Lab" },
  { id: "meet", no: "05", name: "Meeting Room" },
  { id: "ops", no: "06", name: "Operations" },
  { id: "lounge", no: "07", name: "The Lounge" },
  { id: "boss", no: "08", name: "Boss Cabin" },
];

export type Department = {
  id: DeptId;
  name: string;
  /** Pill above the person who hosts the room (empty for none). */
  host: string;
  /** Short label on the reception menu. */
  menu: string;
  /** Content card heading. */
  eyebrow: string;
  title: string;
  sub: string;
  /** What the host says when you sit down. */
  greeting: string;
};

export const departments: Record<DeptId, Department> = {
  work: {
    id: "work",
    name: "Work Studio",
    host: "PROJECT LEAD",
    menu: "Projects",
    eyebrow: "WORK STUDIO",
    title: "Selected work",
    sub: "Products I have built and shipped.",
    greeting: "Here's what we've shipped.",
  },
  design: {
    id: "design",
    name: "Design Room",
    host: "UI LEAD",
    menu: "UI and UX",
    eyebrow: "DESIGN ROOM",
    title: "Interfaces and craft",
    sub: "How UI and UX requirements become clean, reusable components.",
    greeting: "Let's talk components.",
  },
  tech: {
    id: "tech",
    name: "Tech Lab",
    host: "TECH LEAD",
    menu: "Skills",
    eyebrow: "TECH LAB",
    title: "Skills and stack",
    sub: "The tools I reach for every day.",
    greeting: "Welcome to the lab.",
  },
  meet: {
    id: "meet",
    name: "Meeting Room",
    host: "COORDINATOR",
    menu: "Contact",
    eyebrow: "MEETING ROOM",
    title: "Let's talk",
    sub: "Pull up a chair. Here is how to reach me.",
    greeting: "Thanks for coming in.",
  },
  ops: {
    id: "ops",
    name: "Operations",
    host: "OPERATIONS MANAGER",
    menu: "Experience",
    eyebrow: "OPERATIONS",
    title: "Experience",
    sub: `${profile.role} at ${profile.company}, since May 2023.`,
    greeting: "Here's the track record.",
  },
  lounge: {
    id: "lounge",
    name: "The Lounge",
    host: "",
    menu: "Education",
    eyebrow: "THE LOUNGE",
    title: "Off the clock",
    sub: "Education, certification and languages.",
    greeting: "Grab a seat.",
  },
  boss: {
    id: "boss",
    name: "Boss Cabin",
    host: "THE BOSS",
    menu: "About me",
    eyebrow: "BOSS CABIN",
    title: profile.name,
    sub: `${profile.role}, ${profile.location}.`,
    greeting: "Come in, have a seat.",
  },
};

/** Rooms offered on the reception menu grid (the boss has its own button). */
export const menuRooms: DeptId[] = ["work", "design", "tech", "meet", "ops", "lounge"];

/** Order used by "Watch demo". */
export const tour: DeptId[] = ["work", "design", "tech", "meet", "ops", "boss", "lounge"];

export const bossAsks = {
  eyebrow: "THE BOSS ASKS",
  question: "What would you like to build together?",
  placeholder: "A product, a feature, a tricky bug…",
  save: "Save & go to lounge ↗",
  saved: "Saved on this device.",
  email: "Send it by email ↗",
};

export const reception = {
  eyebrow: "RECEPTION",
  title: "How can I help you?",
  sub: "Welcome in! Make yourself at home.",
  boss: "Meet the boss · knock first ↗",
  explore: "Just exploring ↗",
};

export const welcome = {
  eyebrow: "WELCOME",
  title: "Welcome to the office",
  walking: "Walking to reception…",
  skip: "Skip to reception ↗",
  pick: "Pick your look",
};
