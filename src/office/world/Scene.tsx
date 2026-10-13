"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { BackSide, Fog, Object3D, type DirectionalLight, type Mesh, type PerspectiveCamera } from "three";
import type { CameraRig } from "../camera";
import type { Look } from "../characters/looks";
import type { Director } from "../director";
import type { Football } from "../football";
import type { Traffic } from "../traffic";
import { Building } from "./Building";
import { City } from "./City";
import { Entrance } from "./Entrance";
import { FootballView } from "./Football";
import { Interior } from "./Interior";
import { People } from "./People";
import { skyGradient } from "./textures";
import { TrafficView } from "./Traffic";
import { QUALITY, type Quality } from "../quality";

export type { Quality } from "../quality";

type Sim = { director: Director; rig: CameraRig; traffic: Traffic; game: Football };

/** Advances every simulation, then places the camera, the sun and the fog for this frame. */
function Driver({ director, rig, traffic, game, shadowSize }: Sim & { shadowSize: number }) {
  const sun = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const sky = useRef<Mesh>(null);
  useFrame((state, dt) => {
    director.update(dt);
    traffic.update(dt, director.visitor);
    game.update(dt);
    const cam = state.camera as PerspectiveCamera;
    const f = rig.update(dt, director.visitor, { width: state.size.width, height: state.size.height, fov: cam.fov });
    cam.position.set(f.x, f.y, f.z);
    cam.lookAt(f.tx, f.ty, f.tz);
    const d = rig.distance;
    const far = Math.max(500, d * 5);
    if (Math.abs(cam.far - far) > 1) {
      cam.far = far;
      cam.updateProjectionMatrix();
    }
    const fog = state.scene.fog;
    if (fog instanceof Fog) {
      fog.near = d * 1.7 + 40;
      fog.far = d * 3.6 + 160;
    }
    if (sky.current) sky.current.position.copy(cam.position);
    if (sun.current) {
      sun.current.position.set(f.tx + 28, 52, f.tz + 22);
      target.position.set(f.tx, 0, f.tz);
      target.updateMatrixWorld();
      const s = Math.min(70, Math.max(18, d * 0.75));
      const sc = sun.current.shadow.camera;
      if (sc.right !== s) {
        sc.left = -s;
        sc.right = s;
        sc.top = s;
        sc.bottom = -s;
        sc.updateProjectionMatrix();
      }
    }
  }, -1);
  return (
    <>
      <fog attach="fog" args={["#E3ECE4", 120, 420]} />
      <mesh ref={sky} renderOrder={-1}>
        <sphereGeometry args={[1400, 24, 12]} />
        <meshBasicMaterial map={skyGradient()} side={BackSide} fog={false} depthWrite={false} />
      </mesh>
      <hemisphereLight args={["#FFFFFF", "#B7C6AE", 1.05]} />
      <ambientLight intensity={0.32} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        color="#FFF1DC"
        intensity={2.3}
        castShadow={shadowSize > 0}
        shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
    </>
  );
}

/** Click or tap the ground to walk; drag to pan in "Move view"; wheel or pinch to zoom. */
function Controls({ director, rig, panMode }: { director: Director; rig: CameraRig; panMode: boolean }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const drag = useRef({ down: false, x: 0, y: 0, moved: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const view = useRef({ panMode, size, fov: camera.fov });
  const fov = camera.fov;
  useEffect(() => {
    view.current = { panMode, size, fov };
  }, [panMode, size, fov]);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag.current = { down: true, x: e.clientX, y: e.clientY, moved: 0 };
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.current) rig.zoomBy(pinch.current / d);
        pinch.current = d;
        drag.current.moved = 99;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      const v = view.current;
      if (drag.current.down && (v.panMode || drag.current.moved > 12)) {
        if (!v.panMode && rig.mode !== "pan") return;
        rig.panBy(dx, dy, { width: v.size.width, height: v.size.height, fov: v.fov });
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = 0;
      drag.current.down = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      rig.zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, rig]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (panMode || drag.current.moved > 8) return;
    director.moveTo(e.point.x, e.point.z);
  };
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} onClick={click}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

type Props = Sim & {
  quality: Quality;
  visitorLook: Look;
  panMode: boolean;
  onProject: (i: number) => void;
  onReady: () => void;
};

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

export default function Scene({ director, rig, traffic, game, quality, visitorLook, panMode, onProject, onReady }: Props) {
  const q = QUALITY[quality];
  useEffect(() => {
    const map: Record<string, keyof Director["keys"]> = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const set = (v: boolean) => (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      director.setKey(k, v);
      if (v) e.preventDefault();
    };
    const dn = set(true);
    const upk = set(false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", upk);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", upk);
    };
  }, [director]);

  return (
    <Canvas
      shadows={q.shadows > 0}
      dpr={[1, q.dpr]}
      camera={{ fov: 36, near: 0.4, far: 800, position: [0, 150, 160] }}
      gl={{ antialias: q.aa, powerPreference: "high-performance" }}
      aria-label="Interactive 3D office. Use the place list or click the floor to walk."
    >
      <color attach="background" args={["#E3ECE4"]} />
      <Driver director={director} rig={rig} traffic={traffic} game={game} shadowSize={q.shadows} />
      <City />
      <Entrance director={director} />
      <Building director={director} />
      <Interior director={director} onProject={onProject} />
      <Suspense fallback={null}>
        <People director={director} visitorLook={visitorLook} staffLimit={q.staff} />
        <TrafficView traffic={traffic} />
        <FootballView game={game} />
        <Ready onReady={onReady} />
      </Suspense>
      <Controls director={director} rig={rig} panMode={panMode} />
    </Canvas>
  );
}
