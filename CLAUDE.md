# Virtual-office portfolio (Next.js 16, React Three Fiber)
- `src/office/layout.ts` walls, rooms, colliders (metres, x east, z south). `nav.ts` waypoint graph. `director.ts` scripted walks + free movement (no React).
- `src/office/world/*` 3D scene. `src/components/*` overlay UI. Content lives in `src/content/*`.
- Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run build` (static export to `out/`).
- Docker: `docker compose up --build` serves the export with nginx on :8080.
