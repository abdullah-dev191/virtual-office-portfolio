"use client";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnimationMixer,
  CanvasTexture,
  CylinderGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Bone,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { SkeletonUtils } from "three-stdlib";
import { clamp, wrapAngle } from "../geom";
import { lookGeometry, personMaterial } from "./lookGeometry";
import type { Look } from "./looks";
import { BODIES, RIGS } from "./rig.generated";
import { DEFAULT_FADE, FADE, ONCE, bodyKeys, sexOf, type BodyKey, type ClipName, type Puppet } from "./rig";

type Gltf = { scene: Group; animations: AnimationClip[] };

/** Every people asset in one list so they load together (one Suspense boundary). */
export const PEOPLE_URLS = [...bodyKeys.map((k) => BODIES[k].url), RIGS.m.url, RIGS.f.url];
const bodyIndex = (k: BodyKey) => bodyKeys.indexOf(k);
const animIndex = { m: bodyKeys.length, f: bodyKeys.length + 1 };

export function preloadPeople() {
  useGLTF.preload(PEOPLE_URLS);
}

const UP = new Vector3(0, 1, 0);
const v1 = new Vector3();
const v2 = new Vector3();
const q1 = new Quaternion();
const q2 = new Quaternion();

/** Soft round contact shadow shared by everyone. */
let blobTexture: CanvasTexture | null = null;
function blob() {
  if (blobTexture) return blobTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, "rgba(20,28,24,0.55)");
  grd.addColorStop(0.6, "rgba(20,28,24,0.22)");
  grd.addColorStop(1, "rgba(20,28,24,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  blobTexture = new CanvasTexture(c);
  return blobTexture;
}
const blobGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Security cap: built in body space, then parented to the head bone so it follows every clip. */
function attachCap(root: Object3D, head: Bone) {
  const navy = new MeshStandardMaterial({ color: "#1B2433", roughness: 0.7 });
  const black = new MeshStandardMaterial({ color: "#0F1216", roughness: 0.5 });
  const gold = new MeshStandardMaterial({ color: "#C9A46A", roughness: 0.35, metalness: 0.5 });
  // Built around the head's world position in the clone's pose (the character faces +z), then re-expressed in
  // the head bone's own space so it follows every clip.
  root.updateWorldMatrix(true, true);
  const hp = head.getWorldPosition(new Vector3());
  const cap = new Group();
  const crown = new Mesh(new SphereGeometry(0.162, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), navy);
  crown.scale.set(1, 0.82, 1.1);
  crown.position.set(hp.x, hp.y + 0.15, hp.z + 0.005);
  const band = new Mesh(new CylinderGeometry(0.163, 0.163, 0.05, 24), black);
  band.position.set(hp.x, hp.y + 0.15, hp.z + 0.005);
  const brim = new Mesh(new CylinderGeometry(0.14, 0.14, 0.014, 24, 1, false, 0, Math.PI), black);
  brim.scale.set(1, 1, 1.05);
  brim.position.set(hp.x, hp.y + 0.13, hp.z + 0.1);
  const badge = new Mesh(new CylinderGeometry(0.022, 0.022, 0.008, 14).rotateX(Math.PI / 2), gold);
  badge.position.set(hp.x, hp.y + 0.19, hp.z + 0.178);
  cap.add(crown, band, brim, badge);
  cap.traverse((o) => ((o as Mesh).castShadow = true));
  cap.applyMatrix4(new Matrix4().copy(head.matrixWorld).invert());
  head.add(cap);
}

type Props = {
  puppet: Puppet;
  look: Look;
  label?: string;
  tone?: "you" | "role";
  /** Hide the label when the camera is this far away (metres). */
  labelRange?: number;
  shadow?: boolean;
};

export function CharacterModel({ puppet, look, label, tone = "role", labelRange = 70, shadow = true }: Props) {
  const gltfs = useGLTF(PEOPLE_URLS) as unknown as Gltf[];
  const body = gltfs[bodyIndex(look.body)];
  const sex = sexOf(look.body);
  const anim = gltfs[animIndex[sex]];
  const group = useRef<Group>(null);
  const tag = useRef<Group>(null);
  const [text, setText] = useState<string | null>(label ?? null);
  const [bubble, setBubble] = useState(false);
  const [near, setNear] = useState(true);

  const rig = useMemo(() => {
    const root = SkeletonUtils.clone(body.scene) as Group;
    let src: SkinnedMesh | null = null;
    body.scene.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && !src) src = o as SkinnedMesh;
    });
    let mesh: SkinnedMesh | null = null;
    root.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as SkinnedMesh;
    });
    if (!mesh || !src) throw new Error(`no skinned mesh in ${look.body}`);
    const m = mesh as SkinnedMesh;
    m.geometry = lookGeometry((src as SkinnedMesh).geometry, look);
    m.material = personMaterial;
    m.castShadow = true;
    m.receiveShadow = false;
    // poses move the body well outside the bind-pose bounds; cheap enough to always draw
    m.frustumCulled = false;
    const head = root.getObjectByName("Head") as Bone;
    const neck = root.getObjectByName("Neck") as Bone;
    if (look.cap) attachCap(root, head);
    const mixer = new AnimationMixer(root);
    const actions = new Map<string, AnimationAction>();
    for (const c of anim.animations) actions.set(c.name, mixer.clipAction(c));
    return { root, mixer, actions, head, neck };
  }, [body, anim, look]);

  const cur = useRef<{ name: ClipName; key: number; action: AnimationAction } | null>(null);
  const gaze = useRef({ yaw: 0, pitch: 0, tyaw: 0, tpitch: 0, w: 0 });
  /** The animated (turn-free) rotations of the neck and head. */
  const base = useMemo(() => ({ neck: new Quaternion(), head: new Quaternion() }), []);

  const play = (name: ClipName, key: number, rate: number, fade: number) => {
    const next = rig.actions.get(name);
    if (!next) return;
    const once = ONCE.has(name);
    const prev = cur.current?.action;
    next.reset();
    next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.timeScale = rate;
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
    cur.current = { name, key, action: next };
  };

  // Pose the first frame before anything is drawn, so nobody flashes a T-pose.
  useLayoutEffect(() => {
    cur.current = null;
    play(puppet.anim, puppet.animKey, puppet.rate, 0);
    rig.mixer.update(0);
    base.neck.copy(rig.neck.quaternion);
    base.head.copy(rig.head.quaternion);
    return () => {
      rig.mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const p = puppet;
    g.visible = p.visible;
    if (!p.visible) return;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.yaw;

    const c = cur.current;
    if (!c || c.name !== p.anim || c.key !== p.animKey) play(p.anim, p.animKey, p.rate, FADE[p.anim] ?? DEFAULT_FADE);
    else if (c.action.timeScale !== p.rate) c.action.timeScale = p.rate;
    // Undo last frame's head turn first: the mixer only rewrites bones whose clip value changed, so a turn
    // added on top of the pose would otherwise pile up every frame and spin the neck.
    rig.neck.quaternion.copy(base.neck);
    rig.head.quaternion.copy(base.head);
    rig.mixer.update(Math.min(dt, 0.1));
    base.neck.copy(rig.neck.quaternion);
    base.head.copy(rig.head.quaternion);

    // head turn towards a point of interest
    const gz = gaze.current;
    const want = p.look ? 1 : 0;
    gz.w += (want - gz.w) * Math.min(1, dt * 3.5);
    if (p.look) {
      rig.head.getWorldPosition(v1);
      const dx = p.look[0] - v1.x;
      const dy = p.look[1] - v1.y;
      const dz = p.look[2] - v1.z;
      gz.tyaw = clamp(wrapAngle(Math.atan2(dx, dz) - p.yaw), -1.2, 1.2);
      gz.tpitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.35);
    }
    gz.yaw += (gz.tyaw - gz.yaw) * Math.min(1, dt * 5);
    gz.pitch += (gz.tpitch - gz.pitch) * Math.min(1, dt * 5);
    if (gz.w > 0.01) {
      turnBone(rig.neck, UP, gz.yaw * gz.w * 0.4);
      turnBone(rig.head, UP, gz.yaw * gz.w * 0.6);
      v2.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      turnBone(rig.head, v2, -gz.pitch * gz.w);
    }

    // label: lower when seated, bubble text when talking, hidden from far away
    if (tag.current) tag.current.position.y = p.anim.startsWith("Sit") || p.anim === "StandUp" ? 1.55 : 2.08;
    const nextText = p.bubble ?? label ?? null;
    if (nextText !== text) setText(nextText);
    if (!!p.bubble !== bubble) setBubble(!!p.bubble);
    const far = state.camera.position.distanceTo(g.position) > labelRange;
    if (far === near) setNear(!far);
  });

  return (
    <group ref={group}>
      <primitive object={rig.root} />
      {shadow && (
        <mesh geometry={blobGeometry} position={[0, 0.015, 0]} scale={[0.95, 1, 0.95]} renderOrder={1}>
          <meshBasicMaterial map={blob()} transparent depthWrite={false} />
        </mesh>
      )}
      <group ref={tag}>
        {text && (near || tone === "you" || bubble) && (
          <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
            <div className={`pill ${bubble ? "bubble" : tone}`}>{text}</div>
          </Html>
        )}
      </group>
    </group>
  );
}

/** Rotates a bone about a world-space axis, on top of the animated pose. */
function turnBone(bone: Object3D, axis: Vector3, angle: number) {
  if (!bone.parent || Math.abs(angle) < 1e-4) return;
  bone.parent.getWorldQuaternion(q1);
  v1.copy(axis).applyQuaternion(q1.invert());
  bone.quaternion.premultiply(q2.setFromAxisAngle(v1, angle));
}
