import { drawCircle, drawPolysides, drawRoundedRectangle, makeCompound, type Drawing, type Shape3D, type Sketch } from "replicad";
import type { BuiltPiece } from "../build-types";
import { compartmentTool } from "../bin/build";
import { ParamError, type BuildInfo, type Params } from "../types";

const EPS = 0.01;
/** Gap between the box and its lid in the preview and export. */
const LID_GAP = 10;
/** Dividers stop this far below whatever reaches into the opening (lid lip or stacked box). */
const DIVIDER_CLEARANCE = 0.5;
/** Wall of the lid's insert ring. */
const LID_RING_WALL = 1.2;
/** Largest bed the default printer (Bambu Lab P2S) offers. */
const BED = 256;

/** Outline of the box footprint, shrunk by `inset` mm, centred on the origin. */
type Outline = (inset: number) => Drawing;

function outlineFor(p: Params, w: number, d: number): Outline {
  if (p.shape === "round") return (i) => drawCircle(w / 2 - i);
  if (p.shape === "hex") {
    // `w` is the width across flats; drawPolysides takes the corner radius.
    return (i) => drawPolysides((w / 2 - i) / Math.cos(Math.PI / 6), 6);
  }
  const r = Math.min(p.cornerRadius as number, w / 2 - 0.01, d / 2 - 0.01);
  return (i) => drawRoundedRectangle(w - 2 * i, d - 2 * i, Math.max(0.2, r - i));
}

const extrude = (o: Drawing, z0: number, z1: number) => o.sketchOnPlane("XY", z0).extrude(z1 - z0) as Shape3D;

export function buildBox(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const rect = p.shape === "rect";
  const wall = p.wall as number;
  const clearance = p.clearance as number;
  const stackable = p.stackable === true;
  const stackDepth = p.stackDepth as number;
  const lid = p.lid === "lift";
  const inner = p.sizeMode === "inner";

  // The foot of a stackable box is inset by wall + clearance so it drops into
  // the opening of the box below, with a 45° chamfer back to the full outline.
  const footInset = wall + clearance;
  const floorZ = stackable ? Math.max(p.floor as number, stackDepth + footInset) : (p.floor as number);

  const grow = inner ? 2 * wall : 0;
  const w = (rect ? (p.width as number) : (p.diameter as number)) + grow;
  const d = (rect ? (p.depth as number) : (p.diameter as number)) + grow;
  const height = inner ? floorZ + (p.height as number) : (p.height as number);
  if (height - floorZ < 2) throw new ParamError({ key: "err.boxTooLow", vars: { min: Math.ceil(floorZ + 2) } });
  if (w - 2 * wall < 4 || d - 2 * wall < 4) throw new ParamError({ key: "err.boxTooSmall" });

  const outline = outlineFor(p, w, d);

  // Body.
  let shape: Shape3D;
  if (stackable) {
    const z1 = stackDepth;
    const z2 = stackDepth + footInset;
    const sk = (i: number, z: number) => outline(i).sketchOnPlane("XY", z) as Sketch;
    shape = sk(footInset, 0).loftWith([sk(footInset, z1), sk(0, z2), sk(0, height)], { ruled: true });
  } else {
    shape = extrude(outline(0), 0, height);
  }

  // Cavity: one per compartment for rectangles, a single one otherwise.
  const warnings: BuildInfo["warnings"] = [];
  const divX = rect ? Math.round(p.divX as number) : 1;
  const divY = rect ? Math.round(p.divY as number) : 1;
  const divided = divX > 1 || divY > 1;
  let compW = w - 2 * wall;
  let compD = d - 2 * wall;
  if (divided) {
    const divider = p.divider as number;
    const innerW = w - 2 * wall;
    const innerD = d - 2 * wall;
    compW = (innerW - (divX - 1) * divider) / divX;
    compD = (innerD - (divY - 1) * divider) / divY;
    if (compW < 3 || compD < 3) throw new ParamError({ key: "err.tooManyCompartments" });
    const r = Math.max(0.5, Math.min((p.cornerRadius as number) - wall, compW / 2 - 0.01, compD / 2 - 0.01));
    const tool = compartmentTool({ width: compW, depth: compD, radius: r, z0: floorZ, z1: height + EPS, scoop: 0, label: 0, labelTop: 0 });
    const tools: Shape3D[] = [];
    for (let i = 0; i < divX; i++) {
      for (let j = 0; j < divY; j++) {
        tools.push(tool.clone().translate(-innerW / 2 + compW / 2 + i * (compW + divider), -innerD / 2 + compD / 2 + j * (compD + divider), 0));
      }
    }
    tool.delete();
    shape = shape.cut(makeCompound(tools) as unknown as Shape3D);
    // Keep the dividers below anything that reaches into the opening.
    const reach = Math.max(stackable ? stackDepth : 0, lid ? (p.lidLip as number) : 0);
    if (reach > 0) shape = shape.cut(extrude(outline(wall), height - reach - DIVIDER_CLEARANCE, height + EPS));
  } else {
    shape = shape.cut(extrude(outline(wall), floorZ, height + EPS));
  }

  // Box with its footprint corner at the origin. Hexagons are wider across
  // the corners than across the flats, so use the real bounding box.
  const [[minX, minY], [maxX, maxY]] = shape.boundingBox.bounds;
  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  shape = shape.translate(-minX, -minY, 0);
  const pieces: BuiltPiece[] = [{ name: "box", shape, origin: [0, 0, 0], size: [sizeX, sizeY, height], grid: [0, 0] }];

  if (lid) {
    // Printed upside down: plate on the bed, insert ring pointing up.
    const t = p.lidThickness as number;
    const lip = p.lidLip as number;
    const ringOuter = footInset;
    const ringWall = Math.min(LID_RING_WALL, (Math.min(w, d) - 2 * ringOuter) / 2 - 1);
    let lidShape = extrude(outline(0), 0, t);
    if (ringWall > 0.4) {
      const ring = extrude(outline(ringOuter), t - EPS, t + lip).cut(extrude(outline(ringOuter + ringWall), t - 2 * EPS, t + lip + EPS));
      lidShape = lidShape.fuse(ring);
    }
    lidShape = lidShape.translate(sizeX + LID_GAP - minX, -minY, 0);
    pieces.push({ name: "lid", shape: lidShape, origin: [sizeX + LID_GAP, 0, 0], size: [sizeX, sizeY, t + lip], grid: [0, 0] });
  }

  if (sizeX > BED || sizeY > BED) warnings.push({ key: "warn.largerThanBed", vars: { size: BED } });
  if (height > BED) warnings.push({ key: "warn.tallerThanBed", vars: { size: BED } });

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [
    { key: "fact.outer", vars: { x: r1(sizeX), y: r1(sizeY), z: r1(height) } },
    { key: "fact.inner", vars: { x: r1(sizeX - 2 * wall), y: r1(sizeY - 2 * wall), z: r1(height - floorZ) } },
  ];
  if (divided) facts.push({ key: "fact.compartment", vars: { n: divX * divY, x: r1(compW), y: r1(compD), z: r1(height - floorZ) } });
  if (lid) facts.push({ key: "fact.withLid" });

  const label = rect ? `${r1(w)}x${r1(d)}x${r1(height)}` : `${p.shape}${r1(w)}x${r1(height)}`;
  pieces[0].name = `box_${label}`;
  if (pieces[1]) pieces[1].name = `box_${label}_lid`;
  return { pieces, info: { size: [sizeX, sizeY, height], facts, warnings } };
}
