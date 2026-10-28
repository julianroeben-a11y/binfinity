// Honeycomb cut-outs for the outer walls of rectangular bins and boxes. They
// save filament and look nice; the hexagons stand on a corner, so their top
// edges are 60° overhangs that print without support.
import { makeCompound, makePolygon, makeSolid, type Point, type Shape3D } from "replicad";

/** Solid web between neighbouring openings, in mm. */
export const HONEYCOMB_WEB = 2;
/** 45° chamfer on the rims of the openings. */
const CHAMFER = 0.3;

/** Corners of a pointy-top hexagon of circumradius `r` in the XZ plane at `y`. */
function hexRing(r: number, y: number): Point[] {
  return Array.from({ length: 6 }, (_, k) => {
    const a = Math.PI / 2 + (k * Math.PI) / 3;
    return [r * Math.cos(a), y, r * Math.sin(a)] as Point;
  });
}

/**
 * Solid through rings of corners, built from flat faces. A ruled loft gives
 * curved (B-spline) faces even where they are flat, which makes the cut
 * several times slower.
 */
function planarLoft(rings: Point[][]): Shape3D {
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

export interface HoneycombOptions {
  /** Outer size of the (centred) rectangular body. */
  width: number;
  depth: number;
  wall: number;
  /** Height band of the walls that may be opened. */
  z0: number;
  z1: number;
  /** Width of one opening across its flats. */
  cell: number;
  /** Keep this much solid wall next to the outer corners. */
  cornerMargin: number;
  /** Positions along X (front/back walls) and Y (side walls) where dividers meet the wall. */
  dividersX: number[];
  dividersY: number[];
  /** Half the width kept solid around a divider. */
  dividerMargin: number;
}

/** Opening centres along a wall of `length`, as [u, z], u measured from the wall centre. */
export function honeycombCentres(
  length: number,
  z0: number,
  z1: number,
  cell: number,
  cornerMargin: number,
  blocked: number[],
  blockMargin: number,
): [number, number][] {
  const pitch = cell + HONEYCOMB_WEB;
  const rowPitch = (pitch * Math.sqrt(3)) / 2;
  // Pointy-top hexagon: half height is the circumradius.
  const halfH = cell / Math.sqrt(3);
  const u0 = -length / 2 + cornerMargin + cell / 2;
  const u1 = length / 2 - cornerMargin - cell / 2;
  const zMin = z0 + halfH;
  const zMax = z1 - halfH;
  if (u1 < u0 || zMax < zMin) return [];
  const rows = Math.floor((zMax - zMin) / rowPitch) + 1;
  const zStart = zMin + (zMax - zMin - (rows - 1) * rowPitch) / 2;
  const cols = Math.floor((u1 - u0) / pitch) + 1;
  const uStart = -((cols - 1) * pitch) / 2;
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const z = zStart + r * rowPitch;
    const shift = r % 2 ? pitch / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const u = uStart + c * pitch + shift;
      if (u < u0 - 1e-6 || u > u1 + 1e-6) continue;
      if (blocked.some((b) => Math.abs(u - b) < cell / 2 + blockMargin)) continue;
      out.push([u, z]);
    }
  }
  return out;
}

/**
 * Prisms to subtract from a centred rectangular body. Each reaches a little
 * past the inner wall face (`poke`), so the later cavity cut never shares a
 * face with them.
 */
export function honeycombTool(o: HoneycombOptions, poke = 0.5): { tool: Shape3D | null; count: number } {
  const EPS = 0.01;
  // Prism along -Y with its outer face at y = 0, standing on a corner. Both
  // rims get a small 45° chamfer, so the openings have no sharp edges. The
  // inner chamfer runs on past the wall instead of ending in a straight
  // section; fewer faces keep the cut fast.
  const c = Math.min(CHAMFER, o.wall / 4);
  const proto = planarLoft([
    [c + EPS, EPS],
    [0, -c],
    [0, -(o.wall - c)],
    [c + poke, -(o.wall + poke)],
  ].map(([grow, y]) => hexRing((o.cell + 2 * grow) / Math.sqrt(3), y)));
  const prisms: Shape3D[] = [];
  const along = (length: number, blocked: number[]) =>
    honeycombCentres(length, o.z0, o.z1, o.cell, o.cornerMargin, blocked, o.dividerMargin);

  // Back (y = +depth/2) and front (y = -depth/2).
  for (const [u, z] of along(o.width, o.dividersX)) {
    prisms.push(proto.clone().translate(u, o.depth / 2 + EPS, z));
    prisms.push(proto.clone().rotate(180, [0, 0, 0], [0, 0, 1]).translate(u, -o.depth / 2 - EPS, z));
  }
  // Sides: rotate so the prism runs along X.
  for (const [u, z] of along(o.depth, o.dividersY)) {
    prisms.push(proto.clone().rotate(90, [0, 0, 0], [0, 0, 1]).translate(-o.width / 2 - EPS, u, z));
    prisms.push(proto.clone().rotate(-90, [0, 0, 0], [0, 0, 1]).translate(o.width / 2 + EPS, u, z));
  }
  proto.delete();
  if (!prisms.length) return { tool: null, count: 0 };
  return { tool: makeCompound(prisms) as unknown as Shape3D, count: prisms.length };
}
