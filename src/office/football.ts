/** Five-a-side on the park pitch: two teams chase, pass and shoot; goals reset to the centre spot. */
import { PITCH } from "./city";
import { clamp, rng, turnToward, yawTo, type V2 } from "./geom";
import { makePuppet, runSpeed, setAnim, walkSpeed, type Puppet, type Sex } from "./characters/rig";

export type Player = { puppet: Puppet; team: 0 | 1; keeper: boolean; home: V2; sex: Sex; kick: number; cool: number };
export type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number };

const X0 = PITCH.x - PITCH.len / 2;
const X1 = PITCH.x + PITCH.len / 2;
const Z0 = PITCH.z - PITCH.wid / 2;
const Z1 = PITCH.z + PITCH.wid / 2;
export const GOAL_HALF = 1.6;
const R = 0.11;

export class Football {
  players: Player[] = [];
  ball: Ball = { x: PITCH.x, y: R, z: PITCH.z, vx: 0, vy: 0, vz: 0, spin: 0 };
  private rnd = rng(23);
  private pause = 1.5;

  constructor(sexOf: (team: 0 | 1, i: number) => Sex) {
    // per team: keeper, two defenders, two forwards (as fractions of the half the team defends)
    const shape: [number, number, boolean][] = [
      [0.06, 0.5, true],
      [0.28, 0.28, false],
      [0.28, 0.72, false],
      [0.62, 0.35, false],
      [0.62, 0.65, false],
    ];
    for (const team of [0, 1] as const) {
      shape.forEach(([fx, fz, keeper], i) => {
        const x = team === 0 ? X0 + fx * PITCH.len * 0.5 : X1 - fx * PITCH.len * 0.5;
        const z = Z0 + fz * PITCH.wid;
        const p = makePuppet(x, z, team === 0 ? Math.PI / 2 : -Math.PI / 2, "Idle");
        this.players.push({ puppet: p, team, keeper, home: [x, z], sex: sexOf(team, i), kick: 0, cool: 0 });
      });
    }
  }

  private resetBall() {
    Object.assign(this.ball, { x: PITCH.x, y: R, z: PITCH.z, vx: 0, vy: 0, vz: 0 });
    this.pause = 2.5;
  }

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    const b = this.ball;
    this.pause = Math.max(0, this.pause - dt);
    // ball: roll with friction, bounce, stay inside the fence
    b.vy -= 9.8 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if (b.y < R) {
      b.y = R;
      b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.45 : 0;
    }
    const f = Math.exp(-(b.y <= R + 0.01 ? 0.9 : 0.15) * dt);
    b.vx *= f;
    b.vz *= f;
    b.spin += Math.hypot(b.vx, b.vz) * dt / R;
    const inGoalMouth = Math.abs(b.z - PITCH.z) < GOAL_HALF && b.y < 1.2;
    if ((b.x < X0 || b.x > X1) && inGoalMouth) {
      this.goal(b.x < X0 ? 1 : 0);
    } else {
      if (b.x < X0 + R || b.x > X1 - R) {
        b.x = clamp(b.x, X0 + R, X1 - R);
        b.vx *= -0.6;
      }
      if (b.z < Z0 + R || b.z > Z1 - R) {
        b.z = clamp(b.z, Z0 + R, Z1 - R);
        b.vz *= -0.6;
      }
    }

    // nearest outfield player of each team chases the ball
    const chaser: (Player | null)[] = [null, null];
    for (const team of [0, 1] as const) {
      let best = Infinity;
      for (const p of this.players) {
        if (p.team !== team || p.keeper) continue;
        const d = Math.hypot(p.puppet.x - b.x, p.puppet.z - b.z);
        if (d < best) {
          best = d;
          chaser[team] = p;
        }
      }
    }
    for (const p of this.players) this.movePlayer(p, p === chaser[p.team], dt);
  }

  private goal(scorer: 0 | 1) {
    for (const p of this.players) if (p.team === scorer) setAnim(p.puppet, "Wave");
    this.resetBall();
  }

  private movePlayer(p: Player, chasing: boolean, dt: number) {
    const b = this.ball;
    const pup = p.puppet;
    p.cool = Math.max(0, p.cool - dt);
    if (p.kick > 0) {
      // mid-kick: hold still and strike the ball at the right moment of the clip
      p.kick -= dt;
      if (p.kick < 0.55 && p.kick + dt >= 0.55 && Math.hypot(pup.x - b.x, pup.z - b.z) < 1.1) this.strike(p);
      return;
    }
    if (pup.anim === "Wave" && this.pause > 0) return;
    const attackX = p.team === 0 ? X1 : X0;
    let target: V2;
    let hurry = 1;
    if (this.pause > 0) target = p.home;
    else if (p.keeper) target = [p.home[0], clamp(b.z, PITCH.z - GOAL_HALF, PITCH.z + GOAL_HALF)];
    else if (chasing) {
      // run to a spot just behind the ball, on the side away from the goal we attack
      const dir = Math.sign(attackX - b.x) || 1;
      target = [b.x - dir * 0.45, b.z];
      hurry = 1.25;
    } else {
      // hold shape, drifting with the ball
      const shift = (b.x - PITCH.x) * 0.45;
      target = [clamp(p.home[0] + shift, X0 + 1, X1 - 1), clamp(p.home[1] + (b.z - PITCH.z) * 0.35, Z0 + 0.8, Z1 - 0.8)];
    }
    const dx = target[0] - pup.x;
    const dz = target[1] - pup.z;
    const d = Math.hypot(dx, dz);
    if (chasing && this.pause === 0 && p.cool === 0 && Math.hypot(pup.x - b.x, pup.z - b.z) < 0.75) {
      pup.yaw = yawTo([pup.x, pup.z], [attackX, PITCH.z]);
      setAnim(pup, "Kick");
      p.kick = 0.92;
      p.cool = 1.6;
      return;
    }
    const top = runSpeed(p.sex) * (p.keeper ? 0.6 : 0.85) * hurry;
    const v = d > 0.2 ? Math.min(top, d * 1.6) : 0;
    if (v > 0.01) {
      pup.x += (dx / d) * v * dt;
      pup.z += (dz / d) * v * dt;
      pup.yaw = turnToward(pup.yaw, Math.atan2(dx, dz), dt * 8);
    } else pup.yaw = turnToward(pup.yaw, yawTo([pup.x, pup.z], [b.x, b.z]), dt * 4);
    if (v > walkSpeed(p.sex) * 1.4) runOrWalk(pup, "Run", v / runSpeed(p.sex));
    else if (v > 0.25) runOrWalk(pup, "Walk", v / walkSpeed(p.sex));
    else runOrWalk(pup, "Idle", 1);
  }

  private strike(p: Player) {
    const b = this.ball;
    const attackX = p.team === 0 ? X1 + 0.5 : X0 - 0.5;
    // shoot when close to goal, otherwise pass forward to a teammate
    const mates = this.players.filter((m) => m.team === p.team && m !== p && !m.keeper);
    const ahead = mates.filter((m) => (attackX - m.puppet.x) * (attackX - b.x) > 0 && Math.abs(attackX - m.puppet.x) < Math.abs(attackX - b.x));
    let tx = attackX;
    let tz = PITCH.z + (this.rnd() - 0.5) * GOAL_HALF * 2.6;
    let power = 9 + this.rnd() * 4;
    if (Math.abs(attackX - b.x) > PITCH.len * 0.45 && ahead.length) {
      const m = ahead[Math.floor(this.rnd() * ahead.length)];
      tx = m.puppet.x;
      tz = m.puppet.z;
      power = 5 + this.rnd() * 2;
    }
    const d = Math.hypot(tx - b.x, tz - b.z) || 1;
    b.vx = ((tx - b.x) / d) * power;
    b.vz = ((tz - b.z) / d) * power;
    b.vy = this.rnd() < 0.3 ? 2.5 : 0.4;
  }
}

function runOrWalk(p: Puppet, anim: "Run" | "Walk" | "Idle", rate: number) {
  if (p.anim !== anim) setAnim(p, anim, rate);
  else p.rate = rate;
}
