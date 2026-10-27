import { drawRectangle, drawRoundedRectangle, makeCompound, makeCylinder, sketchCircle, sketchRoundedRectangle, type Shape3D } from "replicad";
import { GRID, HOLE_OFFSET, PLATE_PROFILE, PLATE_PROFILE_HEIGHT, PLATE_PROFILE_INSET, PLATE_RADIUS } from "../gridfinity";
import type { BuildInfo, Params } from "../types";
import type { BuiltPiece } from "../build-types";
import { layoutBaseplate } from "./layout";

/** Small overlap so boolean cuts never leave zero-thickness skins. */
const EPS = 0.01;

/** Solid that is subtracted from the plate for one cell, with its bottom at z = `z0`. */
function cellPocket(z0: number, throughBottom: boolean): Shape3D {
  const top = GRID;
  const bottom = GRID - 2 * PLATE_PROFILE_INSET;
  const mid = bottom + 2 * PLATE_PROFILE.bottomChamfer;
  const rTop = PLATE_RADIUS;
  const rBottom = PLATE_RADIUS - PLATE_PROFILE_INSET;
  const rMid = rBottom + PLATE_PROFILE.bottomChamfer;
  const zMid0 = z0 + PLATE_PROFILE.bottomChamfer;
  const zMid1 = zMid0 + PLATE_PROFILE.vertical;
  const zTop = z0 + PLATE_PROFILE_HEIGHT + EPS;
  const sections = [
    sketchRoundedRectangle(mid, mid, rMid, { plane: "XY", origin: zMid0 }),
    sketchRoundedRectangle(mid, mid, rMid, { plane: "XY", origin: zMid1 }),
    // Exactly 42 mm at the top: neighbouring pockets then only touch instead of
    // overlapping, which makes the boolean cut about four times faster. The
    // ridge this leaves between cells is EPS wide (0.02 mm), far below a nozzle.
    sketchRoundedRectangle(top, top, rTop, { plane: "XY", origin: zTop }),
  ];
  const start = sketchRoundedRectangle(bottom, bottom, rBottom, { plane: "XY", origin: throughBottom ? z0 - EPS : z0 });
  return start.loftWith(sections, { ruled: true });
}

/** Countersunk hole for a flat-head M3 screw, head flush with the floor top. */
function screwHole(floor: number): Shape3D {
  const shaft = makeCylinder(1.75, floor + 2 * EPS, [0, 0, -EPS]);
  const headR = 3.5;
  const sink = Math.min(floor, headR - 1.75);
  const cone = sketchCircle(1.75, { plane: "XY", origin: floor - sink }).loftWith(
    sketchCircle(headR, { plane: "XY", origin: floor + EPS }),
  );
  return shaft.fuse(cone);
}

export function buildBaseplate(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const layout = layoutBaseplate(p);
  const solid = p.style === "solid";
  const floor = solid ? (p.floor as number) : 0;
  const height = floor + PLATE_PROFILE_HEIGHT;
  const radius = Math.min(p.cornerRadius as number, layout.width / 2, layout.depth / 2);
  const magnets = solid && p.magnets === true;
  const screws = solid && p.screws === true;
  const magnetR = (p.magnetDiameter as number) / 2;
  const magnetDepth = p.magnetDepth as number;
  const warnings: BuildInfo["warnings"] = [];
  if (magnets && magnetDepth >= floor) warnings.push({ key: "warn.magnetThrough" });

  const outline = drawRoundedRectangle(layout.width, layout.depth, radius).translate(layout.width / 2, layout.depth / 2);

  // Build the template tools once and translate copies; that is much faster
  // than recreating the loft for every cell.
  const pocketTool = cellPocket(floor, !solid);
  const magnetTool = magnets
    ? magnetDepth >= floor
      ? makeCylinder(magnetR, floor + 2 * EPS, [0, 0, -EPS])
      : makeCylinder(magnetR, magnetDepth + EPS, [0, 0, floor - magnetDepth])
    : null;
  const screwTool = screws ? screwHole(floor) : null;

  const pieces: BuiltPiece[] = layout.pieces.map((piece) => {
    const rect = drawRectangle(piece.x1 - piece.x0, piece.y1 - piece.y0).translate(
      (piece.x0 + piece.x1) / 2,
      (piece.y0 + piece.y1) / 2,
    );
    let shape: Shape3D = outline.clone().intersect(rect).sketchOnPlane("XY").extrude(height) as Shape3D;

    // Pockets and holes are cut in two passes: the tools inside one compound
    // must not overlap, and the magnet holes touch the pocket floors.
    const pockets: Shape3D[] = [];
    const holes: Shape3D[] = [];
    for (let i = 0; i < piece.cellsX; i++) {
      for (let j = 0; j < piece.cellsY; j++) {
        const cx = layout.x.padStart + (piece.cellX0 + i + 0.5) * GRID;
        const cy = layout.y.padStart + (piece.cellY0 + j + 0.5) * GRID;
        pockets.push(pocketTool.clone().translate(cx, cy, 0));
        if (magnetTool) {
          for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            holes.push(magnetTool.clone().translate(cx + dx * HOLE_OFFSET, cy + dy * HOLE_OFFSET, 0));
          }
        }
        if (screwTool) holes.push(screwTool.clone().translate(cx, cy, 0));
      }
    }
    shape = shape.cut(makeCompound(pockets) as unknown as Shape3D);
    if (holes.length) shape = shape.cut(makeCompound(holes) as unknown as Shape3D);

    const multi = layout.pieces.length > 1;
    return {
      name: multi ? `baseplate_${piece.ix + 1}-${piece.iy + 1}` : "baseplate",
      shape,
      origin: [piece.x0, piece.y0, 0],
      size: [piece.x1 - piece.x0, piece.y1 - piece.y0, height],
      grid: [piece.ix, piece.iy],
    };
  });

  pocketTool.delete();
  magnetTool?.delete();
  screwTool?.delete();

  const fmt = (n: number) => Math.round(n * 100) / 100;
  const facts: BuildInfo["facts"] = [
    { key: "fact.cells", vars: { x: layout.x.cells, y: layout.y.cells } },
    { key: "fact.size", vars: { x: fmt(layout.width), y: fmt(layout.depth), z: fmt(height) } },
    { key: "fact.pieces", vars: { n: pieces.length, x: layout.x.split.length, y: layout.y.split.length } },
  ];
  if (p.sizeMode === "drawer") {
    facts.push({
      key: "fact.padding",
      vars: {
        l: fmt(layout.x.padStart),
        r: fmt(layout.x.padEnd),
        f: fmt(layout.y.padStart),
        b: fmt(layout.y.padEnd),
      },
    });
  }
  return { pieces, info: { size: [layout.width, layout.depth, height], facts, warnings } };
}
