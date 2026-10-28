// Inserts: a solid block with holes or slots that hold small items upright,
// either as a Gridfinity bin or as a loose block that drops into a box.
import { draw, drawRoundedRectangle, makeCompound, type Point, type Shape3D } from "replicad";
import { cellCentres, foot, footHoles, lipTool, LIP_ROUND } from "../bin/build";
import { chamferEdgesAt, roundEdgesAt } from "../edges";
import { BIN_CLEARANCE, BIN_FOOT_HEIGHT, BIN_RADIUS, GRID, HEIGHT_UNIT, LIP_HEIGHT, LIP_INSET } from "../gridfinity";
import { planarLoft } from "../solids";
import type { BuiltPiece } from "../build-types";
import { ParamError, type BuildInfo, type Params } from "../types";
import { layoutItems, layoutSizes, parseSizes } from "./layout";

const EPS = 0.01;
/** Material kept between neighbouring openings at least. */
const WEB = 1.6;
/** Items keep at least this much distance from the outer edge (or the lip). */
const EDGE = 1.5;
/** 45° entry chamfer on the openings, so items find their way in. */
const ENTRY = 0.8;
/** Loose inserts: corner radius, bottom chamfer and rounded top edge. */
const LOOSE_RADIUS = 2;
const LOOSE_CHAMFER = 0.4;
const TOP_ROUND = 0.6;

/** Corners of a hexagon with flats parallel to X, `s` across flats, in the XY plane. */
function hexRing(s: number, z: number): Point[] {
  const r = s / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3;
    return [r * Math.cos(a), r * Math.sin(a), z] as Point;
  });
}

function rectRing(x: number, y: number, z: number): Point[] {
  return [
    [-x / 2, -y / 2, z],
    [x / 2, -y / 2, z],
    [x / 2, y / 2, z],
    [-x / 2, y / 2, z],
  ];
}

/**
 * One opening, centred on the origin, from `z0` up through the top face at
 * `top`, with a 45° entry chamfer `c`.
 */
function openingTool(kind: string, x: number, y: number, z0: number, top: number, c: number): Shape3D {
  const zc = top - c;
  if (kind === "round") {
    // Revolving the profile gives true cylinder and cone faces.
    const r = x / 2;
    return draw([0, z0])
      .lineTo([r, z0])
      .lineTo([r, zc])
      .lineTo([r + c + EPS, top + EPS])
      .lineTo([0, top + EPS])
      .close()
      .sketchOnPlane("XZ")
      .revolve() as Shape3D;
  }
  const ring = kind === "hex" ? (g: number, z: number) => hexRing(x + 2 * g, z) : (g: number, z: number) => rectRing(x + 2 * g, y + 2 * g, z);
  return planarLoft([ring(0, z0), ring(0, zc), ring(c + EPS, top + EPS)]);
}

interface Opening {
  x: number;
  y: number;
  /** Size of the opening along X and Y. */
  x0: number;
  y0: number;
  chamfer: number;
}

/** Where the openings go inside an area of `ax` × `ay`, centred on the origin. */
function planOpenings(p: Params, ax: number, ay: number) {
  const kind = p.opening as string;
  const clearance = p.clearance as number;
  const gap = p.gap as number;
  const r2 = (n: number) => Math.round(n * 10) / 10;

  if (kind === "set") {
    // Different sizes: each hole is as wide as its item, neighbours keep the gap.
    const g = Math.max(gap, WEB);
    const chamfer = Math.max(0, Math.min(ENTRY, (g - WEB) / 2));
    const sizes = parseSizes(String(p.sizes), 0.5, 100);
    const { items, missing } = layoutSizes(ax, ay, sizes.map((s) => s + clearance), g);
    const holes: Opening[] = items.map((it) => ({ x: it.x, y: it.y, x0: it.size, y0: it.size, chamfer }));
    const facts = (depth: number): BuildInfo["facts"] =>
      holes.length ? [{ key: "fact.insertSet", vars: { n: holes.length, from: r2(sizes[0]), to: r2(sizes[holes.length - 1]), d: r2(depth) } }] : [];
    return { holes, missing: missing.map((m) => r2(m - clearance)), facts };
  }

  // Opening and the room each item takes, along X and Y.
  let ox = (p.size as number) + clearance;
  let oy = kind === "slot" ? (p.slotWidth as number) + clearance : kind === "hex" ? (ox * 2) / Math.sqrt(3) : ox;
  if (kind === "slot" && oy > ox) [ox, oy] = [oy, ox];
  // Items keep `gap` between them, the openings at least a web of material.
  const item = p.itemX as number;
  const footX = Math.max(ox, item + clearance);
  const footY = Math.max(oy, (kind === "slot" ? (p.itemY as number) : item) + clearance);
  const gapX = Math.max(gap, ox + WEB - footX);
  const gapY = Math.max(gap, oy + WEB - footY);

  // Slots may be turned by 90° if that fits more of them.
  const stagger = kind !== "slot" && p.stagger === true;
  let layout = layoutItems(ax, ay, footX, footY, stagger ? Math.max(gapX, gapY) : gapX, stagger, gapY);
  let turned = false;
  if (kind === "slot") {
    const alt = layoutItems(ax, ay, footY, footX, gapY, false, gapX);
    if (alt.centres.length > layout.centres.length) {
      layout = alt;
      turned = true;
    }
  }
  const [px, py] = layout.pitch;
  const [lx, ly] = turned ? [oy, ox] : [ox, oy];
  // The chamfer is kept smaller than the web, so the tools never touch.
  const across = stagger ? Math.max(lx, ly) : lx;
  const chamfer = Math.max(0, Math.min(ENTRY, (px - across - WEB) / 2, stagger ? Infinity : (py - ly - WEB) / 2));
  const holes: Opening[] = layout.centres.map(([x, y]) => ({ x, y, x0: lx, y0: ly, chamfer }));
  const facts = (depth: number): BuildInfo["facts"] => [
    { key: "fact.insertItems", vars: { n: holes.length, x: r2(px), y: r2(py) } },
    kind === "slot"
      ? { key: "fact.insertSlot", vars: { x: r2(ox), y: r2(oy), d: r2(depth) } }
      : { key: "fact.insertHole", vars: { x: r2(ox), d: r2(depth) } },
  ];
  return { holes, missing: [] as number[], facts };
}

export function buildInsert(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const kind = p.opening as string;
  const isBin = p.form === "bin";
  const floor = p.floor as number;
  const warnings: BuildInfo["warnings"] = [];

  // Outer size, and the free area the items have to stay inside.
  let w: number;
  let d: number;
  let inset: number;
  const gx = Math.round(p.gridX as number);
  const gy = Math.round(p.gridY as number);
  if (isBin) {
    w = gx * GRID - BIN_CLEARANCE;
    d = gy * GRID - BIN_CLEARANCE;
    // Items stick out above the block, so they must clear the stacking lip.
    inset = (p.lip === true ? LIP_INSET : 0) + EDGE;
  } else {
    w = p.width as number;
    d = p.length as number;
    inset = EDGE;
  }

  const plan = planOpenings(p, w - 2 * inset, d - 2 * inset);
  if (!plan.holes.length) throw new ParamError({ key: "err.insertNoFit" });
  if (plan.missing.length) warnings.push({ key: "warn.insertMissing", vars: { sizes: plan.missing.join(", ") } });

  // Height: the openings go down from the top face, the floor stays below.
  const base = isBin ? BIN_FOOT_HEIGHT : 0;
  let holeDepth = p.holeDepth as number;
  let surface: number;
  let unitsLabel = "";
  if (isBin) {
    const units = p.heightMode === "units" ? Math.round(p.heightUnits as number) : Math.max(2, Math.ceil((base + floor + holeDepth) / HEIGHT_UNIT));
    surface = units * HEIGHT_UNIT;
    unitsLabel = `${units}u`;
    if (surface - base - floor < holeDepth) {
      holeDepth = surface - base - floor;
      warnings.push({ key: "warn.insertShallow", vars: { depth: Math.round(holeDepth * 10) / 10 } });
    }
  } else {
    surface = floor + holeDepth;
  }
  const lip = isBin && p.lip === true;
  const top = surface + (lip ? LIP_HEIGHT : 0);

  // Solid block, rounded before the openings are cut (much cheaper).
  let shape: Shape3D;
  if (isBin) {
    const body = drawRoundedRectangle(w, d, BIN_RADIUS)
      .sketchOnPlane("XY", BIN_FOOT_HEIGHT - EPS)
      .extrude(top - BIN_FOOT_HEIGHT + EPS) as Shape3D;
    const footTool = foot();
    const cells = cellCentres(gx, gy);
    shape = body.fuse(makeCompound(cells.map(([x, y]) => footTool.clone().translate(x, y, 0))) as unknown as Shape3D);
    footTool.delete();
    if (lip) {
      // With the wall as thick as the lip there is no support slope; the
      // pocket floor is the top face of the block.
      shape = shape.cut(lipTool(w, d, LIP_INSET, top));
      shape = roundEdgesAt(shape, top, LIP_ROUND);
    } else {
      shape = roundEdgesAt(shape, top, TOP_ROUND);
    }
    const holes = footHoles(p, cells);
    if (holes) shape = shape.cut(holes);
  } else {
    const r = Math.min(LOOSE_RADIUS, w / 2 - 0.1, d / 2 - 0.1);
    shape = drawRoundedRectangle(w, d, r).sketchOnPlane("XY").extrude(top) as Shape3D;
    shape = chamferEdgesAt(shape, 0, LOOSE_CHAMFER);
    shape = roundEdgesAt(shape, top, TOP_ROUND);
  }

  // The openings, one tool per size.
  const protos = new Map<string, Shape3D>();
  const tools = plan.holes.map((h) => {
    const key = `${h.x0}/${h.y0}/${h.chamfer}`;
    let proto = protos.get(key);
    if (!proto) {
      proto = openingTool(kind === "set" ? "round" : kind, h.x0, h.y0, surface - holeDepth, surface, h.chamfer);
      protos.set(key, proto);
    }
    return proto.clone().translate(h.x, h.y, 0);
  });
  for (const t of protos.values()) t.delete();
  shape = shape.cut(makeCompound(tools) as unknown as Shape3D);

  // Corner at the origin, like bins and boxes.
  shape = shape.translate(w / 2, d / 2, 0);

  const r2 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [{ key: "fact.size", vars: { x: r2(w), y: r2(d), z: r2(top) } }, ...plan.facts(holeDepth)];
  const name = isBin ? `insert_${gx}x${gy}x${unitsLabel}` : `insert_${r2(w)}x${r2(d)}`;
  return {
    pieces: [{ name, shape, origin: [0, 0, 0], size: [w, d, top], grid: [0, 0] }],
    info: { size: [w, d, top], facts, warnings },
  };
}
