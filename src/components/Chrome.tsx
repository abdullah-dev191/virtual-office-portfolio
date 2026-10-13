"use client";

import { useEffect, useRef, useState } from "react";
import { places, type PlaceId } from "@/content/departments";
import type { Preset } from "@/office/camera";
import type { Quality } from "@/office/quality";

const QUALITY_LABEL: Record<Quality, string> = { low: "Low", medium: "Medium", high: "High" };

export function TopBar({
  place,
  quality,
  onQuality,
  onClassic,
  onExit,
}: {
  place: PlaceId | null;
  quality: Quality;
  onQuality: (q: Quality) => void;
  onClassic: () => void;
  onExit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const no = places.find((p) => p.id === place)?.no ?? "01";
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <header className="topbar">
      <div className="brand" aria-label={`The office, place ${no}`}>
        <span>THE OFFICE</span>
        <b>/{no}</b>
      </div>
      <div className="topbar-right">
        <div className="quality" ref={ref}>
          <button className="chip" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="hide-sm">INTERACTIVE OFFICE · </span>Quality {QUALITY_LABEL[quality]}
          </button>
          {open && (
            <div className="menu" role="group" aria-label="Graphics quality">
              {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
                <button
                  key={q}
                  aria-pressed={q === quality}
                  className={q === quality ? "on" : ""}
                  onClick={() => {
                    onQuality(q);
                    setOpen(false);
                  }}
                >
                  {QUALITY_LABEL[q]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="chip" onClick={onClassic}>
          Classic view
        </button>
        {onExit && (
          <button className="chip dark hide-sm" onClick={onExit}>
            Exit office ↗
          </button>
        )}
      </div>
    </header>
  );
}

const SCENIC: { id: Preset; name: string }[] = [
  { id: "football", name: "Football ground" },
  { id: "park", name: "The park and pond" },
  { id: "neighbourhood", name: "Neighbourhood" },
  { id: "full", name: "Full view" },
];

export function PlaceList({
  current,
  onGo,
  onPreset,
  open,
  onToggle,
}: {
  current: PlaceId | null;
  onGo: (p: PlaceId) => void;
  onPreset: (p: Preset) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [scenic, setScenic] = useState(false);
  return (
    <>
      <button className="places-toggle chip" aria-expanded={open} aria-controls="places" onClick={onToggle}>
        Places
      </button>
      <nav id="places" className={`places${open ? " open" : ""}`} aria-label="Places in the office">
        <ol>
          {places.map((p) => (
            <li key={p.id}>
              <button aria-current={current === p.id ? "location" : undefined} onClick={() => onGo(p.id)}>
                <span className="no">{p.no}</span>
                <span>{p.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <button className="scenic" aria-expanded={scenic} onClick={() => setScenic((v) => !v)}>
          Scenic places ↗
        </button>
        {scenic && (
          <ul className="scenic-list">
            {SCENIC.map((s) => (
              <li key={s.id}>
                <button onClick={() => onPreset(s.id)}>{s.name}</button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </>
  );
}

export function Toolbar({
  preset,
  panMode,
  following,
  demo,
  onZoom,
  onPan,
  onPreset,
  onFollow,
  onDemo,
}: {
  preset: Preset | null;
  panMode: boolean;
  following: boolean;
  demo: boolean;
  onZoom: (k: number) => void;
  onPan: () => void;
  onPreset: (p: Preset) => void;
  onFollow: () => void;
  onDemo: () => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <div className="toolbar" role="toolbar" aria-label="View controls">
      <div className="zoom">
        <button aria-label="Zoom out" onClick={() => onZoom(1.22)}>
          −
        </button>
        <button aria-label="Zoom in" onClick={() => onZoom(1 / 1.22)}>
          +
        </button>
      </div>
      <button className="tool more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
        View
      </button>
      <div className={`tools${more ? " open" : ""}`}>
        <button className="tool" aria-pressed={panMode} onClick={onPan}>
          Move view
        </button>
        <button className="tool" aria-pressed={preset === "football"} onClick={() => onPreset("football")}>
          Football ground
        </button>
        <button className="tool" aria-pressed={preset === "full"} onClick={() => onPreset("full")}>
          Full view
        </button>
        <button className="tool" aria-pressed={preset === "neighbourhood"} onClick={() => onPreset("neighbourhood")}>
          Neighbourhood
        </button>
      </div>
      {!following && (
        <button className="tool" onClick={onFollow}>
          Back to me
        </button>
      )}
      <button className="pillbtn" onClick={onDemo}>
        {demo ? "Stop" : (<><span className="hide-sm">Watch demo</span><span className="show-sm">Demo</span> ↗</>)}
      </button>
    </div>
  );
}
