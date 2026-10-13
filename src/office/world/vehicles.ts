/** Low-poly cars: a paint part (tinted per car) and a trim part (glass, wheels, lights). Forward is +z. */
import type { CarShape } from "../traffic";
import { GeoBuilder } from "./builder";

type Dims = { len: number; wid: number; body: number; cabin: number; cabinLen: number; cabinZ: number; wheel: number };
const DIMS: Record<CarShape, Dims> = {
  hatch: { len: 3.9, wid: 1.74, body: 0.62, cabin: 0.58, cabinLen: 2.1, cabinZ: -0.25, wheel: 0.31 },
  suv: { len: 4.5, wid: 1.9, body: 0.78, cabin: 0.68, cabinLen: 2.6, cabinZ: -0.3, wheel: 0.36 },
  van: { len: 5.0, wid: 2.0, body: 1.0, cabin: 0.9, cabinLen: 3.9, cabinZ: -0.45, wheel: 0.35 },
};

export function carParts(shape: CarShape, paint: GeoBuilder, trim: GeoBuilder, color = "#ffffff") {
  const d = DIMS[shape];
  const y0 = d.wheel * 0.75;
  // body and cabin
  paint.block(0, y0, 0, d.wid, d.body, d.len, color);
  paint.block(0, y0 + d.body, d.cabinZ, d.wid * 0.9, d.cabin, d.cabinLen, color);
  // windows wrap the cabin
  trim.block(0, y0 + d.body + 0.06, d.cabinZ, d.wid * 0.92, d.cabin - 0.16, d.cabinLen - 0.18, "#2C3A44");
  trim.box(0, y0 + d.body + d.cabin * 0.5, d.cabinZ + d.cabinLen / 2 - 0.02, d.wid * 0.84, d.cabin * 0.62, 0.05, "#3D5260", { rx: shape === "van" ? 0 : -0.35 });
  // bumpers and lights
  trim.block(0, y0 - 0.05, d.len / 2, d.wid * 0.98, 0.18, 0.12, "#2B2F33");
  trim.block(0, y0 - 0.05, -d.len / 2, d.wid * 0.98, 0.18, 0.12, "#2B2F33");
  for (const sx of [-1, 1]) {
    trim.box(sx * (d.wid / 2 - 0.22), y0 + d.body * 0.62, d.len / 2 + 0.01, 0.3, 0.12, 0.04, "#FFF3C8");
    trim.box(sx * (d.wid / 2 - 0.2), y0 + d.body * 0.62, -d.len / 2 - 0.01, 0.28, 0.12, 0.04, "#C8443A");
    trim.box(sx * (d.wid / 2 + 0.06), y0 + d.body + 0.06, d.cabinZ + d.cabinLen / 2 - 0.25, 0.1, 0.08, 0.14, "#2B2F33");
  }
  // wheels: axis along x
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const z = sz * (d.len / 2 - d.wheel * 1.55);
      trim.cyl(sx * (d.wid / 2 - 0.1), d.wheel - 0.12, z, d.wheel, 0.24, "#1E2226", 12, d.wheel, { rz: Math.PI / 2 });
      trim.cyl(sx * (d.wid / 2 - 0.06), d.wheel - 0.06, z, d.wheel * 0.5, 0.12, "#A9B0B4", 10, d.wheel * 0.5, { rz: Math.PI / 2 });
    }
  }
}

export const carLength = (s: CarShape) => DIMS[s].len;
