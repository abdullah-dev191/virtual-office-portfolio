/** Shared materials for the merged, vertex-coloured meshes. */
import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from "three";

export const solidMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
export const glassMat = new MeshStandardMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.28,
  roughness: 0.08,
  metalness: 0.1,
  depthWrite: false,
  side: DoubleSide,
});
export const glowMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
