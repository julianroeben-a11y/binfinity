import { draw, drawRoundedRectangle, makeBox, makeCompound, makeCylinder, sketchCircle, sketchRoundedRectangle, type Drawing, type Shape3D } from "replicad";
import { GRID, HOLE_OFFSET, PLATE_HEIGHT, PLATE_PROFILE, PLATE_PROFILE_HEIGHT, PLATE_PROFILE_INSET, PLATE_RADIUS, PLATE_RIDGE_RADIUS } from "../gridfinity";
import { ParamError, type BuildInfo, type Params } from "../types";
import type { BuiltPiece } from "../build-types";
import { layoutBaseplate } from "./layout";

/** Small overlap so boolean cuts never leave zero-thickness skins. */
const EPS = 0.01;

/** Radius of the rounded outer top edge of the plate. */
const OUTER_ROUND = 0.5;
/** 45° chamfer around the top of magnet holes, makes pressing magnets in easier. */
const MAGNET_CHAMFER = 0.3;
/** Steps used to approximate the rounded ridge in the pocket loft. */
const RIDGE_STEPS = 5;

/** Solid that is subtracted from the plate for one cell, with its bottom at z = `z0`. */
function cellPocket(z0: number, throughBottom: boolean): Shape3D {
  const bottom = GRID - 2 * PLATE_PROFILE_INSET;
  const rBottom = PLATE_RADIUS - PLATE_PROFILE_INSET;
  // `inset` is measured from the 42 mm cell edge.
  const s = (inset: number, z: number) =>
    sketchRoundedRectangle(GRID - 2 * inset, GRID - 2 * inset, PLATE_RADIUS - inset, { plane: "XY", origin: z });
  const zMid0 = z0 + PLATE_PROFILE.bottomChamfer;
  const zMid1 = zMid0 + PLATE_PROFILE.vertical;
  const sections = [s(PLATE_PROFILE.topChamfer, zMid0), s(PLATE_PROFILE.topChamfer, zMid1)];
  // The upper 45° wall runs into an arc centred on the cell edge, tangent to
  // the wall, so the ridge between two cells is round instead of a knife edge.
  const R = PLATE_RIDGE_RADIUS;
  const zCentre = z0 + PLATE_PROFILE_HEIGHT - R * Math.SQRT2;
  // The last step ends EPS above the plate top: a section exactly in the top
  // plane makes the boolean cut fail.
  for (let k = 0; k < RIDGE_STEPS; k++) {
    const phi = (Math.PI / 4) * (1 - k / RIDGE_STEPS);
    sections.push(s(R * Math.sin(phi), zCentre + R * Math.cos(phi)));
  }
  // Exactly 42 mm at the top: neighbouring pockets then only touch instead of
  // overlapping, which makes the boolean cut about four times faster.
  sections.push(s(0, z0 + PLATE_HEIGHT + EPS));
  const start = sketchRoundedRectangle(bottom, bottom, rBottom, { plane: "XY", origin: throughBottom ? z0 - EPS : z0 });
  return start.loftWith(sections, { ruled: true });
}

/** Magnet hole of depth `depth` below `top` (through when it reaches z = 0), with a chamfered rim. */
function magnetHole(radius: number, depth: number, top: number): Shape3D {
  const through = depth >= top;
  const z0 = through ? -EPS : top - depth;
  const hole = makeCylinder(radius, top - z0 + EPS, [0, 0, z0]);
  const c = Math.min(MAGNET_CHAMFER, top - z0 - EPS);
  const rim = sketchCircle(radius, { plane: "XY", origin: top - c }).loftWith(
    sketchCircle(radius + c + EPS, { plane: "XY", origin: top + EPS }),
  );
  return hole.fuse(rim);
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

/** Dovetail connector dimensions (mm): half neck width, half head width, length past the seam, head corner radius. */
const DOVETAIL = { neck: 3, head: 4.5, length: 5, overlap: 1, round: 0.6 } as const;
/** Holes for 1.75 mm filament used as dowel pins: diameter and depth on each side of the seam. */
const PIN = { diameter: 2, depth: 8 } as const;
/**
 * Printed peg: a flat tab on the bed reaches under the neighbour, a round peg
 * on the tab sits in a blind hole. The neighbour is pressed on from above.
 */
const PEG = { width: 8, length: 7, overlap: 1, round: 1.5, diameter: 4, chamfer: 0.4, minFloor: 3 } as const;

/** Tab height and peg top for a given floor thickness. */
function pegLevels(floor: number) {
  return { tab: Math.max(1, 0.35 * floor), top: floor - Math.max(0.6, 0.2 * floor) };
}

/** Peg tab (`grow` = 0) or the matching recess (`grow` = clearance), seam along Y at x = 0, pointing to +x. */
function pegShape(floor: number, grow: number): Shape3D {
  const { tab, top } = pegLevels(floor);
  const len = PEG.length + PEG.overlap + 2 * grow;
  const base = drawRoundedRectangle(len, PEG.width + 2 * grow, PEG.round + grow)
    .translate(PEG.length / 2 - PEG.overlap / 2, 0)
    .sketchOnPlane("XY", grow ? -EPS : 0)
    .extrude(tab + grow + (grow ? EPS : 0)) as Shape3D;
  const r = PEG.diameter / 2 + grow;
  const x = PEG.length / 2;
  const c = (z: number, radius: number) => sketchCircle(radius, { plane: "XY", origin: [x, 0, z] });
  // Chamfered top so the neighbour slides on easily.
  const peg = c(tab - EPS, r).loftWith([c(top + grow - PEG.chamfer, r), c(top + grow, r - PEG.chamfer)], { ruled: true });
  return base.fuse(peg);
}

/**
 * Dovetail outline for a seam along Y at x = 0, centred on y = 0, pointing to
 * +x. `grow` enlarges it (used for the matching slot).
 */
function dovetail(grow: number, back: number): Drawing {
  const n = DOVETAIL.neck + grow;
  const h = DOVETAIL.head + grow;
  const l = DOVETAIL.length + grow;
  const r = DOVETAIL.round + grow;
  return draw([-back, -n]).lineTo([0, -n]).lineTo([l, -h]).customCorner(r).lineTo([l, h]).customCorner(r).lineTo([0, n]).lineTo([-back, n]).close();
}

interface Seam {
  /** Position of the seam line and the cell centres along it. */
  at: number;
  centres: number[];
  /** "x": seam runs along Y at x = at; "y": seam runs along X at y = at. */
  axis: "x" | "y";
  /** Piece indices on the low and the high side. */
  low: number;
  high: number;
}

function seams(layout: ReturnType<typeof layoutBaseplate>): Seam[] {
  const out: Seam[] = [];
  const index = new Map(layout.pieces.map((pc, i) => [`${pc.ix},${pc.iy}`, i]));
  layout.pieces.forEach((pc, i) => {
    const right = index.get(`${pc.ix + 1},${pc.iy}`);
    if (right !== undefined) {
      const centres = Array.from({ length: pc.cellsY }, (_, j) => layout.y.padStart + (pc.cellY0 + j + 0.5) * GRID);
      out.push({ at: pc.x1, centres, axis: "x", low: i, high: right });
    }
    const up = index.get(`${pc.ix},${pc.iy + 1}`);
    if (up !== undefined) {
      const centres = Array.from({ length: pc.cellsX }, (_, j) => layout.x.padStart + (pc.cellX0 + j + 0.5) * GRID);
      out.push({ at: pc.y1, centres, axis: "y", low: i, high: up });
    }
  });
  return out;
}

export function buildBaseplate(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const layout = layoutBaseplate(p);
  const solid = p.style === "solid";
  const floor = solid ? (p.floor as number) : 0;
  const height = floor + PLATE_HEIGHT;
  const radius = Math.min(p.cornerRadius as number, layout.width / 2, layout.depth / 2);
  const magnets = solid && p.magnets === true;
  const screws = solid && p.screws === true;
  const magnetR = (p.magnetDiameter as number) / 2;
  const magnetDepth = p.magnetDepth as number;
  const warnings: BuildInfo["warnings"] = [];
  if (magnets && magnetDepth >= floor) warnings.push({ key: "warn.magnetThrough" });

  // The whole plate with its outer top edge rounded; pieces are cut from it,
  // so the edges along the seams stay square and the pieces close flush.
  let plate = drawRoundedRectangle(layout.width, layout.depth, radius)
    .translate(layout.width / 2, layout.depth / 2)
    .sketchOnPlane("XY")
    .extrude(height) as Shape3D;
  try {
    plate = plate.fillet(OUTER_ROUND, (e) => e.inPlane("XY", height));
  } catch {
    // keep the square edge if OpenCascade cannot round it
  }

  // Build the template tools once and translate copies; that is much faster
  // than recreating the loft for every cell.
  const pocketTool = cellPocket(floor, !solid);
  const magnetTool = magnets ? magnetHole(magnetR, magnetDepth, floor) : null;
  const screwTool = screws ? screwHole(floor) : null;

  // Connectors between split pieces; they live in the floor, so they need one.
  const connector = solid && layout.pieces.length > 1 ? (p.connector as string) : "none";
  if (connector === "pins" && floor < PIN.diameter + 1) {
    throw new ParamError({ key: "err.pinsNeedFloor", vars: { min: PIN.diameter + 1 } });
  }
  if (connector === "peg" && floor < PEG.minFloor) {
    throw new ParamError({ key: "err.pegsNeedFloor", vars: { min: PEG.minFloor } });
  }
  const tabs: Shape3D[][] = layout.pieces.map(() => []);
  const cuts: Shape3D[][] = layout.pieces.map(() => []);
  if (connector !== "none") {
    const clearance = p.connectorClearance as number;
    for (const seam of seams(layout)) {
      for (const c of seam.centres) {
        // Build along X at the origin, then rotate for seams that run along X.
        const place = (shape: Shape3D) =>
          seam.axis === "x" ? shape.translate(seam.at, c, 0) : shape.rotate(90, [0, 0, 0], [0, 0, 1]).translate(c, seam.at, 0);
        if (connector === "puzzle") {
          tabs[seam.low].push(place(dovetail(0, DOVETAIL.overlap).sketchOnPlane("XY").extrude(floor) as Shape3D));
          cuts[seam.high].push(place(dovetail(clearance, EPS).sketchOnPlane("XY", -EPS).extrude(floor + EPS) as Shape3D));
        } else if (connector === "peg") {
          tabs[seam.low].push(place(pegShape(floor, 0)));
          cuts[seam.high].push(place(pegShape(floor, clearance)));
        } else {
          const pin = () => place(makeCylinder(PIN.diameter / 2, 2 * PIN.depth, [-PIN.depth, 0, floor / 2], [1, 0, 0]));
          cuts[seam.low].push(pin());
          cuts[seam.high].push(pin());
        }
      }
    }
  }

  const pieces: BuiltPiece[] = layout.pieces.map((piece) => {
    const multi = layout.pieces.length > 1;
    let shape = multi ? plate.clone().intersect(makeBox([piece.x0, piece.y0, -1], [piece.x1, piece.y1, height + 1])) : plate.clone();
    const index = layout.pieces.indexOf(piece);
    if (tabs[index].length) shape = shape.fuse(makeCompound(tabs[index]) as unknown as Shape3D);

    // Pockets and holes are cut in two passes: the tools inside one compound
    // must not overlap, and the magnet holes touch the pocket floors.
    const pockets: Shape3D[] = [];
    const holes: Shape3D[] = [...cuts[index]];
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

    return {
      name: multi ? `baseplate_${piece.ix + 1}-${piece.iy + 1}` : "baseplate",
      shape,
      origin: [piece.x0, piece.y0, 0],
      size: [piece.x1 - piece.x0, piece.y1 - piece.y0, height],
      grid: [piece.ix, piece.iy],
    };
  });

  plate.delete();
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
