"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Director, type Step } from "@/office/director";
import { DESK_BACK, GATE_IN, GATE_OUT, LOBBY, START, doors, roomAt, rooms, roomOrder, type RoomId, type V2 } from "@/office/layout";
import { findPath, stepAside, trimEnd } from "@/office/nav";
import { ClassicView } from "./ClassicView";
import { RoomBody, roomMeta } from "./Rooms";
import { profile } from "@/content/profile";

const Scene = dynamic(() => import("@/office/world/Scene"), { ssr: false });

type Card = { eyebrow: string; title: string; sub?: string; skip?: string } | null;
type Phase = "intro" | "menu" | "walk" | "free" | "exit";

export function OfficeApp() {
  const director = useMemo(() => new Director(), []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [card, setCard] = useState<Card>({ eyebrow: "WELCOME", title: "Welcome to the office", sub: "Security is opening the gate…" });
  const [sheet, setSheet] = useState<RoomId | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pBubble, setPBubble] = useState<string | null>(null);
  const [gBubble, setGBubble] = useState<string | null>(null);
  const [classic, setClassic] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);

  const showMenu = useCallback(() => {
    setPhase("menu");
    setCard(null);
    setSheet(null);
  }, []);

  const openRoom = useCallback((id: RoomId) => {
    setSheet((s) => (s === id ? s : id));
    setCard(null);
    setPhase("free");
  }, []);

  const intro = useCallback(() => {
    setPhase("intro");
    setSheet(null);
    setCard({ eyebrow: "WELCOME", title: "Welcome to the office", sub: "Security is opening the gate…" });
    director.run([
      { t: "wait", ms: 1600 },
      { t: "fn", fn: () => director.setGate(true) },
      { t: "wait", ms: 900 },
      { t: "fn", fn: () => setCard({ eyebrow: "WELCOME", title: "Walking to reception…", skip: "Skip to reception ↗" }) },
      { t: "walk", path: [START, GATE_OUT, GATE_IN, LOBBY] },
      { t: "fn", fn: showMenu },
    ]);
  }, [director, showMenu]);

  useEffect(() => {
    const c = document.createElement("canvas");
    const ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebgl(ok);
    if (!ok) {
      setClassic(true);
      return;
    }
    director.setZoneHandler((z) => {
      if (z) openRoom(z);
      else setSheet(null);
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      director.setGate(true);
      director.placePlayer(LOBBY);
      showMenu();
    } else intro();
    return () => {
      director.setZoneHandler(undefined);
    };
  }, [director, intro, openRoom, showMenu]);

  /** Walk to the inside of a door, push it open into the corridor, step through and let it swing shut. */
  const leaveSteps = (id: RoomId): Step[] => {
    const d = doors[id];
    const here: V2 = [director.player.x, director.player.z];
    return [
      { t: "walk", path: findPath(here, d.inn) },
      { t: "turn", yaw: d.faceIn },
      { t: "fn", fn: () => director.openDoor(id, -1) },
      { t: "wait", ms: 1000 },
      { t: "walk", path: [d.inn, d.c, d.out, d.clear] },
      { t: "fn", fn: () => director.closeDoor(id) },
    ];
  };

  const visit = (id: RoomId) => {
    setSheet(null);
    setFocus(null);
    const here: V2 = [director.player.x, director.player.z];
    const cur = roomAt(here[0], here[1]);
    if (cur === id) {
      openRoom(id);
      return;
    }
    setPhase("walk");
    const room = rooms[id];
    const d = doors[id];
    const eyebrow = "YOUR VISIT";
    const title = id === "boss" ? "Boss Cabin" : room.name;
    const steps: Step[] = [];
    if (cur) steps.push(...leaveSteps(cur));
    const start: V2 = cur ? doors[cur].clear : here;

    // The receptionist only walks you over when you start from the lobby.
    const withGuide = start[1] > 3;
    let guideWalk: V2[] | undefined;
    if (withGuide) {
      const lead = trimEnd(findPath(DESK_BACK, d.out), 2.8);
      guideWalk = [...lead, stepAside(lead)];
      director.summonGuide();
    }
    setCard({ eyebrow, title, sub: withGuide ? `Follow your receptionist to ${title}.` : `Heading to ${title}.`, skip: "Skip walk ↗" });
    steps.push({ t: "walk", path: findPath(start, d.out), guide: guideWalk, lead: guideWalk ? 1.1 : 0 });
    steps.push({ t: "turn", yaw: d.face });
    if (id === "boss") {
      steps.push(
        { t: "fn", fn: () => { setCard({ eyebrow, title, sub: "Knocking on the boss cabin.", skip: "Skip walk ↗" }); setPBubble("KNOCK KNOCK"); director.player.reach = 1.6; } },
        { t: "wait", ms: 1700 },
        { t: "fn", fn: () => { setPBubble(null); setGBubble("Please come in"); } },
        { t: "wait", ms: 1100 },
        { t: "fn", fn: () => setGBubble(null) },
      );
    }
    steps.push(
      { t: "fn", fn: () => { setCard({ eyebrow, title, sub: "Opening the door.", skip: "Skip walk ↗" }); director.openDoor(id, 1); } },
      { t: "wait", ms: 1000 },
      { t: "walk", path: [d.out, d.c, d.inn, ...findPath(d.inn, room.dest).slice(1)] },
      { t: "fn", fn: () => { director.closeDoor(id); director.sendGuideHome(); openRoom(id); } },
    );
    director.run(steps);
  };

  const back = () => {
    setSheet(null);
    setPhase("walk");
    setCard({ eyebrow: "YOUR VISIT", title: "Back to reception", skip: "Skip walk ↗" });
    const here: V2 = [director.player.x, director.player.z];
    const cur = roomAt(here[0], here[1]);
    const steps: Step[] = cur ? leaveSteps(cur) : [];
    const start: V2 = cur ? doors[cur].clear : here;
    steps.push({ t: "walk", path: findPath(start, LOBBY) }, { t: "fn", fn: showMenu });
    director.run(steps);
  };

  /** Leave through the front gate, which closes behind you, then offer to come back in. */
  const exitOffice = () => {
    setSheet(null);
    setFocus(null);
    setPhase("walk");
    setCard({ eyebrow: "LEAVING", title: "Heading out…", sub: "Thanks for stopping by.", skip: "Skip walk ↗" });
    const here: V2 = [director.player.x, director.player.z];
    const cur = roomAt(here[0], here[1]);
    director.sendGuideHome();
    const steps: Step[] = cur ? leaveSteps(cur) : [];
    const start: V2 = cur ? doors[cur].clear : here;
    steps.push(
      { t: "fn", fn: () => director.setGate(true) },
      { t: "walk", path: [...findPath(start, GATE_IN), GATE_OUT, [0, 16]] },
      { t: "fn", fn: () => director.setGate(false) },
      { t: "wait", ms: 900 },
      { t: "fn", fn: () => { setPhase("exit"); setCard(null); } },
    );
    director.run(steps);
  };

  const reenter = () => {
    director.reset();
    intro();
  };

  const skip = () => director.skip();

  if (classic) return <ClassicView onClose={webgl ? () => setClassic(false) : undefined} />;

  return (
    <div className="office">
      <div className="canvas">
        <Scene director={director} onProject={(i) => { setFocus(i); openRoom("work"); }} playerBubble={pBubble} guideBubble={gBubble} />
      </div>

      <div className="hud">
        <span className="hud-label">INTERACTIVE OFFICE</span>
        <div className="hud-right">
          <button className="pillbtn ghost" onClick={() => setClassic(true)}>Classic view</button>
          {phase !== "intro" && phase !== "exit" && phase !== "walk" && (
            <button className="pillbtn" onClick={exitOffice}>Exit office ↗</button>
          )}
        </div>
      </div>

      {card && (
        <div className="card" role="status" aria-live="polite">
          <p className="eyebrow">{card.eyebrow}</p>
          <h2>{card.title}</h2>
          {card.sub && <p className="sub">{card.sub}</p>}
          {card.skip && (
            <button className="pillbtn" onClick={skip}>{card.skip}</button>
          )}
        </div>
      )}

      {phase === "menu" && !sheet && (
        <div className="card menu">
          <p className="eyebrow">RECEPTION</p>
          <h2>Where to, {profile.name.split(" ")[0]}&apos;s visitor?</h2>
          <p className="sub">Pick a room and your receptionist will walk you there.</p>
          <div className="grid">
            {roomOrder.filter((r) => r !== "boss").map((r) => (
              <button key={r} className="choice" onClick={() => visit(r)}>
                <b>{rooms[r].name}</b>
                <span>{roomMeta[r].title}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button className="pillbtn" onClick={() => visit("boss")}>Meet the boss · knock first ↗</button>
            <button className="pillbtn ghost" onClick={() => { setPhase("free"); setCard(null); }}>Just exploring ↗</button>
          </div>
        </div>
      )}

      {phase === "exit" && (
        <div className="card menu">
          <p className="eyebrow">GOODBYE</p>
          <h2>Thanks for visiting</h2>
          <p className="sub">You are outside the office. Come back in any time, or read the plain version of the portfolio.</p>
          <div className="row">
            <button className="pillbtn" onClick={reenter}>Enter again ↗</button>
            <button className="pillbtn ghost" onClick={() => setClassic(true)}>Classic view</button>
          </div>
        </div>
      )}

      {phase === "free" && !sheet && (
        <div className="chips">
          <button className="pillbtn" onClick={back}>Reception ↗</button>
          {roomOrder.map((r) => (
            <button key={r} className="pillbtn ghost" onClick={() => visit(r)}>{r === "boss" ? "Boss" : rooms[r].name}</button>
          ))}
          <span className="hint">WASD, arrow keys or tap the floor to walk</span>
        </div>
      )}

      {sheet && (
        <aside className="sheet" aria-label={roomMeta[sheet].title}>
          <p className="eyebrow">{roomMeta[sheet].eyebrow}</p>
          <h2>{roomMeta[sheet].title}</h2>
          <p className="sub">{roomMeta[sheet].sub}</p>
          <div className="body"><RoomBody id={sheet} focus={focus} /></div>
          <div className="row">
            <button className="pillbtn" onClick={back}>Back to reception ↗</button>
            <button className="pillbtn ghost" onClick={() => setSheet(null)}>Keep exploring</button>
            <button className="pillbtn ghost" onClick={exitOffice}>Exit office</button>
          </div>
        </aside>
      )}

      <div className="sr-only">
        <h1>{profile.name}, {profile.role}</h1>
        <p>{profile.summary} {profile.summaryHighlight}{profile.summaryEnd}</p>
      </div>
    </div>
  );
}
