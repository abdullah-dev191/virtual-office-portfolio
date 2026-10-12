# Upgrade plan: living city office

## Audit of the starting point

- Next.js 16 static export with React Three Fiber, a pure-TS `Director` (scripted walks, free movement, door states) and a grid A* in `nav.ts`. These ideas are kept.
- People were built from capsules and spheres (`world/People.tsx`). They are replaced by rigged GLB characters.
- The world was one straight road with three parked cars. It becomes a small city with traffic.
- Five rooms (Work Studio, Tech Lab, Operations, Meeting Room, Boss Cabin) with a walk-to-room flow. This grows to seven departments with seats, and the visitor sits down at each table.
- Furniture positions were typed twice (render code and a collider list). They move into one array in `layout.ts` that drives both.

## Assets (all CC0)

| What | Source | How it is used |
|---|---|---|
| 8 clothed bodies (4 men, 4 women) | Quaternius "Ultimate Modular Men / Women", mirrored on poly.pizza | Meshes merged into one skinned mesh per body. Each vertex keeps a palette slot so clothes, hair and skin can be recoloured in code. |
| Idle, Walk, Run, Interact, Wave, Kick | Same files (native clips) | Copied into one shared clip file per skeleton. |
| Sit down, sit idle, sit talk, stand up, talk | Quaternius "Universal Animation Library" (Standard) | Retargeted offline onto both skeletons (rest-relative world rotations, hips scaled by leg length, IK feet re-attached to the ankles). |
| Typing, knock | none | Posed procedurally from the bones with 2-bone IK in the build script. |

`scripts/build-people.mjs` downloads the sources, retargets and compresses everything (meshopt) into `public/models/people/`. It also writes measured walk speed, seat height and hand positions to `src/office/characters/rig.generated.ts`, so foot speed and seating match the clips.

## Floor plan (metres, x east, z south, entrance in the south)

```
 z=-19 +------------+--------------------+------------+
       | Design Room|    Boss Cabin      | Operations |
       |            |  (desk, shelves)   |            |
 z=-10 +----door----+----door(z=-11)-----+----door----+
       | Work Studio|    Open office     | Meeting Rm |
       |            | pods, glass, plants|            |
 z=0   +----door----+--------------------+----door----+
       | The Lounge |  Lobby + Reception | Tech Lab   |
 z=10  +------------+---main glass doors-+------------+
      x=-21       x=-9                 x=9          x=21
```

Outside: front garden and path, boundary wall with a green iron gate and a security booth at z=16, pavement, then the main street (two lanes, zebra crossing at the gate). A ring road runs round the office block. A second block across the street holds the park, the pond and the football ground. Neighbouring buildings sit around the edges.

## Order of work

The brief's order is kept, except that the character system (brief step 4) comes before the city, because pedestrians and footballers need it.

1. Audit and plan (this file).
2. People: asset pipeline, character loader, clip cross-fading, roster and name pills.
3. City: roads, crossings, traffic, pedestrians, park, football ground, aerial intro camera.
4. Entrance: booth, guard, gate, name board, front garden.
5. Building shell, interior and furniture definitions, with colliders generated from them.
6. Navigation (A* plus string pulling, 0.45 m clearance), doors, guided walks, reception flow.
7. Seat anchors and the sit-down / stand-up sequence in every department.
8. Overlay UI: cards, place list, toolbar, quality switch, Classic view.
9. Content wiring, polish, accessibility, mobile.
10. Route collision check (runs before every build), lint, typecheck, build, Docker.
