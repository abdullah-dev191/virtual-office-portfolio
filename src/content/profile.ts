export const profile = {
  name: "Muhammad Abdullah",
  initials: "MA",
  role: "Full Stack Developer",
  location: "Burewala, Pakistan",
  email: "abdullahmalik0206@gmail.com",
  phone: "+92 303 9419903",
  phoneIntl: "+923039419903",
  whatsappUrl: "https://wa.me/923039419903",
  linkedinUrl: "https://linkedin.com/in/muhammad-abdullah-ab7978255",
  linkedinLabel: "muhammad-abdullah-ab7978255",
  company: "BurjSoft",
  // Month is 1-based. Used for the live tenure counter.
  startedAt: { year: 2023, month: 5 },
  summary:
    "Full stack developer with 3+ years of experience building production web and mobile products with",
  summaryHighlight: "React, Next.js, React Native and NestJS",
  summaryEnd: ", from specification to release.",
  statement:
    "Three years of turning UI and UX requirements into clean, reusable components.",
  statementMuted:
    "Across catering, brand consulting, dental education, home services and invoicing, working with backend engineers, designers and product owners.",
} as const;

export const nav = [
  { href: "#work", label: "Work" },
  { href: "#experience", label: "Experience" },
  { href: "#skills", label: "Skills" },
  { href: "#contact", label: "Contact" },
] as const;

export const facts = [
  {
    label: "Education",
    title: "BS (Honours) in Computer Science",
    lines: [
      "Government College University, Faisalabad, 2018 to 2022",
      "Final year project: Online Crime Reporting System",
    ],
  },
  {
    label: "Certified",
    title: "MERN Stack Developer",
    lines: ["Ideoversity, Lahore, Feb to Aug 2023"],
  },
  {
    label: "Languages",
    title: "",
    lines: ["Urdu and Punjabi (native), English (working)"],
  },
] as const;

export const marquee = [
  "JavaScript", "TypeScript", "React.js", "Next.js", "React Native", "Node.js",
  "NestJS", "Tailwind CSS", "Material UI", "Bootstrap", "REST APIs", "Git",
] as const;
