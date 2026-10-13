"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, MeshStandardMaterial, Object3D } from "three";
import { CharacterModel } from "../characters/CharacterModel";
import { pedestrianLook } from "../characters/roster";
import { CAR_COLORS, type CarShape, type Traffic } from "../traffic";
import { GeoBuilder } from "./builder";
import { solidMat } from "./materials";
import { carParts } from "./vehicles";

const SHAPES: CarShape[] = ["hatch", "suv", "van"];
const paintMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 });

function CarShapeMeshes({ traffic, shape }: { traffic: Traffic; shape: CarShape }) {
  const cars = useMemo(() => traffic.cars.filter((c) => c.shape === shape), [traffic, shape]);
  const geo = useMemo(() => {
    const paint = new GeoBuilder();
    const trim = new GeoBuilder();
    carParts(shape, paint, trim);
    return { paint: paint.build(), trim: trim.build() };
  }, [shape]);
  const paintRef = useRef<InstancedMesh>(null);
  const trimRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const c = new Color();
    cars.forEach((car, i) => paintRef.current?.setColorAt(i, c.set(CAR_COLORS[car.color])));
    if (paintRef.current?.instanceColor) paintRef.current.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame(() => {
    cars.forEach((car, i) => {
      dummy.position.set(car.x, car.y - 0.15, car.z);
      dummy.rotation.set(0, car.yaw, 0);
      dummy.updateMatrix();
      paintRef.current?.setMatrixAt(i, dummy.matrix);
      trimRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (paintRef.current) paintRef.current.instanceMatrix.needsUpdate = true;
    if (trimRef.current) trimRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!cars.length) return null;
  return (
    <group>
      <instancedMesh ref={paintRef} args={[geo.paint, paintMat, cars.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={trimRef} args={[geo.trim, solidMat, cars.length]} castShadow frustumCulled={false} />
    </group>
  );
}

export function TrafficView({ traffic }: { traffic: Traffic }) {
  return (
    <group>
      {SHAPES.map((s) => (
        <CarShapeMeshes key={s} traffic={traffic} shape={s} />
      ))}
      {traffic.walkers.map((w, i) => (
        <CharacterModel key={i} puppet={w.puppet} look={pedestrianLook(i)} />
      ))}
    </group>
  );
}
