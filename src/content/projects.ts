export type Project = {
  name: string;
  stack: string;
  description: string;
  mine: string;
  tags: string[];
  url?: string;
  urlLabel?: string;
};

export const projects: Project[] = [
  {
    name: "Total Party Planner",
    stack: "React",
    description: "A web platform for catering and event management.",
    mine: "I worked on event and menu management, proposal generation, and BEO and invoice generation, plus the calendar and accounting integrations.",
    tags: ["Event and menu management", "Proposals", "BEO and invoices", "Google, Outlook, QuickBooks"],
  },
  {
    name: "Custory",
    stack: "React",
    description:
      "A Singapore creative consultancy that combines brand strategy, content and campaigns, web design, custom merchandise and creator collaborations. It works in three phases: Research & Alignment, Execution, and Tracking & Optimization.",
    mine: "I work on it as a full stack developer, building the React frontend and the backend behind it.",
    tags: ["Brand strategy", "Content and social", "Web and digital", "Merchandise", "Creator collaborations"],
    url: "https://custory.com/",
    urlLabel: "custory.com",
  },
  {
    name: "Concord Seminar",
    stack: "Next.js, NestJS",
    description:
      "A dental continuing education provider with over 300 courses a year, delivered as live webinars, seminars and on-demand courses for dentists and dental hygienists. Courses carry PACE and ADA CERP CEU credit.",
    mine: "I work on it as a full stack developer: a Next.js frontend for presenting course content and handling user interaction, and a NestJS backend with a PostgreSQL database.",
    tags: ["Next.js", "NestJS", "PostgreSQL", "Live webinars", "On-demand courses", "CEU credit"],
    url: "https://www.concordseminars.com/",
    urlLabel: "concordseminars.com",
  },
  {
    name: "GeoWise",
    stack: "Next.js",
    description:
      "An AI booking and dispatch platform for field service businesses such as cleaning, HVAC, plumbing and pest control. It takes bookings through a WhatsApp AI receptionist, a booking widget and phone, then routes staff by service zone. Available in Arabic and English.",
    mine: "I worked on service-area scheduling, recurring bookings and subscription management.",
    tags: ["WhatsApp AI booking", "Dispatcher portal", "Route optimization", "Service zones", "Subscriptions"],
    url: "https://geowise.ai/",
    urlLabel: "geowise.ai",
  },
  {
    name: "Invoice Maker",
    stack: "React Native",
    description: "A cross-platform mobile invoicing app for iOS and Android.",
    mine: "I work on it as a full stack developer: the React Native screens for creating, managing and tracking invoices, clients and payments from a single codebase, plus the backend behind them.",
    tags: ["Invoices", "Clients", "Payments", "iOS and Android"],
  },
];
