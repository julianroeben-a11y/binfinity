// Sloped tops for the inlays of the desk organizer: cut a block along the
// plane of the organizer's top and round the new edges.
import { draw, Plane, type Shape3D } from "replicad";
import { roundEdgesIn } from "./edges";

/**
 * Cut everything above the plane that is at height `z` along the front edge
 * (y = -d/2) of a `w` × `d` block centred on the origin and rises by `slope`
 * per mm towards +Y. The edges along the cut are rounded by `radius`.
 */
export function cutSlope(shape: Shape3D, w: number, d: number, z: number, slope: number, radius: number): Shape3D {
  const y0 = -d / 2 - 1;
  const y1 = d / 2 + 1;
  const above = (y: number) => z + (y + d / 2) * slope;
  const high = above(y1) + 50;
  const tool = draw([y0, above(y0)])
    .lineTo([y1, above(y1)])
    .lineTo([y1, high])
    .lineTo([y0, high])
    .close()
    .sketchOnPlane("YZ", -w / 2 - 1)
    .extrude(w + 2) as Shape3D;
  const cut = shape.cut(tool);
  const n = Math.hypot(1, slope);
  return roundEdgesIn(cut, new Plane([0, -d / 2, z], [1, 0, 0], [0, -slope / n, 1 / n]), radius);
}
