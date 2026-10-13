export const duties = [
  {
    title: "Responsive interfaces",
    text: "Developed and maintained responsive, cross-browser web and mobile interfaces with React.js, Next.js and React Native across multiple client products.",
  },
  {
    title: "Reusable components",
    text: "Built reusable UI components and optimized rendering performance to improve page load times and the overall user experience.",
  },
  {
    title: "Team delivery",
    text: "Worked with backend engineers, designers and product owners in an agile workflow, taking features from specification through production.",
  },
  {
    title: "Integrations",
    text: "Integrated REST APIs and third-party services, including payment gateways, calendar systems and accounting tools, to support core business workflows.",
  },
] as const;

export const experienceStack = ["React.js", "Next.js", "React Native", "Node.js", "NestJS"] as const;

/** Core stack shown first in the Tech Lab. */
export const coreStack = [
  "React", "Next.js", "React Native", "Node.js", "NestJS", "TypeScript", "PostgreSQL", "Docker", "Git",
] as const;

export const skillGroups = [
  { title: "Languages and core", items: ["JavaScript", "TypeScript", "HTML5", "CSS3"] },
  { title: "Frameworks and libraries", items: ["React.js", "Next.js", "React Native", "Node.js", "NestJS"] },
  { title: "Data and delivery", items: ["PostgreSQL", "Docker", "Git"] },
  { title: "UI libraries", items: ["Bootstrap", "Material UI", "Tailwind CSS"] },
  {
    title: "Tools and practices",
    items: ["REST API integration", "JSON Server", "AI-assisted development", "Responsive design", "VS Code"],
  },
] as const;

/** Design Room: how UI work gets done, restated from the duties above. */
export const designApproach = [
  {
    title: "From requirements to components",
    text: "UI and UX requirements become clean, reusable components that other screens can build on.",
  },
  {
    title: "Responsive and cross-browser",
    text: "Interfaces that hold up across screen sizes and browsers, on the web with React and Next.js and on mobile with React Native.",
  },
  {
    title: "Component libraries and performance",
    text: "Shared components keep products consistent, and rendering work keeps page loads fast and the experience smooth.",
  },
  {
    title: "Working with designers",
    text: "Day-to-day collaboration with designers, backend engineers and product owners in an agile workflow.",
  },
] as const;

export const designTools = ["Tailwind CSS", "Material UI", "Bootstrap", "HTML5", "CSS3"] as const;
