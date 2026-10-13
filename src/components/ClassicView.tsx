"use client";

import { departments, type DeptId } from "@/content/departments";
import { profile } from "@/content/profile";
import { RoomBody } from "./RoomContent";

const ORDER: DeptId[] = ["work", "design", "tech", "ops", "lounge", "meet"];

/** Plain scrolling version of the portfolio: no 3D, same content. */
export function ClassicView({ onEnter, note }: { onEnter?: () => void; note?: string }) {
  return (
    <div className="classic">
      <header className="classic-top">
        <b>{profile.name}</b>
        {onEnter && (
          <button className="pillbtn" onClick={onEnter}>
            Enter the 3D office ↗
          </button>
        )}
      </header>
      <main id="main">
        {note && <p className="classic-note">{note}</p>}
        <section className="classic-hero" aria-labelledby="classic-name">
          <p className="eyebrow">PORTFOLIO</p>
          <h1 id="classic-name">{profile.name}</h1>
          <p className="sub">
            {profile.role} · {profile.company} · {profile.location}
          </p>
          <p className="lead">
            {profile.summary} <b>{profile.summaryHighlight}</b>
            {profile.summaryEnd}
          </p>
          <p>
            {profile.statement} <span className="muted">{profile.statementMuted}</span>
          </p>
        </section>
        {ORDER.map((id) => {
          const d = departments[id];
          return (
            <section key={id} className="classic-sec" aria-labelledby={`sec-${id}`}>
              <p className="eyebrow">{d.eyebrow}</p>
              <h2 id={`sec-${id}`}>{d.title}</h2>
              <p className="sub">{d.sub}</p>
              <RoomBody id={id} />
            </section>
          );
        })}
      </main>
    </div>
  );
}
