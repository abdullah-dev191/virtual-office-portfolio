"use client";

import type { ReactNode } from "react";
import { duties, experienceStack, skillGroups } from "@/content/experience";
import { facts, marquee, profile } from "@/content/profile";
import { projects } from "@/content/projects";
import type { RoomId } from "@/office/layout";

function tenure() {
  const now = new Date();
  const months = (now.getFullYear() - profile.startedAt.year) * 12 + (now.getMonth() + 1 - profile.startedAt.month);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} yr${y === 1 ? "" : "s"} ${m} mo`;
}

export const roomMeta: Record<RoomId, { eyebrow: string; title: string; sub: string }> = {
  work: { eyebrow: "WORK STUDIO", title: "Selected work", sub: "Products I have built and shipped." },
  tech: { eyebrow: "TECH LAB", title: "Skills and stack", sub: "The tools I reach for every day." },
  ops: { eyebrow: "OPERATIONS", title: "Experience", sub: `${profile.role} at ${profile.company}, since May 2023.` },
  meet: { eyebrow: "MEETING ROOM", title: "Let's talk", sub: "Pull up a chair. Here is how to reach me." },
  boss: { eyebrow: "BOSS CABIN", title: profile.name, sub: `${profile.role}, ${profile.location}.` },
};

function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="tags">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function WorkBody({ focus }: { focus?: number | null }) {
  return (
    <div className="stack">
      {projects.map((p, i) => (
        <article key={p.name} className={`proj${focus === i ? " focus" : ""}`}>
          <header>
            <h3>{p.name}</h3>
            <span>{p.stack}</span>
          </header>
          <p>{p.description}</p>
          <p className="mine">{p.mine}</p>
          <Tags items={p.tags} />
          {p.url && (
            <a className="link" href={p.url} target="_blank" rel="noopener noreferrer">
              Visit {p.urlLabel} ↗
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

export function TechBody() {
  return (
    <div className="stack">
      {skillGroups.map((g) => (
        <section key={g.title}>
          <h4>{g.title}</h4>
          <Tags items={g.items} />
        </section>
      ))}
      <section>
        <h4>Daily drivers</h4>
        <Tags items={marquee} />
      </section>
    </div>
  );
}

export function OpsBody() {
  return (
    <div className="stack">
      <section className="role">
        <div>
          <h3>{profile.role}</h3>
          <span>{profile.company} · May 2023 to present</span>
        </div>
        <strong>{tenure()}</strong>
      </section>
      <Tags items={experienceStack} />
      {duties.map((d) => (
        <section key={d.title}>
          <h4>{d.title}</h4>
          <p>{d.text}</p>
        </section>
      ))}
    </div>
  );
}

export function MeetBody() {
  const rows: [string, string, string][] = [
    ["Email", profile.email, `mailto:${profile.email}`],
    ["Phone", profile.phone, `tel:${profile.phoneIntl}`],
    ["WhatsApp", "Message on WhatsApp", profile.whatsappUrl],
    ["LinkedIn", profile.linkedinLabel, profile.linkedinUrl],
  ];
  return (
    <div className="stack">
      {rows.map(([k, v, href]) => (
        <a key={k} className="contact" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
          <span>{k}</span>
          <b>{v}</b>
          <i>↗</i>
        </a>
      ))}
      <p className="muted">Based in {profile.location}.</p>
    </div>
  );
}

export function BossBody() {
  return (
    <div className="stack">
      <p className="lead">
        {profile.summary} <b>{profile.summaryHighlight}</b>
        {profile.summaryEnd}
      </p>
      <p>
        {profile.statement} <span className="muted">{profile.statementMuted}</span>
      </p>
      {facts.map((f) => (
        <section key={f.label}>
          <h4>{f.label}</h4>
          {f.title && <h3>{f.title}</h3>}
          {f.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function RoomBody({ id, focus }: { id: RoomId; focus?: number | null }): ReactNode {
  switch (id) {
    case "work":
      return <WorkBody focus={focus} />;
    case "tech":
      return <TechBody />;
    case "ops":
      return <OpsBody />;
    case "meet":
      return <MeetBody />;
    case "boss":
      return <BossBody />;
  }
}
