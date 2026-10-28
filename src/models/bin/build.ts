import { draw, drawRoundedRectangle, makeBox, makeCompound, makeCylinder, sketchCircle, sketchRoundedRectangle, type Shape3D, type Sketch } from "replicad";
import { roundEdgesAt } from "../edges";
import { HONEYCOMB_WEB, honeycombTool } from "../honeycomb";
import { engrave, type TextItem } from "../text";
import {
  BIN_CLEARANCE,
  BIN_FOOT,
  BIN_FOOT_HEIGHT,
  BIN_FOOT_INSET,
  BIN_RADIUS,
  GRID,
  HEIGHT_UNIT,
  HOLE_OFFSET,
  LIP,
  LIP_HEIGHT,
  LIP_INSET,
} from "../gridfinity";
import type { BuiltPiece } from "../build-types";
import { ParamError, type BuildInfo, type Params } from "../types";

const EPS = 0.01;
const SCREW_DIAMETER = 3;
const SCREW_DEPTH = 6;
/** Width of the flat top of the stacking lip before rounding. */
const LIP_RIDGE = 1;
/** Radius of the rounded lip top edges. */
export const LIP_ROUND = 0.45;

/** Rounded rectangle section, `inset` mm inside the bin outline, at height `z`. */
function section(w: number, d: number, inset: number, z: number) {
  const r = Math.max(0.2, BIN_RADIUS - inset);
  return sketchRoundedRectangle(w - 2 * inset, d - 2 * inset, r, { plane: "XY", origin: z });
}

/** One Gridfinity foot, centred on the origin, slightly taller so it fuses into the body. */
export function foot(): Shape3D {
  const top = GRID - BIN_CLEARANCE;
  const s = (inset: number, z: number) => section(top, top, inset, z);
  const z1 = BIN_FOOT.bottomChamfer;
  const z2 = z1 + BIN_FOOT.vertical;
  const innerInset = BIN_FOOT.topChamfer;
  return s(BIN_FOOT_INSET, 0).loftWith(
    [s(innerInset, z1), s(innerInset, z2), s(0, BIN_FOOT_HEIGHT), s(0, BIN_FOOT_HEIGHT + EPS)],
    { ruled: true },
  );
}

/**
 * Tool that removes the stacking-lip pocket and the 45° support below it. It
 * spans the whole bin, so it also trims the divider tops below the lip.
 */
export function lipTool(w: number, d: number, wall: number, top: number, below = 0): Shape3D {
  const support = Math.max(0, LIP_INSET - wall);
  const zLip = top - LIP_HEIGHT;
  const zChamfer = zLip + LIP.bottomChamfer + LIP.vertical;
  // The upper chamfer stops short of the outer wall and leaves a flat ridge,
  // which is then rounded off (a knife edge would be sharp and fragile).
  const sections = [
    section(w, d, LIP_INSET, zLip),
    section(w, d, LIP.topChamfer, zLip + LIP.bottomChamfer),
    section(w, d, LIP.topChamfer, zChamfer),
    section(w, d, LIP_RIDGE, zChamfer + LIP.topChamfer - LIP_RIDGE),
    section(w, d, LIP_RIDGE, top + EPS),
  ];
  const base = support > 0 ? [section(w, d, wall, zLip - support)] : [section(w, d, LIP_INSET, zLip - EPS)];
  // Optionally reach `below` mm further down at the inner wall, to trim the dividers.
  if (below > 0) base.unshift(section(w, d, wall, zLip - support - below));
  const [start, ...rest] = base;
  return start.loftWith([...rest, ...sections], { ruled: true });
}

/** Radius of the rounded top edges of walls and dividers. */
const EDGE_ROUND = 0.5;
/** Below a stacking lip, dividers end this far under the lip support. */
const DIVIDER_DROP = 0.5;
/** Without a lip, the label shelf ends this far below the rim. */
const LABEL_DROP = 1;
/** Text on the label shelf: largest cap height and distance to its edges. */
const LABEL_CAP = 5;
const LABEL_MARGIN_FRONT = 1.5;
const LABEL_MARGIN_BACK = 0.8;
/** 45° chamfer around magnet holes, makes pressing magnets in easier. */
const MAGNET_CHAMFER = 0.3;

export interface CompartmentOptions {
  width: number;
  depth: number;
  radius: number;
  z0: number;
  z1: number;
  scoop: number;
  label: number;
  labelTop: number;
  /**
   * Round the tops of the dividers: on the sides that face a divider the
   * cavity widens in a quarter circle of `radius` up to `z`, meeting the
   * neighbour's cavity on the divider midline, so the divider ends in a
   * half-round. `z1` is ignored then; whatever sits above `z` must be cut away
   * separately. Sides facing an outer wall stay straight.
   */
  flare?: { left: boolean; right: boolean; front: boolean; back: boolean; radius: number; z: number };
}

/** Steps used to approximate the rounded divider tops. */
const FLARE_STEPS = 2;

/** Cavity of one compartment, minus the material for scoop and label shelf. */
export function compartmentTool(o: CompartmentOptions): Shape3D {
  let tool: Shape3D;
  const f = o.flare;
  if (f) {
    const at = (g: number, z: number) => {
      const [l, r, fr, b] = [f.left, f.right, f.front, f.back].map((side) => (side ? g : 0));
      return drawRoundedRectangle(o.width + l + r, o.depth + fr + b, o.radius)
        .translate((r - l) / 2, (b - fr) / 2)
        .sketchOnPlane("XY", z) as Sketch;
    };
    const zArc = f.z - f.radius;
    const sections = [at(0, zArc)];
    // The last arc step ends EPS above `z`: a section exactly in the plane of
    // the next cut would make that cut fail.
    for (let k = 1; k < FLARE_STEPS; k++) {
      const a = (Math.PI / 2) * (k / FLARE_STEPS);
      sections.push(at(f.radius * (1 - Math.cos(a)), zArc + f.radius * Math.sin(a)));
    }
    sections.push(at(f.radius, f.z + EPS));
    tool = at(0, o.z0).loftWith(sections, { ruled: true });
  } else {
    tool = drawRoundedRectangle(o.width, o.depth, o.radius).sketchOnPlane("XY", o.z0).extrude(o.z1 - o.z0) as Shape3D;
  }
  const fill = compartmentFill(o);
  if (fill) tool = tool.cut(fill);
  return tool;
}

/**
 * Material left in a compartment for the finger scoop and the label
 * shelf, centred like the compartment.
 */
function compartmentFill(o: CompartmentOptions): Shape3D | null {
  const len = o.width + 2 * EPS;
  const x0 = -o.width / 2 - EPS;
  const parts: Shape3D[] = [];
  if (o.scoop > 0) {
    // A block in the front-bottom edge with a cylinder taken out leaves a
    // concave ramp, so parts can be slid out with a finger.
    const r = o.scoop;
    const yFront = -o.depth / 2;
    const block = makeBox([x0, yFront - EPS, o.z0 - EPS], [x0 + len, yFront + r, o.z0 + r]);
    const round = makeCylinder(r, len + 2 * EPS, [x0 - EPS, yFront + r, o.z0 + r], [1, 0, 0]);
    parts.push(block.cut(round));
  }
  if (o.label > 0) {
    // 45° shelf along the back wall; its top is where the label goes.
    const yBack = o.depth / 2 + EPS;
    const d = o.label;
    parts.push(
      draw([yBack, o.labelTop])
        .lineTo([yBack - d, o.labelTop])
        .lineTo([yBack, o.labelTop - d])
        .close()
        .sketchOnPlane("YZ", x0)
        .extrude(len) as Shape3D,
    );
  }
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : parts[0].fuse(parts[1]);
}

/**
 * Magnet and screw holes in the feet, as one compound. One tool per position
 * (magnet pocket and screw hole fused), so the copies never overlap.
 */
export function footHoles(p: Params, cellCenters: [number, number][]): Shape3D | null {
  let holeTool: Shape3D | null = null;
  if (p.magnets === true) {
    const r = (p.magnetDiameter as number) / 2;
    const rim = sketchCircle(r + MAGNET_CHAMFER + EPS, { plane: "XY", origin: -EPS }).loftWith(sketchCircle(r, { plane: "XY", origin: MAGNET_CHAMFER }));
    holeTool = makeCylinder(r, (p.magnetDepth as number) + EPS, [0, 0, -EPS]).fuse(rim);
  }
  if (p.screws === true) {
    const screw = makeCylinder(SCREW_DIAMETER / 2, SCREW_DEPTH + EPS, [0, 0, -EPS]);
    holeTool = holeTool ? holeTool.fuse(screw) : screw;
  }
  if (!holeTool) return null;
  const holes: Shape3D[] = [];
  for (const [cx, cy] of cellCenters) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      holes.push(holeTool.clone().translate(cx + dx * HOLE_OFFSET, cy + dy * HOLE_OFFSET, 0));
    }
  }
  holeTool.delete();
  return makeCompound(holes) as unknown as Shape3D;
}

/** Centres of the grid cells of a gx × gy bin centred on the origin. */
export function cellCentres(gx: number, gy: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) out.push([(i - (gx - 1) / 2) * GRID, (j - (gy - 1) / 2) * GRID]);
  return out;
}

export function buildBin(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const gx = Math.round(p.gridX as number);
  const gy = Math.round(p.gridY as number);
  const w = gx * GRID - BIN_CLEARANCE;
  const d = gy * GRID - BIN_CLEARANCE;
  const height = p.heightMode === "mm" ? (p.heightMm as number) : (p.heightUnits as number) * HEIGHT_UNIT;
  const lip = p.lip === true;
  const top = height + (lip ? LIP_HEIGHT : 0);
  const wall = p.wall as number;
  const divider = p.divider as number;
  const floorZ = BIN_FOOT_HEIGHT + (p.floor as number);
  const divX = Math.round(p.divX as number);
  const divY = Math.round(p.divY as number);

  // Compartments stop below the lip support, the lip tool takes it from there.
  const cavityTop = lip ? height - Math.max(0, LIP_INSET - wall) : height;
  if (cavityTop - floorZ < 2) throw new ParamError({ key: "err.binTooLow", vars: { min: Math.ceil(floorZ + 2 + (height - cavityTop)) } });

  const innerW = w - 2 * wall;
  const innerD = d - 2 * wall;
  const cw = (innerW - (divX - 1) * divider) / divX;
  const cd = (innerD - (divY - 1) * divider) / divY;
  if (cw < 3 || cd < 3) throw new ParamError({ key: "err.tooManyCompartments" });

  const warnings: BuildInfo["warnings"] = [];
  const labelDepth = p.label === true ? Math.min(p.labelDepth as number, cd * 0.6) : 0;
  if (p.label === true && labelDepth < (p.labelDepth as number)) warnings.push({ key: "warn.labelShrunk" });
  const scoop = p.scoop === true ? Math.max(0, Math.min(cd * 0.35, (cavityTop - floorZ) * 0.6, 18)) : 0;

  // Body plus feet.
  const body = drawRoundedRectangle(w, d, BIN_RADIUS)
    .sketchOnPlane("XY", BIN_FOOT_HEIGHT - EPS)
    .extrude(top - BIN_FOOT_HEIGHT + EPS) as Shape3D;
  const footTool = foot();
  const cellCenters = cellCentres(gx, gy);
  let shape = body.fuse(makeCompound(cellCenters.map(([x, y]) => footTool.clone().translate(x, y, 0))) as unknown as Shape3D);
  footTool.delete();

  // Compartments. Below a stacking lip the dividers stop a little under the
  // lip support and end in a half-round; without a lip they reach the top and
  // are rounded together with the walls.
  const divided = divX > 1 || divY > 1;
  const zDiv = cavityTop - DIVIDER_DROP;
  const flared = lip && divided;
  const compRadius = Math.max(0.5, Math.min(BIN_RADIUS - wall, cw / 2 - 0.01, cd / 2 - 0.01));
  const labelTop = flared ? zDiv - divider / 2 - 0.2 : lip ? cavityTop : cavityTop - LABEL_DROP;

  // The lip goes first and its ridge is rounded while the shape is still
  // simple; that is several times faster than doing it after the compartments.
  if (lip) {
    shape = shape.cut(lipTool(w, d, wall, top, flared ? DIVIDER_DROP : 0));
    shape = roundEdgesAt(shape, top, LIP_ROUND);
  }
  const opts = {
    width: cw,
    depth: cd,
    radius: compRadius,
    z0: floorZ,
    z1: cavityTop + EPS,
    scoop,
    label: labelDepth,
    // Without a lip the shelf stays below the rim, so the rim can be rounded.
    labelTop,
  };
  const tools = new Map<string, Shape3D>();
  const comps: Shape3D[] = [];
  for (let i = 0; i < divX; i++) {
    for (let j = 0; j < divY; j++) {
      const sides = { left: i > 0, right: i < divX - 1, front: j > 0, back: j < divY - 1 };
      const key = flared ? Object.values(sides).join() : "";
      let tool = tools.get(key);
      if (!tool) {
        tool = compartmentTool({ ...opts, flare: flared ? { ...sides, radius: divider / 2, z: zDiv } : undefined });
        tools.set(key, tool);
      }
      const x = -innerW / 2 + cw / 2 + i * (cw + divider);
      const y = -innerD / 2 + cd / 2 + j * (cd + divider);
      comps.push(tool.clone().translate(x, y, 0));
    }
  }
  for (const t of tools.values()) t.delete();
  shape = shape.cut(makeCompound(comps) as unknown as Shape3D);

  // Without a lip, round the wall and divider tops.
  if (!lip) shape = roundEdgesAt(shape, top, Math.min(EDGE_ROUND, wall / 2 - 0.1, divider / 2 - 0.1));

  // Text on the label shelves, one per compartment: back row first, each
  // row from left to right, as seen from the front.
  let labels: Shape3D | undefined;
  if (labelDepth > 0) {
    const names = String(p.labelText ?? "").split(";");
    const texts: TextItem[] = [];
    for (let j = divY - 1, n = 0; j >= 0; j--) {
      for (let i = 0; i < divX; i++, n++) {
        const text = names[n]?.trim();
        if (!text) continue;
        const x = -innerW / 2 + cw / 2 + i * (cw + divider);
        const yBack = -innerD / 2 + (j + 1) * cd + j * divider;
        // The shelf thins out towards its front edge, so the text keeps away from it.
        const room = labelDepth - LABEL_MARGIN_FRONT - LABEL_MARGIN_BACK;
        texts.push({ text, x, y: yBack - LABEL_MARGIN_BACK - room / 2, z: labelTop, maxW: cw - 2 * (compRadius + 0.5), cap: Math.min(LABEL_CAP, room * 0.7) });
      }
    }
    const engraved = engrave(shape, texts);
    shape = engraved.shape;
    labels = engraved.labels;
    if (engraved.skipped.length) warnings.push({ key: "warn.labelSkipped", vars: { texts: engraved.skipped.join(", ") } });
  }

  // Honeycomb openings in the outer walls. They come last: the lip cut and
  // the roundings get many times slower on a perforated body. They stay
  // clear of the floor, scoop, label shelf, rim and dividers.
  let honeycombCount = 0;
  if (p.honeycomb === true) {
    const web = HONEYCOMB_WEB;
    const { tool, count } = honeycombTool({
      width: w,
      depth: d,
      wall,
      z0: floorZ + web + scoop,
      z1: Math.min(lip ? zDiv : top, labelDepth > 0 ? labelTop - labelDepth : Infinity) - web - 0.5,
      cell: p.honeycombSize as number,
      cornerMargin: Math.max(BIN_RADIUS, wall + compRadius) + web,
      dividersX: Array.from({ length: divX - 1 }, (_, i) => -innerW / 2 + (i + 1) * cw + (i + 0.5) * divider),
      dividersY: Array.from({ length: divY - 1 }, (_, i) => -innerD / 2 + (i + 1) * cd + (i + 0.5) * divider),
      dividerMargin: divider / 2 + compRadius + web,
    });
    if (tool) shape = shape.cut(tool);
    honeycombCount = count;
  }

  const holes = footHoles(p, cellCenters);
  if (holes) shape = shape.cut(holes);

  // Place the bin with its corner at the origin, like the baseplate.
  shape = shape.translate(w / 2, d / 2, 0);
  labels = labels?.translate(w / 2, d / 2, 0);

  const heightLabel = p.heightMode === "mm" ? `${height}mm` : `${p.heightUnits}u`;
  const r2 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [
    { key: "fact.size", vars: { x: r2(w), y: r2(d), z: r2(top) } },
    { key: "fact.compartment", vars: { n: divX * divY, x: r2(cw), y: r2(cd), z: r2(cavityTop - floorZ) } },
  ];
  if (p.honeycomb === true) {
    if (honeycombCount) facts.push({ key: "fact.honeycomb", vars: { n: honeycombCount } });
    else warnings.push({ key: "warn.honeycombNone" });
  }
  return {
    pieces: [{ name: `bin_${gx}x${gy}x${heightLabel}`, shape, labels, origin: [0, 0, 0], size: [w, d, top], grid: [0, 0] }],
    info: { size: [w, d, top], facts, warnings },
  };
}
