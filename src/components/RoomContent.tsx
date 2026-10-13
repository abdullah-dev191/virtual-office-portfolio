"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { bossAsks, type DeptId } from "@/content/departments";
import { coreStack, designApproach, designTools, duties, experienceStack, skillGroups } from "@/content/experience";
import { facts, profile, quickFacts } from "@/content/profile";
import { projects } from "@/content/projects";

function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="tags">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** Time at BurjSoft, recomputed every minute. */
function useTenure() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return { label: "", days: 0 };
  const start = new Date(profile.startedAt.year, profile.startedAt.month - 1, 1);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return { label: `${y} yr${y === 1 ? "" : "s"} ${m} mo`, days };
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

export function DesignBody() {
  return (
    <div className="stack">
      <p className="lead">{profile.statement}</p>
      {designApproach.map((d) => (
        <section key={d.title}>
          <h4>{d.title}</h4>
          <p>{d.text}</p>
        </section>
      ))}
      <section>
        <h4>Tools</h4>
        <Tags items={designTools} />
      </section>
    </div>
  );
}

export function TechBody() {
  return (
    <div className="stack">
      <section>
        <h4>Core stack</h4>
        <Tags items={coreStack} />
      </section>
      {skillGroups.map((g) => (
        <section key={g.title}>
          <h4>{g.title}</h4>
          <Tags items={g.items} />
        </section>
      ))}
    </div>
  );
}

export function OpsBody() {
  const t = useTenure();
  return (
    <div className="stack">
      <section className="role">
        <div>
          <h3>{profile.role}</h3>
          <span>{profile.company} · May 2023 to present</span>
        </div>
        <div className="tenure" aria-live="off">
          <strong>{t.label}</strong>
          {t.days > 0 && <span>{t.days.toLocaleString("en-GB")} days</span>}
        </div>
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
    ["WhatsApp", profile.phone, profile.whatsappUrl],
    ["LinkedIn", profile.linkedinLabel, profile.linkedinUrl],
  ];
  return (
    <div className="stack">
      {rows.map(([k, v, href]) => (
        <a key={k} className="contact" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
          <span>{k}</span>
          <b>{v}</b>
          <i aria-hidden>↗</i>
        </a>
      ))}
      <p className="muted">Based in {profile.location}.</p>
    </div>
  );
}

export function LoungeBody() {
  return (
    <div className="stack">
      {facts.map((f) => (
        <section key={f.label}>
          <h4>{f.label}</h4>
          {f.title && <h3>{f.title}</h3>}
          {f.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </section>
      ))}
      <section>
        <h4>Quick facts</h4>
        <ul className="facts">
          {quickFacts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const ANSWER_KEY = "office.bossAnswer";

/** "The boss asks": a question, a textarea, saved on this device. */
export function BossAsk({ onSaved }: { onSaved?: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(localStorage.getItem(ANSWER_KEY) ?? "");
    } catch {
      // storage can be unavailable (private mode); the box still works for this visit
    }
  }, []);
  const save = () => {
    try {
      localStorage.setItem(ANSWER_KEY, text);
    } catch {
      // ignore: nothing else depends on it
    }
    setSaved(true);
    onSaved?.();
  };
  const mail = `mailto:${profile.email}?subject=${encodeURIComponent("Hello from your office")}&body=${encodeURIComponent(text)}`;
  return (
    <section className="ask">
      <p className="eyebrow">{bossAsks.eyebrow}</p>
      <label htmlFor={id} className="ask-q">
        {bossAsks.question}
      </label>
      <textarea id={id} rows={3} value={text} placeholder={bossAsks.placeholder} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button className="pillbtn" onClick={save}>
          {bossAsks.save}
        </button>
        {text.trim() && (
          <a className="link" href={mail}>
            {bossAsks.email}
          </a>
        )}
      </div>
      {saved && (
        <p className="muted small" role="status">
          {bossAsks.saved}
        </p>
      )}
    </section>
  );
}

export function BossBody({ onSaved }: { onSaved?: () => void }) {
  return (
    <div className="stack">
      <p className="lead">
        {profile.summary} <b>{profile.summaryHighlight}</b>
        {profile.summaryEnd}
      </p>
      <p>
        {profile.statement} <span className="muted">{profile.statementMuted}</span>
      </p>
      <BossAsk onSaved={onSaved} />
    </div>
  );
}

export function RoomBody({ id, focus, onBossSaved }: { id: DeptId; focus?: number | null; onBossSaved?: () => void }): ReactNode {
  switch (id) {
    case "work":
      return <WorkBody focus={focus} />;
    case "design":
      return <DesignBody />;
    case "tech":
      return <TechBody />;
    case "meet":
      return <MeetBody />;
    case "ops":
      return <OpsBody />;
    case "lounge":
      return <LoungeBody />;
    case "boss":
      return <BossBody onSaved={onBossSaved} />;
  }
}
