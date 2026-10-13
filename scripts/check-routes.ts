/**
 * Route collision check. Runs before every build (npm run build -> prebuild) and fails it on any problem:
 *  1. every stand point (doors, seats, reception, gate...) has the full body clearance,
 *  2. a route exists between every pair of stand points,
 *  3. every route keeps the body clearance from every wall and piece of furniture along its whole length,
 *  4. the scripted door passages are clear.
 */
import { clearanceAt, hitAt } from "../src/office/colliders";
import { dist, type V2 } from "../src/office/geom";
import { doors, standPoints } from "../src/office/layout";
import { CLEARANCE, findStrictPath } from "../src/office/nav";

const TOL = 0.01;
const problems: string[] = [];
const fmt = (p: V2) => `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;

function checkSegment(a: V2, b: V2, label: string, pad = CLEARANCE) {
  const n = Math.max(1, Math.ceil(dist(a, b) / 0.02));
  for (let k = 0; k <= n; k++) {
    const p: V2 = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
    const c = clearanceAt(p[0], p[1]);
    if (c < pad - TOL) {
      const hit = hitAt(p[0], p[1], pad - TOL);
      problems.push(`${label}: ${fmt(p)} is ${c.toFixed(3)} m from ${hit?.tag ?? "the map edge"} (needs ${pad})`);
      return false;
    }
  }
  return true;
}

const t0 = Date.now();
const pts = standPoints();

for (const s of pts) {
  const c = clearanceAt(s.p[0], s.p[1]);
  if (c < CLEARANCE - TOL) problems.push(`stand point ${s.id} ${fmt(s.p)} has only ${c.toFixed(3)} m clearance (${hitAt(s.p[0], s.p[1], CLEARANCE)?.tag})`);
}

let routes = 0;
let samples = 0;
for (let i = 0; i < pts.length; i++) {
  for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i];
    const b = pts[j];
    const path = findStrictPath(a.p, b.p);
    routes++;
    if (!path) {
      problems.push(`no clear route ${a.id} -> ${b.id}`);
      continue;
    }
    if (dist(path[0], a.p) > 0.02 || dist(path[path.length - 1], b.p) > 0.02) {
      problems.push(`route ${a.id} -> ${b.id} does not start/end on its stand points`);
    }
    for (let k = 1; k < path.length; k++) {
      samples += Math.ceil(dist(path[k - 1], path[k]) / 0.02);
      if (!checkSegment(path[k - 1], path[k], `route ${a.id} -> ${b.id}`)) break;
    }
  }
}

// Scripted door passages: from the corridor stand point straight through the doorway.
for (const d of Object.values(doors)) checkSegment(d.out, d.inn, `door passage ${d.id}`, 0.5);

const ms = Date.now() - t0;
if (problems.length) {
  console.error(`check-routes: ${problems.length} problem(s) in ${routes} routes (${ms} ms)`);
  for (const p of problems.slice(0, 40)) console.error("  - " + p);
  process.exit(1);
}
console.log(`check-routes: ${pts.length} stand points, ${routes} routes, ${samples} samples, all clear of walls and furniture by ${CLEARANCE} m (${ms} ms)`);
