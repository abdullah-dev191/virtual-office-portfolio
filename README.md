# Muhammad Abdullah, interactive office portfolio

A small 3D city with an office in the middle. The visitor walks in from the street across a zebra crossing, past a security booth and gate, to reception, then is walked to a department, sits down at the table and reads the portfolio in a side card. A plain scrolling Classic view has the same content.

Next.js 16 (App Router, static export), React 19, TypeScript strict, React Three Fiber, drei.

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # runs the route check, then exports to ./out
npm run typecheck && npm run lint
docker compose up --build   # nginx on http://localhost:8080
```

## Controls

Click or tap the floor, or use WASD / arrow keys. Walk up to a table to sit. `Esc` stands you up (or skips a walk). The left list jumps to a place with a guided walk. The bottom bar has zoom, Move view (drag to pan), Football ground, Full view, Neighbourhood and Watch demo. Quality (Low / Medium / High) is in the top bar and starts on Low on phones. Classic view opens on request, without WebGL, and when `prefers-reduced-motion` is on.

## Editing content

All text lives in `src/content/` (`profile.ts`, `projects.ts`, `experience.ts`, `departments.ts`). Nothing there touches 3D code.

## How it is organised

- `src/office/layout.ts`: walls, doors, seats and the single furniture array that drives both the scene and the collision map. `colliders.ts` is generated from it.
- `src/office/nav.ts`: grid A* (0.15 m cells, 0.45 m body clearance) plus string pulling.
- `src/office/director.ts`: scripted walks, doors, knock, sit and stand sequences, free movement. No React.
- `src/office/traffic.ts`, `football.ts`, `city.ts`: cars, pedestrians, the park, the pitch.
- `src/office/camera.ts`: aerial intro, follow cam, seated framing, presets.
- `src/office/world/*`: the 3D scene. `src/components/*`: DOM overlay.
- `scripts/check-routes.ts`: tests every route between every pair of stand points and fails the build on any clip (runs as `prebuild`).
- `scripts/build-people.mjs`: builds the people (see below). Run with `npm run people` (add `-- --fetch` to download the sources).

## People and credits

All characters and animations are **CC0 (public domain)** by Quaternius. No attribution is required, but credit is given here.

- 8 clothed bodies from Quaternius' Ultimate Modular Men / Women characters (Business Man, Casual Character, Hoodie Character, Worker, Animated Woman x2, Punk, Adventurer), downloaded from poly.pizza (each page lists CC0 1.0): https://poly.pizza/u/Quaternius
- Sit, sit idle, sit talking, stand up and talking clips from the Universal Animation Library (Standard, CC0), mirrored on OpenGameArt: https://quaternius.com/packs/universalanimationlibrary.html
- Typing and knocking have no source clip, so they are posed procedurally in `build-people.mjs`.

The script merges each body into one skinned mesh with a palette slot per vertex (so clothes, hair and skin are recoloured in code), retargets the clips onto both skeletons (men, women), measures walking speed so feet do not slide, and compresses with meshopt. Source SHA-256 hashes are checked. Output: `public/models/people/` (about 2.6 MB gzipped in total) and `src/office/characters/rig.generated.ts`.

## Notes

- The reference video was used for behaviour only; no text, brand or assets were copied.
- `docker compose up --build` could not be run on the machine this was built on (no Docker installed); the Dockerfile and nginx config are unchanged and the static export builds.
