"use client";

import { profile } from "@/content/profile";
import { roomMeta, RoomBody } from "./Rooms";
import { roomOrder } from "@/office/layout";

export function ClassicView({ onClose }: { onClose?: () => void }) {
  return (
    <div className="classic" role="document">
      <header className="classic-top">
        <b>{profile.name}</b>
        {onClose && (
          <button className="pillbtn" onClick={onClose}>
            Back to the office ↗
          </button>
        )}
      </header>
      <main>
        <section className="classic-hero">
          <p className="eyebrow">PORTFOLIO</p>
          <h1>{profile.name}</h1>
          <p className="sub">{profile.role} · {profile.location}</p>
        </section>
        {["boss", "work", "tech", "ops", "meet"].map((id) => {
          const rid = id as (typeof roomOrder)[number];
          const m = roomMeta[rid];
          return (
            <section key={id} className="classic-sec">
              <p className="eyebrow">{m.eyebrow}</p>
              <h2>{m.title}</h2>
              <p className="sub">{m.sub}</p>
              <RoomBody id={rid} />
            </section>
          );
        })}
      </main>
    </div>
  );
}
