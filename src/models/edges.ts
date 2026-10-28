// Rounding and chamfering helpers shared by the models.
import { getOC, type Plane, type Shape3D } from "replicad";

/** OpenCascade sometimes returns a broken solid instead of failing. */
function valid(shape: Shape3D): boolean {
  return new (getOC().BRepCheck_Analyzer)(shape.wrapped, true, false).IsValid();
}

/**
 * Round all edges lying in the plane z = `z`. Keeps the shape if OpenCascade
 * cannot do it (the export is still valid, just with square edges).
 */
export function roundEdgesAt(shape: Shape3D, z: number, radius: number): Shape3D {
  if (radius < 0.1) return shape;
  try {
    const out = shape.fillet(radius, (e) => e.inPlane("XY", z));
    return valid(out) ? out : shape;
  } catch {
    return shape;
  }
}

/** Round all edges lying in `plane` (e.g. a sloped top); keeps the shape if that fails. */
export function roundEdgesIn(shape: Shape3D, plane: Plane, radius: number): Shape3D {
  try {
    const out = shape.fillet(radius, (e) => e.inPlane(plane));
    return valid(out) ? out : shape;
  } catch {
    return shape;
  }
}

/** Chamfer all edges lying in the plane z = `z` (used on the bed side, where a round would overhang). */
export function chamferEdgesAt(shape: Shape3D, z: number, size: number): Shape3D {
  if (size < 0.1) return shape;
  try {
    const out = shape.chamfer(size, (e) => e.inPlane("XY", z));
    return valid(out) ? out : shape;
  } catch {
    return shape;
  }
}
