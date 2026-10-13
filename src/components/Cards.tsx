"use client";

import { useEffect, useRef } from "react";
import { departments, menuRooms, reception, tour, welcome, type DeptId } from "@/content/departments";
import { visitorLooks } from "@/office/characters/roster";
import { RoomBody } from "./RoomContent";

export function WelcomeCard({ lookId, onLook, onSkip }: { lookId: string; onLook: (id: string) => void; onSkip: () => void }) {
  return (
    <section className="card" aria-labelledby="welcome-title">
      <p className="eyebrow">{welcome.eyebrow}</p>
      <h2 id="welcome-title">{welcome.title}</h2>
      <p className="sub">{welcome.walking}</p>
      <div className="looks" role="radiogroup" aria-label={welcome.pick}>
        <span className="looks-label">{welcome.pick}</span>
        {visitorLooks.map((l) => (
          <button key={l.id} role="radio" aria-checked={l.id === lookId} className={`look${l.id === lookId ? " on" : ""}`} onClick={() => onLook(l.id)} title={l.name}>
            <i style={{ background: l.swatch }} aria-hidden />
            <span>{l.name}</span>
          </button>
        ))}
      </div>
      <button className="pillbtn" onClick={onSkip}>
        {welcome.skip}
      </button>
    </section>
  );
}

export function ReceptionCard({ onRoom, onBoss, onExplore }: { onRoom: (d: DeptId) => void; onBoss: () => void; onExplore: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  return (
    <section className="card menu" aria-labelledby="reception-title">
      <p className="eyebrow">{reception.eyebrow}</p>
      <h2 id="reception-title">{reception.title}</h2>
      <p className="sub">{reception.sub}</p>
      <div className="grid">
        {menuRooms.map((r, i) => (
          <button key={r} ref={i === 0 ? first : undefined} className="choice" onClick={() => onRoom(r)}>
            <b>{departments[r].name}</b>
            <span>{departments[r].menu}</span>
          </button>
        ))}
      </div>
      <div className="row">
        <button className="pillbtn" onClick={onBoss}>
          {reception.boss}
        </button>
        <button className="pillbtn ghost" onClick={onExplore}>
          {reception.explore}
        </button>
      </div>
    </section>
  );
}

export function VisitCard({ title, sub, eyebrow = "YOUR VISIT", onSkip }: { title: string; sub: string; eyebrow?: string; onSkip: () => void }) {
  return (
    <section className="card" aria-labelledby="visit-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="visit-title">{title}</h2>
      <p className="sub">{sub}</p>
      <button className="pillbtn" onClick={onSkip}>
        Skip walk ↗
      </button>
    </section>
  );
}

export function GoodbyeCard({ onEnter, onClassic }: { onEnter: () => void; onClassic: () => void }) {
  return (
    <section className="card menu" aria-labelledby="bye-title">
      <p className="eyebrow">GOODBYE</p>
      <h2 id="bye-title">Thanks for visiting</h2>
      <p className="sub">You are back on the street. Come in again any time, or read the plain version of the portfolio.</p>
      <div className="row">
        <button className="pillbtn" onClick={onEnter}>
          Enter again ↗
        </button>
        <button className="pillbtn ghost" onClick={onClassic}>
          Classic view
        </button>
      </div>
    </section>
  );
}

/** Side card (bottom sheet on phones) while the visitor sits in a department. */
export function RoomCard({
  dept,
  focus,
  onStand,
  onNext,
  onReception,
  onBossSaved,
}: {
  dept: DeptId;
  focus: number | null;
  onStand: () => void;
  onNext: (d: DeptId) => void;
  onReception: () => void;
  onBossSaved: () => void;
}) {
  const d = departments[dept];
  const next = tour[(tour.indexOf(dept) + 1) % tour.length];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [dept]);
  return (
    <aside className="sheet" aria-labelledby="room-title">
      <p className="eyebrow">{d.eyebrow}</p>
      <h2 id="room-title" ref={heading} tabIndex={-1}>
        {d.title}
      </h2>
      <p className="sub">{d.sub}</p>
      <div className="body">
        <RoomBody id={dept} focus={focus} onBossSaved={onBossSaved} />
      </div>
      <div className="row">
        <button className="pillbtn" onClick={onStand}>
          Stand up and continue
        </button>
        {dept !== "boss" && (
          <button className="pillbtn ghost" onClick={() => onNext(next)}>
            Next: {departments[next].name} ↗
          </button>
        )}
        <button className="pillbtn ghost" onClick={onReception}>
          Reception
        </button>
      </div>
      <p className="hint-keys hide-touch">Esc stands you up.</p>
    </aside>
  );
}
