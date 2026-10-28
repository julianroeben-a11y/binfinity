// Small solid-building helpers shared by the models.
import { makePolygon, makeSolid, type Point, type Shape3D } from "replicad";

/**
 * Solid through rings of corners, built from flat faces. A ruled loft gives
 * curved (B-spline) faces even where they are flat, which makes the cut
 * several times slower.
 */
export function planarLoft(rings: Point[][]): Shape3D {
  const faces = [makePolygon([...rings[0]].reverse()), makePolygon(rings[rings.length - 1])];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let k = 0; k < a.length; k++) {
      const k1 = (k + 1) % a.length;
      faces.push(makePolygon([a[k], a[k1], b[k1], b[k]]));
    }
  }
  return makeSolid(faces) as unknown as Shape3D;
}
