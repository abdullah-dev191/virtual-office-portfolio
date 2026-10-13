#!/usr/bin/env node
// Builds the rigged people used in the office. All sources are CC0 by Quaternius (see README "Credits").
//
//   node scripts/build-people.mjs           build from the cached sources in assets-src/
//   node scripts/build-people.mjs --fetch   download any missing sources first
//
// Outputs
//   public/models/people/<body>.glb         one skinned mesh per body; each vertex carries a palette slot (_MATID)
//   public/models/people/anim-<m|f>.glb     clips shared by every body with that skeleton
//   src/office/characters/rig.generated.ts  palettes, clip lengths and the measurements the director relies on
//
// Clips come from three places:
//   native      Idle, Walk, Run, Interact, Wave, Kick from the character files themselves
//   retargeted  sit down / sit idle / sit talk / stand up / talk from the Universal Animation Library,
//               mapped with rest-relative world rotations; hips scaled by leg length, IK feet re-attached
//   procedural  typing and knocking, posed from the bones with 2-bone IK

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, joinPrimitives, meshopt, prune, resample, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets-src", "people");
const OUT = join(ROOT, "public", "models", "people");
const GEN = join(ROOT, "src", "office", "characters", "rig.generated.ts");
const FPS = 30;
/** Height of every desk and table top in the office; typing hands rest just above it. */
const TABLE_TOP = 0.72;

/**
 * Bodies from Quaternius "Ultimate Modular Men / Women" (CC0), mirrored on poly.pizza.
 * `roles` names each palette slot ("Part:Material" or just "Material") so looks can recolour it.
 */
const BODIES = [
  {
    key: "suit", sex: "m", page: "https://poly.pizza/m/JFrLIKqvCH", rid: "e599abbe-7d73-488c-9d7e-3ead281e705c",
    sha: "82b81257c1e94cd9ee48cb1dcbe5ff506e81c9ce67cd0c5af542d8712dca546e",
    roles: { "Legs:Suit": "bottom", "Body:Suit": "top", "Body:White": "shirt", "Body:Tie": "tie", "Feet:Black": "shoes", Hair: "hair", Eyebrows: "brows", Eye: "eyes", Skin: "skin" },
  },
  {
    key: "casual", sex: "m", page: "https://poly.pizza/m/kZ3DmIoGip", rid: "90a9e2d4-053f-42f1-99a2-8f5e1180ea7f",
    sha: "fea7e71271203e7073f1a073fa1208de7402df276f87f80e149bf7589b5d46b4",
    roles: { "Legs:LightBlue": "bottom", "Feet:White": "sole", "Feet:Red_Dark": "shoes", "Body:LightBrown": "top", Skin_Darker: "skinShade", Hair: "hair", Eyebrows: "brows", Eye: "eyes", Skin: "skin" },
  },
  {
    key: "hoodie", sex: "m", page: "https://poly.pizza/m/gKLBoRsyKe", rid: "bcd66ec5-5e81-4901-a222-47abc875fe2a",
    sha: "0de1bcd789d409214cf82f66f61daeb53d2f7de6d914b23e7b3660bfb3dee61e",
    roles: { "Feet:White": "sole", "Feet:Purple": "shoes", "Body:Purple": "top", "Legs:LightBlue": "bottom", Hair: "hair", Eyebrows: "brows", Eye: "eyes", Skin: "skin" },
  },
  {
    key: "worker", sex: "m", page: "https://poly.pizza/m/Yg2bQZO6Hj", rid: "3a5f3056-ffe6-42eb-bd52-122afcbd22b2",
    sha: "9c28614f465b7dc105f908c20c22fc045f4b07caf8c5ef0e9f8049eceb6dd38d",
    roles: {
      "Feet:Black": "shoes", "Feet:Grey": "sole", "Legs:Brown2": "bottom", "Legs:Brown": "belt", "Body:Worker_Yellow": "stripes", "Body:Worker_Vest": "vest",
      "Body:LightBrown": "top", "Head:Worker_Yellow": "hat", Moustache: "hair", Eyebrows: "brows", Eye: "eyes", Skin: "skin",
    },
  },
  {
    key: "dress", sex: "f", page: "https://poly.pizza/m/nIItLV9nxS", rid: "46d6db5a-3c9f-4238-8cdf-8eb7194498dc",
    sha: "a6522fe53d15de21130a957d1bf2b8a9a58d4e4e9a12af646645b667a9bb2d17",
    roles: { "Head:Red": "hair", "Head:Brown": "brows", "Body:LimeGreen": "top", "Legs:LimeGreen": "top", "Body:Gold": "belt", "Feet:Red": "shoes", Skin: "skin" },
  },
  {
    key: "tee", sex: "f", page: "https://poly.pizza/m/qJ2gsTUBHL", rid: "ba7a1955-ea51-4cb9-a561-188bdef0a6c7",
    sha: "a2212729826b718e59e698211ed3951c22459b48733b1ee6a24fac0abf74dca8",
    roles: { "Body:White": "top", "Feet:Grey": "shoes", Hair_Blond: "hair", Hair_Brown: "hair2", "Head:Brown": "brows", "Legs:Orange": "bottom", Skin: "skin" },
  },
  {
    key: "explorer", sex: "f", page: "https://poly.pizza/m/ZwF0K7WBmu", rid: "69689495-028d-4b81-8678-792338a5693e",
    sha: "38e4e6429d8af5849bb23e9585266f8c17dfe3e987bda89dec58f606aaedcf31",
    roles: {
      "Body:LightGreen": "top", "Legs:LightGreen": "bottom", "Body:Green": "vest", "Body:White": "shirt", "Legs:White": "socks", Brown2: "belt", Gold: "accent",
      "Legs:Brown_02": "shoes", "Feet:Brown2": "shoes", "Feet:Brown_02": "sole", Hair_Brown: "hair", "Head:Brown": "brows", Skin: "skin",
    },
  },
];

/** Bodies whose skeleton and native clips define each shared clip file. */
const REFERENCE = { m: "casual", f: "tee" };

/** Quaternius "Universal Animation Library" Standard (CC0), mirrored on OpenGameArt. */
const UAL = {
  zip: "https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip",
  entry: "Godot/AnimationLibrary_Godot_Standard.glb",
  sha: "1b7bf67866360665426bb99e4c71bd619f19b408453c24e30f0c3071601eee5c",
};

const NATIVE_CLIPS = {
  "CharacterArmature|Idle": "Idle",
  "CharacterArmature|Idle_Neutral": "IdleNeutral",
  "CharacterArmature|Walk": "Walk",
  "CharacterArmature|Run": "Run",
  "CharacterArmature|Interact": "Reach",
  "CharacterArmature|Wave": "Wave",
  "CharacterArmature|Kick_Right": "Kick",
};
const UAL_CLIPS = {
  Sitting_Enter: "SitDown",
  Sitting_Idle_Loop: "SitIdle",
  Sitting_Talking_Loop: "SitTalk",
  Sitting_Exit: "StandUp",
  Idle_Talking_Loop: "Talk",
};
const SITTING = new Set(["SitDown", "SitIdle", "SitTalk", "StandUp"]);

/** Target bone (three.js-sanitised name) -> Universal Animation Library bone. */
const BONE_MAP = {
  Body: "DEF-hips",
  Abdomen: "DEF-spine001",
  Torso: "DEF-spine002",
  Chest: "DEF-spine003",
  Neck: "DEF-neck",
  Head: "DEF-head",
  ...Object.fromEntries(
    ["L", "R"].flatMap((s) => [
      [`Shoulder${s}`, `DEF-shoulder${s}`],
      [`UpperArm${s}`, `DEF-upper_arm${s}`],
      [`LowerArm${s}`, `DEF-forearm${s}`],
      [`Wrist${s}`, `DEF-hand${s}`],
      [`UpperLeg${s}`, `DEF-thigh${s}`],
      [`LowerLeg${s}`, `DEF-shin${s}`],
      [`Foot${s}`, `DEF-foot${s}`],
    ]),
  ),
};
const TRACKED = Object.keys(BONE_MAP);
const POSITIONED = ["Body", "FootL", "FootR"];

// ---------------------------------------------------------------- fetching

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Reads one entry from a zip archive (stored or deflated). */
function unzipEntry(zip, suffix) {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (name.endsWith(suffix)) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip entry not found: ${suffix}`);
}

function checkHash(file, expected) {
  const got = sha256(readFileSync(file));
  if (got !== expected) console.warn(`! ${file} has sha256 ${got}, expected ${expected}. The upstream file changed; check the result.`);
}

async function fetchSources() {
  mkdirSync(SRC, { recursive: true });
  for (const b of BODIES) {
    const file = join(SRC, `${b.key}.glb`);
    if (existsSync(file)) continue;
    console.log(`fetch ${b.page}`);
    writeFileSync(file, await download(`https://static.poly.pizza/${b.rid}.glb`));
  }
  const ual = join(SRC, "ual-standard.glb");
  if (!existsSync(ual)) {
    console.log(`fetch ${UAL.zip}`);
    writeFileSync(ual, unzipEntry(await download(UAL.zip), UAL.entry));
  }
}

// ---------------------------------------------------------------- three.js rigs (Node)

async function loadGltf(file) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

const depth = (o) => {
  let d = 0;
  for (let p = o.parent; p; p = p.parent) d++;
  return d;
};

/** Collects bones, their loaded (rest) transforms and their bind-pose world transforms. */
function makeRig(gltf) {
  const skinned = [];
  gltf.scene.traverse((o) => o.isSkinnedMesh && skinned.push(o));
  const sk = skinned[0].skeleton;
  const bones = new Map(sk.bones.map((b) => [b.name, b]));
  const rest = new Map(sk.bones.map((b) => [b.name, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
  const bindQ = new Map();
  const bindP = new Map();
  const bindM = new Map();
  sk.bones.forEach((b, i) => {
    // These files bind with an identity bind matrix, so bone world = mesh world * inverse(IBM).
    const m = skinned[0].matrixWorld.clone().multiply(sk.boneInverses[i].clone().invert());
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    m.decompose(p, q, new THREE.Vector3());
    bindM.set(b.name, m);
    bindQ.set(b.name, q);
    bindP.set(b.name, p);
  });
  const order = [...sk.bones].sort((a, b) => depth(a) - depth(b));
  return { gltf, scene: gltf.scene, skinned, bones, rest, bindQ, bindP, bindM, order };
}

function resetRig(rig) {
  for (const [n, b] of rig.bones) {
    const r = rig.rest.get(n);
    b.position.copy(r.p);
    b.quaternion.copy(r.q);
    b.scale.copy(r.s);
  }
  rig.scene.updateMatrixWorld(true);
}

/**
 * Returns a function that poses `rig` at time t of `clip`.
 * Tracks are evaluated directly: an AnimationMixer skips writing values that did not change since its
 * last update, which breaks when bones are reset between samples.
 */
function clipPoser(rig, clip) {
  const bindings = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    const node = rig.bones.get(track.name.slice(0, dot)) ?? rig.scene.getObjectByName(track.name.slice(0, dot));
    const prop = track.name.slice(dot + 1);
    if (node && ["quaternion", "position", "scale"].includes(prop)) bindings.push({ node, prop, interp: track.createInterpolant() });
  }
  return (t) => {
    resetRig(rig);
    const time = Math.min(Math.max(t, 0), clip.duration);
    for (const b of bindings) b.node[b.prop].fromArray(b.interp.evaluate(time));
    rig.scene.updateMatrixWorld(true);
  };
}

const worldQ = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const worldP = (o) => o.getWorldPosition(new THREE.Vector3());

/** Sets a bone's local rotation so that its world rotation becomes `q`. */
function setWorldQ(bone, q) {
  bone.parent.updateWorldMatrix(true, false);
  bone.quaternion.copy(worldQ(bone.parent).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

function setWorldP(bone, p) {
  bone.parent.updateWorldMatrix(true, false);
  bone.position.copy(bone.parent.worldToLocal(p.clone()));
  bone.updateMatrixWorld(true);
}

/** The node at the far end of the target shin (an "_end" helper, not a joint). */
function shinEnd(rig, side) {
  const shin = rig.bones.get(`LowerLeg${side}`);
  const end = shin.children.find((c) => c.name.startsWith(`LowerLeg${side}_end`));
  if (!end) throw new Error(`missing LowerLeg${side}_end`);
  return end;
}

/** Bind-pose world position of a non-joint child, from its parent's bind matrix. */
function bindChildPos(rig, parentName, child) {
  return child.position.clone().applyMatrix4(rig.bindM.get(parentName));
}

/** Prepares everything retargeting onto one target skeleton needs. */
function makeTarget(rig, src) {
  const ends = {};
  const footOffset = {};
  for (const s of ["L", "R"]) {
    ends[s] = shinEnd(rig, s);
    const ankleBind = bindChildPos(rig, `LowerLeg${s}`, ends[s]);
    // Where the foot pivot sits relative to the shin end, in the foot's own bind frame.
    footOffset[s] = rig.bindP.get(`Foot${s}`).clone().sub(ankleBind).applyQuaternion(rig.bindQ.get(`Foot${s}`).clone().invert());
  }
  // Hip-joint height ratio scales hip travel (the target shin runs down to the sole, so lengths don't compare).
  const k = rig.bindP.get("UpperLegL").y / src.bindP.get("DEF-thighL").y;
  return { rig, ends, footOffset, k, footY: rig.bindP.get("FootL").y };
}

/** Re-attaches the IK foot bones to the shins, keeping the given world rotations. */
function placeFeet(T, footQ) {
  const { rig } = T;
  for (const s of ["L", "R"]) {
    const foot = rig.bones.get(`Foot${s}`);
    const q = footQ[s] ?? worldQ(foot);
    const ankle = worldP(T.ends[s]);
    setWorldP(foot, ankle.add(T.footOffset[s].clone().applyQuaternion(q)));
    setWorldQ(foot, q);
  }
}

/** Shifts the hips (and so everything) vertically until the lower foot rests at its bind height. */
function groundFeet(T, footQ) {
  const { rig } = T;
  const low = Math.min(worldP(rig.bones.get("FootL")).y, worldP(rig.bones.get("FootR")).y);
  const body = rig.bones.get("Body");
  setWorldP(body, worldP(body).add(new THREE.Vector3(0, T.footY - low, 0)));
  placeFeet(T, footQ);
}

/** Poses the target from the source's current pose (source must already be posed). */
function retargetPose(T, src, shift) {
  const { rig } = T;
  resetRig(rig);
  const footQ = {};
  for (const tb of rig.order) {
    const sName = BONE_MAP[tb.name];
    if (!sName) continue;
    const sb = src.bones.get(sName);
    const q = worldQ(sb).multiply(src.bindQ.get(sName).clone().invert()).multiply(rig.bindQ.get(tb.name));
    if (tb.name.startsWith("Foot")) {
      footQ[tb.name.slice(-1)] = q;
      continue;
    }
    setWorldQ(tb, q);
  }
  const hips = worldP(src.bones.get("DEF-hips")).sub(src.bindP.get("DEF-hips")).multiplyScalar(T.k);
  setWorldP(rig.bones.get("Body"), rig.bindP.get("Body").clone().add(hips).add(shift));
  placeFeet(T, footQ);
  groundFeet(T, footQ);
}

/** Captures the tracked local transforms of the current pose. */
function snapshot(rig) {
  const f = new Map();
  for (const n of TRACKED) {
    const b = rig.bones.get(n);
    f.set(n, { q: b.quaternion.clone(), p: b.position.clone() });
  }
  return f;
}

function applySnapshot(rig, f) {
  resetRig(rig);
  for (const [n, v] of f) {
    const b = rig.bones.get(n);
    b.quaternion.copy(v.q);
    if (POSITIONED.includes(n)) b.position.copy(v.p);
  }
  rig.scene.updateMatrixWorld(true);
}

function framesToClip(name, times, frames) {
  const tracks = [];
  for (const n of TRACKED) {
    const values = [];
    let prev = null;
    for (const f of frames) {
      const q = f.get(n).q.clone();
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep neighbouring keys in one hemisphere
      values.push(q.x, q.y, q.z, q.w);
      prev = q;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, values));
  }
  for (const n of POSITIONED) {
    tracks.push(new THREE.VectorKeyframeTrack(`${n}.position`, times, frames.flatMap((f) => f.get(n).p.toArray())));
  }
  return new THREE.AnimationClip(name, times[times.length - 1], tracks);
}

const frameTimes = (duration) => {
  const n = Math.max(2, Math.round(duration * FPS) + 1);
  return Array.from({ length: n }, (_, i) => (i / (n - 1)) * duration);
};

/** Retargets one source clip onto the target, sampling at FPS. */
function retargetClip(T, src, clip, name, shift) {
  const pose = clipPoser(src, clip);
  const times = frameTimes(clip.duration);
  const frames = times.map((t) => {
    pose(t);
    retargetPose(T, src, shift);
    return snapshot(T.rig);
  });
  return { name, times, frames };
}

/** Rotates a bone in world space so that `from` (a world direction) points along `to`. */
function swingBone(bone, from, to) {
  const swing = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  setWorldQ(bone, swing.multiply(worldQ(bone)));
}

/** Rotates a bone in world space about a world axis. */
function turnBone(bone, axis, angle) {
  setWorldQ(bone, new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(worldQ(bone)));
}

/** Analytic 2-bone IK: puts the wrist on `target`, bending the elbow towards `pole`. */
function reachArm(rig, side, target, pole) {
  const up = rig.bones.get(`UpperArm${side}`);
  const lo = rig.bones.get(`LowerArm${side}`);
  const wr = rig.bones.get(`Wrist${side}`);
  const S = worldP(up);
  const L1 = S.distanceTo(worldP(lo));
  const L2 = worldP(lo).distanceTo(worldP(wr));
  const d = target.clone().sub(S);
  const dist = THREE.MathUtils.clamp(d.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const dir = d.normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pv = pole.clone().sub(S);
  pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(pv.multiplyScalar(h));
  swingBone(up, worldP(lo).sub(S), E.clone().sub(S));
  const W = S.clone().add(dir.clone().multiplyScalar(dist));
  swingBone(lo, worldP(wr).sub(worldP(lo)), W.sub(worldP(lo)));
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

/** Seated typing loop built on the sitting pose: lean in, look down, hands on the keyboard. */
function typingClip(T, sitIdle) {
  const { rig } = T;
  const duration = 2.4;
  const times = frameTimes(duration);
  const base = sitIdle.frames;
  // Keyboard spot: wrists just above the table top, as far forward as a comfortably bent arm reaches.
  applySnapshot(rig, base[0]);
  turnBone(rig.bones.get("Torso"), X, 0.1);
  turnBone(rig.bones.get("Chest"), X, 0.06);
  const sL = worldP(rig.bones.get("UpperArmL"));
  const reach = sL.distanceTo(worldP(rig.bones.get("LowerArmL"))) + worldP(rig.bones.get("LowerArmL")).distanceTo(worldP(rig.bones.get("WristL")));
  const keysY = TABLE_TOP + 0.045;
  const keysZ = sL.z + Math.sqrt(Math.max(0.01, (reach * 0.9) ** 2 - (sL.y - keysY) ** 2));
  const frames = times.map((t) => {
    const u = t / duration;
    const src = base[Math.round(u * (base.length - 1))];
    applySnapshot(rig, src);
    turnBone(rig.bones.get("Torso"), X, 0.1 + 0.01 * Math.sin(TAU * u));
    turnBone(rig.bones.get("Chest"), X, 0.06);
    turnBone(rig.bones.get("Neck"), X, 0.18);
    turnBone(rig.bones.get("Head"), X, 0.12 + 0.025 * Math.sin(TAU * 3 * u));
    turnBone(rig.bones.get("Head"), Y, 0.06 * Math.sin(TAU * u));
    for (const [s, sx, n, ph] of [["L", 1, 11, 0], ["R", -1, 12, 1.3]]) {
      const tap = Math.max(0, Math.sin(TAU * n * u + ph)) * 0.014;
      const drift = 0.02 * Math.sin(TAU * 2 * u + ph);
      const target = new THREE.Vector3(sx * 0.13 + drift, keysY + tap, keysZ);
      const sh = worldP(rig.bones.get(`UpperArm${s}`));
      reachArm(rig, s, target, sh.clone().add(new THREE.Vector3(sx * 0.35, -0.5, -0.25)));
    }
    return snapshot(rig);
  });
  return { name: "SitTyping", times, frames, keys: { y: keysY, z: keysZ } };
}

/** Standing knock on a door about half a metre ahead: raise the right hand, three knocks, lower it. */
function knockClip(T, idle) {
  const { rig } = T;
  const duration = 1.7;
  const times = frameTimes(duration);
  const pose = clipPoser(rig, idle);
  const raise = (u) => THREE.MathUtils.smoothstep(u, 0.0, 0.2) * (1 - THREE.MathUtils.smoothstep(u, 0.8, 1.0));
  const frames = times.map((t) => {
    const u = t / duration;
    pose((t / duration) * idle.duration);
    // reset tracked bones to the idle pose, then override the right arm
    const s = snapshot(rig);
    applySnapshot(rig, s);
    const k = raise(u);
    if (k > 0.001) {
      const sh = worldP(rig.bones.get("UpperArmR"));
      const hand = worldP(rig.bones.get("WristR"));
      const knock = u > 0.22 && u < 0.78 ? Math.max(0, Math.sin(((u - 0.22) / 0.56) * TAU * 3)) : 0;
      // fist in front of the face with the elbow well bent; the door is about 0.35 m ahead
      const up = new THREE.Vector3(sh.x * 0.4, sh.y + 0.1, sh.z + 0.25 + 0.05 * knock);
      reachArm(rig, "R", hand.lerp(up, k), sh.clone().add(new THREE.Vector3(-0.25, -0.6, -0.05)));
      turnBone(rig.bones.get("Head"), X, 0.05 * k);
    }
    return snapshot(rig);
  });
  return { name: "Knock", times, frames };
}

/** Hips offset (world xz) of a frame relative to the body origin. */
function hipsXZ(rig, frame) {
  applySnapshot(rig, frame);
  const p = worldP(rig.bones.get("Body"));
  return [p.x, p.z];
}

/** Walking speed that keeps the planted foot still: how fast it slides back while on the ground. */
function strideSpeed(rig, clip) {
  const pose = clipPoser(rig, clip);
  const n = 240;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    pose((i / n) * clip.duration);
    pts.push(worldP(rig.bones.get("FootL")));
  }
  const minY = Math.min(...pts.map((p) => p.y));
  const speeds = [];
  const dt = clip.duration / n;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < minY + 0.012 && pts[i - 1].y < minY + 0.012) speeds.push(-(pts[i].z - pts[i - 1].z) / dt);
  }
  speeds.sort((a, b) => a - b);
  return speeds[Math.floor(speeds.length / 2)];
}

/** Posed vertices of a body in world space (CPU skinning). */
function posedVertices(rig) {
  rig.scene.updateMatrixWorld(true);
  const out = [];
  const v = new THREE.Vector3();
  for (const mesh of rig.skinned) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, v);
      out.push(v.clone().applyMatrix4(mesh.matrixWorld));
    }
  }
  return out;
}

/** Seat height, knee reach and feet height of the seated pose. */
function measureSeat(rig, frame) {
  applySnapshot(rig, frame);
  const vs = posedVertices(rig);
  const seat = Math.min(...vs.filter((p) => Math.abs(p.x) < 0.16 && p.z > -0.12 && p.z < 0.1).map((p) => p.y));
  const knees = Math.max(...vs.filter((p) => p.y > seat + 0.05 && p.y < seat + 0.25).map((p) => p.z));
  const back = Math.min(...vs.map((p) => p.z));
  const feet = Math.min(...vs.map((p) => p.y));
  // Top of the knees: highest leg vertex near the knee joints (arms resting on the lap are excluded).
  const kneeJ = worldP(rig.bones.get("LowerLegL"));
  const kneeTop = Math.max(...vs.filter((p) => Math.abs(Math.abs(p.x) - Math.abs(kneeJ.x)) < 0.09 && Math.abs(p.z - kneeJ.z) < 0.09 && p.y < kneeJ.y + 0.15).map((p) => p.y));
  return { seat, knees, back, feet, kneeTop };
}

// ---------------------------------------------------------------- glTF writing

// Quiet: quantize() warns that _MATID is outside [-1, 1], which is exactly why it is left unquantised.
const io = () =>
  new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const sanitize = (n) => THREE.PropertyBinding.sanitizeNodeName(n);
const KEEP_ATTRS = new Set(["POSITION", "NORMAL", "JOINTS_0", "WEIGHTS_0", "_MATID"]);

function linearToHex([r, g, b]) {
  const c = new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  return `#${c.getHexString(THREE.SRGBColorSpace)}`;
}

/**
 * The matrix M with IBM(skin) = IBM(base) * M for every joint, or null when the skins already match.
 * Some source meshes sit on a node offset that their inverse bind matrices compensate for.
 */
function skinDelta(base, skin, key) {
  const j0 = base.listJoints();
  if (skin.listJoints().some((j, i) => j !== j0[i])) throw new Error(`${key}: meshes use different joints`);
  const a = base.getInverseBindMatrices();
  const b = skin.getInverseBindMatrices();
  const el = [];
  const m = (acc, i) => new THREE.Matrix4().fromArray(acc.getElement(i, el));
  const M = m(a, 0).invert().multiply(m(b, 0));
  if (M.equals(new THREE.Matrix4())) return null;
  for (let i = 1; i < j0.length; i++) {
    const Mi = m(a, i).invert().multiply(m(b, i));
    if (Mi.elements.some((v, k) => Math.abs(v - M.elements[k]) > 1e-4)) throw new Error(`${key}: skins differ by more than a fixed offset`);
  }
  return M;
}

/** Moves a primitive's vertices into the shared skin's bind space. */
function bakeIntoBindSpace(prim, M) {
  const v = new THREE.Vector3();
  const el = [0, 0, 0];
  const pos = prim.getAttribute("POSITION").clone();
  for (let i = 0; i < pos.getCount(); i++) pos.setElement(i, v.fromArray(pos.getElement(i, el)).applyMatrix4(M).toArray());
  prim.setAttribute("POSITION", pos);
  const nrm = prim.getAttribute("NORMAL");
  if (nrm) {
    const N = new THREE.Matrix3().getNormalMatrix(M);
    const out = nrm.clone();
    for (let i = 0; i < out.getCount(); i++) out.setElement(i, v.fromArray(out.getElement(i, el)).applyMatrix3(N).normalize().toArray());
    prim.setAttribute("NORMAL", out);
  }
}

/**
 * Hair transplants: the casual body's own hair is a ponytail, so it gets the neat short cut from the suit body.
 * Both share one skeleton and the same head size, so the mesh drops straight on.
 */
const HAIR_FROM = { casual: "suit" };
async function donorHair(key) {
  const donor = await io().read(join(SRC, `${key}.glb`));
  for (const n of donor.getRoot().listNodes()) {
    const m = n.getMesh();
    if (!m || !/Head/.test(m.getName())) continue;
    for (const p of m.listPrimitives()) if (p.getMaterial().getName() === "Hair") return { prim: p, joints: n.getSkin().listJoints().map((j) => j.getName()) };
  }
  throw new Error(`no Hair primitive in ${key}`);
}
function transplantHair(prim, from, myJoints) {
  if (from.joints.length !== myJoints.length || from.joints.some((j, i) => j !== myJoints[i])) throw new Error("hair donor uses a different skeleton");
  for (const sem of ["POSITION", "NORMAL", "JOINTS_0", "WEIGHTS_0"]) prim.getAttribute(sem).setArray(from.prim.getAttribute(sem).getArray().slice());
  prim.getIndices().setArray(from.prim.getIndices().getArray().slice());
}

/**
 * Softens the faceted look: normals of vertices that share a position (and a palette slot) are averaged when the
 * faces meet at less than SMOOTH_ANGLE, so cloth and skin read as rounded while seams between clothes stay crisp.
 */
const SMOOTH_ANGLE = (62 * Math.PI) / 180;
function smoothNormals(prim) {
  const pos = prim.getAttribute("POSITION");
  const nrm = prim.getAttribute("NORMAL");
  const ids = prim.getAttribute("_MATID");
  const n = pos.getCount();
  const key = (i) => {
    const p = pos.getElement(i, []);
    return `${Math.round(p[0] * 2e4)}|${Math.round(p[1] * 2e4)}|${Math.round(p[2] * 2e4)}|${ids.getElement(i, [])[0]}`;
  };
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const k = key(i);
    (groups.get(k) ?? groups.set(k, []).get(k)).push(i);
  }
  const orig = Array.from({ length: n }, (_, i) => nrm.getElement(i, []));
  const cos = Math.cos(SMOOTH_ANGLE);
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const i of g) {
      const a = orig[i];
      let x = 0, y = 0, z = 0;
      for (const j of g) {
        const b = orig[j];
        if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= cos) {
          x += b[0];
          y += b[1];
          z += b[2];
        }
      }
      const l = Math.hypot(x, y, z) || 1;
      nrm.setElement(i, [x / l, y / l, z / l]);
    }
  }
}

/** Merges a body's four skinned meshes into one primitive with a palette slot per vertex. */
async function buildBody(body) {
  await MeshoptEncoder.ready;
  const doc = await io().read(join(SRC, `${body.key}.glb`));
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  for (const a of root.listAnimations()) a.dispose();
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const skins = meshNodes.map((n) => n.getSkin());
  const deltas = skins.map((s) => skinDelta(skins[0], s, body.key));
  const hairDonor = HAIR_FROM[body.key] ? await donorHair(HAIR_FROM[body.key]) : null;
  const material = doc.createMaterial("person").setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.82).setMetallicFactor(0);
  const slots = [];
  const slotOf = new Map();
  const prims = [];
  for (const [ni, node] of meshNodes.entries()) {
    const mesh = node.getMesh();
    const part = mesh.getName().split("_").pop();
    for (const prim of mesh.listPrimitives()) {
      if (deltas[ni]) bakeIntoBindSpace(prim, deltas[ni]);
      const mat = prim.getMaterial();
      const key = `${part}:${mat.getName()}`;
      if (!slotOf.has(key)) {
        slotOf.set(key, slots.length);
        const role = body.roles[key] ?? body.roles[mat.getName()] ?? key;
        slots.push({ key, role, color: linearToHex(mat.getBaseColorFactor()) });
      }
      if (hairDonor && mat.getName() === "Hair") transplantHair(prim, hairDonor, node.getSkin().listJoints().map((j) => j.getName()));
      const count = prim.getAttribute("POSITION").getCount();
      for (const sem of prim.listSemantics()) if (!KEEP_ATTRS.has(sem)) prim.setAttribute(sem, null);
      const joints = prim.getAttribute("JOINTS_0");
      joints.setArray(new Uint16Array(joints.getArray()));
      prim.setAttribute("_MATID", doc.createAccessor().setType("SCALAR").setArray(new Uint8Array(count).fill(slotOf.get(key))).setBuffer(buffer));
      prim.setMaterial(material);
      prims.push(prim);
    }
  }
  if (slots.length > 24) throw new Error(`${body.key}: too many palette slots`);
  const joined = joinPrimitives(prims);
  smoothNormals(joined);
  const mesh = doc.createMesh(body.key).addPrimitive(joined);
  const keep = meshNodes[0];
  keep.setMesh(mesh).setName(body.key);
  for (const n of meshNodes.slice(1)) n.dispose();
  for (const p of prims) p.dispose();
  await doc.transform(prune(), weld(), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const file = join(OUT, `${body.key}.glb`);
  await io().write(file, doc);
  return { slots, bytes: readFileSync(file).length, verts: joined.getAttribute("POSITION").getCount() };
}

/** Writes clips (three.js AnimationClips) into a GLB that carries only the skeleton's nodes. */
async function writeAnimFile(refKey, clips, file) {
  const doc = await io().read(join(SRC, `${refKey}.glb`));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) a.dispose();
  for (const n of root.listNodes()) {
    n.setMesh(null);
    n.setSkin(null);
  }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMaterials()) m.dispose();
  const buffer = root.listBuffers()[0];
  const byName = new Map(root.listNodes().map((n) => [sanitize(n.getName()), n]));
  for (const clip of clips) {
    const anim = doc.createAnimation(clip.name);
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      const node = byName.get(track.name.slice(0, dot));
      const path = { quaternion: "rotation", position: "translation", scale: "scale" }[track.name.slice(dot + 1)];
      if (!node || !path) continue;
      const input = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(track.times)).setBuffer(buffer);
      const output = doc.createAccessor().setType(path === "rotation" ? "VEC4" : "VEC3").setArray(new Float32Array(track.values)).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
    }
  }
  await doc.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io().write(file, doc);
  return readFileSync(file).length;
}

// ---------------------------------------------------------------- main

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

async function buildSkeleton(sex, ual) {
  const refKey = REFERENCE[sex];
  const gltf = await loadGltf(join(SRC, `${refKey}.glb`));
  const rig = makeRig(gltf);
  const T = makeTarget(rig, ual);
  const jointNames = new Set(rig.bones.keys());
  const find = (clips, name) => {
    const c = clips.find((x) => x.name === name);
    if (!c) throw new Error(`clip ${name} missing`);
    return c;
  };

  // Native clips: keep only joint tracks.
  const native = Object.entries(NATIVE_CLIPS).map(([from, to]) => {
    const c = find(gltf.animations, from).clone();
    c.name = to;
    c.tracks = c.tracks.filter((t) => jointNames.has(t.name.slice(0, t.name.lastIndexOf("."))));
    return c;
  });

  // Retargeted clips. Sitting clips are shifted so the seated hips sit over the body origin.
  const zero = new THREE.Vector3();
  const probe = retargetClip(T, ual, find(ual.gltf.animations, "Sitting_Idle_Loop"), "probe", zero);
  const avg = probe.frames.map((f) => hipsXZ(rig, f)).reduce((a, [x, z]) => [a[0] + x, a[1] + z], [0, 0]);
  const seatShift = new THREE.Vector3(-avg[0] / probe.frames.length, 0, -avg[1] / probe.frames.length);
  const baked = {};
  for (const [from, to] of Object.entries(UAL_CLIPS)) {
    baked[to] = retargetClip(T, ual, find(ual.gltf.animations, from), to, SITTING.has(to) ? seatShift : zero);
  }
  baked.SitTyping = typingClip(T, baked.SitIdle);
  baked.Knock = knockClip(T, find(native, "Idle"));
  const clips = [...native, ...Object.values(baked).map((b) => framesToClip(b.name, b.times, b.frames))];

  // Measurements the scene and the director depend on.
  const seat = measureSeat(rig, baked.SitIdle.frames[0]);
  const [sx, sz] = hipsXZ(rig, baked.SitDown.frames[0]);
  const [ex, ez] = hipsXZ(rig, baked.StandUp.frames[baked.StandUp.frames.length - 1]);
  applySnapshot(rig, baked.SitTyping.frames[0]);
  const wrist = worldP(rig.bones.get("WristL"));
  const measure = {
    walkSpeed: round(strideSpeed(rig, find(native, "Walk"))),
    runSpeed: round(strideSpeed(rig, find(native, "Run"))),
    seatHeight: round(seat.seat),
    kneeReach: round(seat.knees),
    kneeTop: round(seat.kneeTop),
    seatBack: round(seat.back),
    seatedFeetY: round(seat.feet),
    sitStart: [round(sx), round(sz)],
    standEnd: [round(ex), round(ez)],
    hands: { y: round(wrist.y), z: round(wrist.z) },
    tableTop: TABLE_TOP,
    legScale: round(T.k),
  };
  const durations = Object.fromEntries(clips.map((c) => [c.name, round(c.duration)]));
  const bytes = await writeAnimFile(refKey, clips, join(OUT, `anim-${sex}.glb`));
  return { measure, durations, bytes };
}

async function main() {
  if (process.argv.includes("--fetch")) await fetchSources();
  for (const b of BODIES) {
    const f = join(SRC, `${b.key}.glb`);
    if (!existsSync(f)) throw new Error(`missing ${f}; run with --fetch`);
    checkHash(f, b.sha);
  }
  const ualFile = join(SRC, "ual-standard.glb");
  if (!existsSync(ualFile)) throw new Error(`missing ${ualFile}; run with --fetch`);
  checkHash(ualFile, UAL.sha);
  mkdirSync(OUT, { recursive: true });

  const bodies = {};
  for (const b of BODIES) {
    const r = await buildBody(b);
    bodies[b.key] = { sex: b.sex, url: `/models/people/${b.key}.glb`, slots: r.slots.map(({ role, color }) => ({ role, color })) };
    console.log(`body ${b.key.padEnd(9)} ${String(r.verts).padStart(6)} verts ${(r.bytes / 1024).toFixed(0).padStart(5)} KB  slots: ${r.slots.map((s) => s.role).join(", ")}`);
  }

  const ual = makeRig(await loadGltf(ualFile));
  const rigs = {};
  for (const sex of ["m", "f"]) {
    const r = await buildSkeleton(sex, ual);
    rigs[sex] = { url: `/models/people/anim-${sex}.glb`, clips: r.durations, ...r.measure };
    console.log(`anim-${sex}.glb ${(r.bytes / 1024).toFixed(0)} KB`, JSON.stringify(r.measure));
  }

  const ts = `// Generated by scripts/build-people.mjs. Do not edit by hand.
// Palettes: one entry per vertex palette slot (_MATID). Rigs: clip lengths (s) and measured poses (m, body space, +z forward).

export const BODIES = ${JSON.stringify(bodies, null, 2)} as const;

export const RIGS = ${JSON.stringify(rigs, null, 2)} as const;
`;
  writeFileSync(GEN, ts);
  console.log(`wrote ${GEN}`);
}

export { BONE_MAP, SRC, loadGltf, makeRig, makeTarget, clipPoser, retargetPose, retargetClip, snapshot, applySnapshot, hipsXZ, worldP, worldQ };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
