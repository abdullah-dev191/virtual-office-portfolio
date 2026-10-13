"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { departments, tour, type DeptId, type PlaceId } from "@/content/departments";
import { profile } from "@/content/profile";
import type { Preset } from "@/office/camera";
import { sexOf } from "@/office/characters/rig";
import { visitorLooks } from "@/office/characters/roster";
import type { Phase } from "@/office/director";
import { hostSeat, visitorSeat } from "@/office/layout";
import { QUALITY, autoQuality, type Quality } from "@/office/quality";
import { sim } from "@/office/sim";
import { GoodbyeCard, ReceptionCard, RoomCard, VisitCard, WelcomeCard } from "./Cards";
import { PlaceList, TopBar, Toolbar } from "./Chrome";
import { ClassicView } from "./ClassicView";

const Scene = dynamic(() => import("@/office/world/Scene"), { ssr: false });

type Mode = "boot" | "office" | "classic";
const QUALITY_KEY = "office.quality";
const LOOK_KEY = "office.look";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // storage unavailable: settings last for this visit only
  }
}

export function OfficeApp() {
  const [mode, setMode] = useState<Mode>("boot");
  const [webgl, setWebgl] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [quality, setQuality] = useState<Quality>("high");
  const [lookId, setLookId] = useState(visitorLooks[0].id);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [place, setPlace] = useState<PlaceId | null>(null);
  const [seated, setSeated] = useState<DeptId | null>(null);
  const [status, setStatus] = useState("");
  const [target, setTarget] = useState<string>("");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [following, setFollowing] = useState(true);
  const [demo, setDemo] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const demoRef = useRef(false);

  const look = useMemo(() => visitorLooks.find((l) => l.id === lookId) ?? visitorLooks[0], [lookId]);
  const { director, rig } = sim;
  useEffect(() => {
    // development only: lets browser tests fast-forward the simulation
    if (process.env.NODE_ENV !== "production") (window as unknown as { __office?: typeof sim }).__office = sim;
  }, []);
  useEffect(() => {
    sim.director.setVisitorSex(sexOf(look.look.body));
  }, [look]);

  // first client render: decide between the office and the classic page
  useEffect(() => {
    const gl = hasWebGL();
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = (readStore(QUALITY_KEY) as Quality | null) ?? autoQuality();
    const l = readStore(LOOK_KEY);
    /* eslint-disable react-hooks/set-state-in-effect */
    setWebgl(gl);
    setReduced(rm);
    if (q in QUALITY) {
      sim.setQuality(q);
      setQuality(q);
    }
    if (l && visitorLooks.some((v) => v.id === l)) setLookId(l);
    setWide(window.innerWidth >= 760);
    setMode(gl && !rm ? "office" : "classic");
    /* eslint-enable react-hooks/set-state-in-effect */
    const onResize = () => setWide(window.innerWidth >= 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    sim.rig.cardSide = wide ? "right" : "bottom";
  }, [wide]);

  // director events -> UI state and camera framing
  useEffect(() => {
    const offs = [
      director.on("phase", (p) => {
        setPhase(p);
        if (p !== "seated") setSeated(null);
        if (p === "visit" || p === "leaving") {
          if (rig.mode === "seated") rig.follow();
        }
      }),
      director.on("place", setPlace),
      director.on("status", setStatus),
      director.on("seated", (d) => {
        setSeated(d);
        const s = visitorSeat(d);
        const h = hostSeat(d);
        rig.setSeated(s.position, h ? h.position : null);
        setFollowing(true);
        setPreset(null);
        setPanMode(false);
      }),
      director.on("stood", () => {
        setSeated(null);
        rig.follow();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [director, rig]);

  // start walking in once the people have loaded
  const started = useRef(false);
  useEffect(() => {
    if (mode !== "office" || !ready || started.current) return;
    started.current = true;
    sim.director.reducedMotion = reduced;
    sim.rig.reduced = reduced;
    if (reduced) sim.rig.follow();
    else sim.rig.startIntro();
    sim.director.startIntro();
  }, [mode, ready, reduced]);

  const follow = useCallback(() => {
    rig.follow();
    setFollowing(true);
    setPreset(null);
    setPanMode(false);
  }, [rig]);

  const goTo = useCallback(
    (p: PlaceId) => {
      setPlacesOpen(false);
      setTarget(p === "reception" ? "Back to reception" : departments[p].name);
      follow();
      if (p === "reception") director.toReception();
      else director.goTo(p);
    },
    [director, follow],
  );

  const skip = useCallback(() => {
    rig.skipIntro();
    director.skip();
  }, [director, rig]);

  const stopDemo = useCallback(() => {
    demoRef.current = false;
    setDemo(false);
  }, []);

  const runDemo = useCallback(async () => {
    if (demoRef.current) return stopDemo();
    demoRef.current = true;
    setDemo(true);
    if (director.phase === "intro") skip();
    const waitSeated = (d: DeptId) =>
      new Promise<void>((res) => {
        const off = director.on("seated", (v) => {
          if (v === d) {
            off();
            res();
          }
        });
        window.setTimeout(() => {
          off();
          res();
        }, 120_000);
      });
    const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    for (const d of tour) {
      if (!demoRef.current) return;
      const seatedHere = waitSeated(d);
      goTo(d);
      await seatedHere;
      if (!demoRef.current) return;
      await sleep(5500);
    }
    if (demoRef.current) goTo("reception");
    stopDemo();
  }, [director, goTo, skip, stopDemo]);

  const onPreset = useCallback(
    (p: Preset) => {
      setPlacesOpen(false);
      if (preset === p) return follow();
      rig.setPreset(p);
      setPreset(p);
      setPanMode(false);
      setFollowing(false);
    },
    [follow, preset, rig],
  );

  const onPan = useCallback(() => {
    if (panMode) return follow();
    rig.startPan();
    setPanMode(true);
    setPreset(null);
    setFollowing(false);
  }, [follow, panMode, rig]);

  const onProject = useCallback(
    (i: number) => {
      setFocus(i);
      if (seated !== "work") goTo("work");
    },
    [goTo, seated],
  );

  const onBossSaved = useCallback(() => {
    window.setTimeout(() => goTo("lounge"), 900);
  }, [goTo]);

  // keyboard: Esc stands up when seated (or skips a walk); walking keys bring the camera back
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (mode !== "office" || (e.target as HTMLElement | null)?.closest("textarea, input")) return;
      if (e.key === "Escape") {
        if (director.visitor.seat) director.standUp();
        else if (director.busy) skip();
      } else if (/^(Arrow(Up|Down|Left|Right)|[wasdWASD])$/.test(e.key) && !following) follow();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [director, mode, skip, following, follow]);

  const setQ = (q: Quality) => {
    writeStore(QUALITY_KEY, q);
    sim.setQuality(q);
    setQuality(q);
  };
  const setLook = (id: string) => {
    writeStore(LOOK_KEY, id);
    setLookId(id);
  };

  const sr = (
    <div className="sr-only">
      <h1>
        {profile.name}, {profile.role}
      </h1>
      <p>
        {profile.summary} {profile.summaryHighlight}
        {profile.summaryEnd}
      </p>
    </div>
  );

  if (mode === "classic")
    return (
      <ClassicView
        onEnter={webgl ? () => setMode("office") : undefined}
        note={
          !webgl
            ? "Your browser cannot show the 3D office, so here is the classic view."
            : reduced
              ? "Reduced motion is on, so the office opens as a plain page. You can still enter the 3D office; it will skip the camera moves."
              : undefined
        }
      />
    );

  if (mode === "boot")
    return (
      <div className="office">
        <div className="loader" role="status">
          Opening the office…
        </div>
        {sr}
        <noscript>
          <ClassicView />
        </noscript>
      </div>
    );

  const inside = phase !== "intro" && phase !== "outside" && phase !== "leaving";
  const current = seated ?? place;
  const showPlaces = phase !== "intro";

  return (
    <div className="office" data-seated={phase === "seated" ? "" : undefined}>
      <div className="canvas">
        <Scene
          key={quality}
          director={director}
          rig={rig}
          traffic={sim.traffic}
          game={sim.game}
          quality={quality}
          visitorLook={look.look}
          panMode={panMode}
          onProject={onProject}
          onReady={() => setReady(true)}
        />
      </div>

      <TopBar place={current} quality={quality} onQuality={setQ} onClassic={() => setMode("classic")} onExit={inside ? () => director.exit() : undefined} />

      {showPlaces && <PlaceList current={current} onGo={goTo} onPreset={onPreset} open={placesOpen} onToggle={() => setPlacesOpen((v) => !v)} />}

      {phase === "intro" && ready && <WelcomeCard lookId={lookId} onLook={setLook} onSkip={skip} />}
      {phase === "reception" && following && <ReceptionCard onRoom={goTo} onBoss={() => goTo("boss")} onExplore={() => director.explore()} />}
      {phase === "visit" && following && <VisitCard title={target || "On the move"} sub={status} onSkip={skip} />}
      {phase === "leaving" && <VisitCard eyebrow="LEAVING" title="Heading out…" sub="Thanks for stopping by." onSkip={skip} />}
      {phase === "outside" && <GoodbyeCard onEnter={() => director.reenter()} onClassic={() => setMode("classic")} />}
      {phase === "seated" && seated && <RoomCard dept={seated} focus={focus} onStand={() => director.standUp()} onNext={goTo} onReception={() => goTo("reception")} onBossSaved={onBossSaved} />}
      {phase === "free" && <p className="hint">
          <span className="hide-touch">WASD, arrow keys or tap the floor to walk.</span>
          <span className="show-touch">Tap the floor to walk.</span> Walk up to a table to sit down.
        </p>}

      {ready && phase !== "intro" && (
        <Toolbar preset={preset} panMode={panMode} following={following} demo={demo} onZoom={(k) => rig.zoomBy(k)} onPan={onPan} onPreset={onPreset} onFollow={follow} onDemo={runDemo} />
      )}

      {!ready && (
        <div className="loader" role="status">
          Opening the office…
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      {sr}
    </div>
  );
}
