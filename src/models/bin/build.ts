import { draw, drawRoundedRectangle, makeBox, makeCompound, makeCylinder, sketchRoundedRectangle, type Shape3D } from "replicad";
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

/** Rounded rectangle section, `inset` mm inside the bin outline, at height `z`. */
function section(w: number, d: number, inset: number, z: number) {
  const r = Math.max(0.2, BIN_RADIUS - inset);
  return sketchRoundedRectangle(w - 2 * inset, d - 2 * inset, r, { plane: "XY", origin: z });
}

/** One Gridfinity foot, centred on the origin, slightly taller so it fuses into the body. */
function foot(): Shape3D {
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
function lipTool(w: number, d: number, wall: number, top: number): Shape3D {
  const support = Math.max(0, LIP_INSET - wall);
  const zLip = top - LIP_HEIGHT;
  const sections = [
    section(w, d, LIP_INSET, zLip),
    section(w, d, LIP.topChamfer, zLip + LIP.bottomChamfer),
    section(w, d, LIP.topChamfer, zLip + LIP.bottomChamfer + LIP.vertical),
    section(w, d, 0, top + EPS),
  ];
  const start = support > 0 ? section(w, d, wall, zLip - support) : section(w, d, LIP_INSET, zLip - EPS);
  return start.loftWith(sections, { ruled: true });
}

interface CompartmentOptions {
  width: number;
  depth: number;
  radius: number;
  z0: number;
  z1: number;
  scoop: number;
  label: number;
  labelTop: number;
}

/** Cavity of one compartment, minus the material for scoop and label shelf. */
function compartmentTool(o: CompartmentOptions): Shape3D {
  let tool: Shape3D = drawRoundedRectangle(o.width, o.depth, o.radius).sketchOnPlane("XY", o.z0).extrude(o.z1 - o.z0) as Shape3D;
  const len = o.width + 2 * EPS;
  const x0 = -o.width / 2 - EPS;
  if (o.scoop > 0) {
    // A block in the front-bottom edge with a cylinder taken out leaves a
    // concave ramp, so parts can be slid out with a finger.
    const r = o.scoop;
    const yFront = -o.depth / 2;
    const block = makeBox([x0, yFront - EPS, o.z0 - EPS], [x0 + len, yFront + r, o.z0 + r]);
    const round = makeCylinder(r, len + 2 * EPS, [x0 - EPS, yFront + r, o.z0 + r], [1, 0, 0]);
    tool = tool.cut(block.cut(round));
  }
  if (o.label > 0) {
    // 45° shelf along the back wall; its top is where the label goes.
    const yBack = o.depth / 2 + EPS;
    const d = o.label;
    const prism = draw([yBack, o.labelTop])
      .lineTo([yBack - d, o.labelTop])
      .lineTo([yBack, o.labelTop - d])
      .close()
      .sketchOnPlane("YZ", x0)
      .extrude(len) as Shape3D;
    tool = tool.cut(prism);
  }
  return tool;
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
  const cellCenters: [number, number][] = [];
  for (let i = 0; i < gx; i++) for (let j = 0; j < gy; j++) cellCenters.push([(i - (gx - 1) / 2) * GRID, (j - (gy - 1) / 2) * GRID]);
  let shape = body.fuse(makeCompound(cellCenters.map(([x, y]) => footTool.clone().translate(x, y, 0))) as unknown as Shape3D);
  footTool.delete();

  // Compartments.
  const comp = compartmentTool({
    width: cw,
    depth: cd,
    radius: Math.max(0.5, Math.min(BIN_RADIUS - wall, cw / 2 - 0.01, cd / 2 - 0.01)),
    z0: floorZ,
    z1: cavityTop + EPS,
    scoop,
    label: labelDepth,
    labelTop: cavityTop,
  });
  const comps: Shape3D[] = [];
  for (let i = 0; i < divX; i++) {
    for (let j = 0; j < divY; j++) {
      const x = -innerW / 2 + cw / 2 + i * (cw + divider);
      const y = -innerD / 2 + cd / 2 + j * (cd + divider);
      comps.push(comp.clone().translate(x, y, 0));
    }
  }
  comp.delete();
  shape = shape.cut(makeCompound(comps) as unknown as Shape3D);

  if (lip) shape = shape.cut(lipTool(w, d, wall, top));

  // Magnet and screw holes in the feet. One tool per position (magnet pocket
  // and screw hole fused), so the copies in the compound never overlap.
  let holeTool: Shape3D | null = null;
  if (p.magnets === true) {
    holeTool = makeCylinder((p.magnetDiameter as number) / 2, (p.magnetDepth as number) + EPS, [0, 0, -EPS]);
  }
  if (p.screws === true) {
    const screw = makeCylinder(SCREW_DIAMETER / 2, SCREW_DEPTH + EPS, [0, 0, -EPS]);
    holeTool = holeTool ? holeTool.fuse(screw) : screw;
  }
  const holes: Shape3D[] = [];
  if (holeTool) {
    for (const [cx, cy] of cellCenters) {
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        holes.push(holeTool.clone().translate(cx + dx * HOLE_OFFSET, cy + dy * HOLE_OFFSET, 0));
      }
    }
    holeTool.delete();
  }
  if (holes.length) shape = shape.cut(makeCompound(holes) as unknown as Shape3D);

  // Place the bin with its corner at the origin, like the baseplate.
  shape = shape.translate(w / 2, d / 2, 0);

  const heightLabel = p.heightMode === "mm" ? `${height}mm` : `${p.heightUnits}u`;
  const r2 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [
    { key: "fact.size", vars: { x: r2(w), y: r2(d), z: r2(top) } },
    { key: "fact.compartment", vars: { n: divX * divY, x: r2(cw), y: r2(cd), z: r2(cavityTop - floorZ) } },
  ];
  return {
    pieces: [{ name: `bin_${gx}x${gy}x${heightLabel}`, shape, origin: [0, 0, 0], size: [w, d, top], grid: [0, 0] }],
    info: { size: [w, d, top], facts, warnings },
  };
}
