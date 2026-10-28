// Desk organizer: a block whose top slopes up towards the back, with pockets
// in the top that take separately printed inlays (pen holes, a deep pocket,
// card slots, ...). Optional vertical ribs give the sides some texture.
import { draw, drawRoundedRectangle, makeBox, makeCompound, Plane, type Shape3D } from "replicad";
import { buildBox } from "../box/build";
import { boxSchema } from "../box/schema";
import type { BuiltPiece } from "../build-types";
import { chamferEdgesAt, roundEdgesIn } from "../edges";
import { buildInsert } from "../insert/build";
import { insertSchema, itemPresets } from "../insert/schema";
import { defaults, ParamError, sanitize, type BuildInfo, type Params } from "../types";
import { MAX_MODULES } from "./schema";

const EPS = 0.01;
/** Material kept under the deepest pocket. */
const MIN_FLOOR = 3;
const BED_CHAMFER = 0.4;
/** Rounded edges around the sloped top and the pockets. */
const TOP_ROUND = 1.5;
const POCKET_RADIUS = 3;
/** Ribs: groove depth and how far they stay from the bed and the top edge. */
const RIB_DEPTH = 1.2;
const RIB_MARGIN = 4;
/** Inlays: floor under their openings, walls of the open pocket inlay. */
const INLAY_FLOOR = 1.5;
const INLAY_WALL = 1.6;

/** Item presets used by the inlay kinds, with their usual hole depth (null: as deep as the inlay allows). */
const inlayItems: Record<string, { preset: Params; depth: number | null }> = {
  pens: { preset: itemPresets.pen, depth: null },
  cards: { preset: itemPresets.sd, depth: itemPresets.sd.holeDepth as number },
  usb: { preset: itemPresets.usba, depth: itemPresets.usba.holeDepth as number },
  bits: { preset: itemPresets.hexbit, depth: itemPresets.hexbit.holeDepth as number },
  holes: { preset: { opening: "round", size: 22, itemX: 22, gap: 4 }, depth: null },
};

/** Inlay for one module slot, flat on the bed with its corner at the origin. */
function buildInlay(kind: string, w: number, l: number, h: number, p: Params): Shape3D | null {
  const bed = { bedX: p.bedX, bedY: p.bedY };
  let shape: Shape3D;
  if (kind === "pocket") {
    const box = sanitize(boxSchema, { ...defaults(boxSchema), shape: "rect", sizeMode: "outer", width: w, depth: l, height: h, wall: INLAY_WALL, floor: INLAY_FLOOR, cornerRadius: POCKET_RADIUS, ...bed });
    shape = buildBox(box).pieces[0].shape;
  } else {
    const item = inlayItems[kind];
    if (!item) return null;
    const holeDepth = Math.min(item.depth ?? Infinity, h - INLAY_FLOOR);
    const insert = {
      ...sanitize(insertSchema, { ...defaults(insertSchema), ...item.preset, preset: "custom", form: "loose", width: w, length: l, cornerRadius: POCKET_RADIUS, sizeLabels: false, ...bed }),
      holeDepth,
      // The inlay is as high as its pocket; whatever the holes leave is floor.
      floor: h - holeDepth,
    };
    shape = buildInsert(insert).pieces[0].shape;
  }
  const [[x0, y0, z0]] = shape.boundingBox.bounds;
  return shape.translate(-x0, -y0, -z0);
}

export function buildDesk(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const W = p.width as number;
  const D = p.depth as number;
  const Hf = p.frontHeight as number;
  const a = ((p.angle as number) * Math.PI) / 180;
  const [sa, ca] = [Math.sin(a), Math.cos(a)];
  const Hb = Hf + D * Math.tan(a);
  const rim = p.rim as number;
  const web = p.web as number;
  const cols = Math.round(p.cols as number);
  const rows = Math.round(p.rows as number);
  const clearance = p.clearance as number;
  const radius = Math.min(p.cornerRadius as number, W / 2 - 1, D / 2 - 1);
  const warnings: BuildInfo["warnings"] = [];

  // Pockets stand at right angles to the sloped top. They must keep a floor
  // above the bed at the front and a wall at the back.
  let pd = p.pocketDepth as number;
  const vMin = rim;
  const maxDepth = (Hf + vMin * sa - MIN_FLOOR) / ca;
  if (pd > maxDepth) {
    pd = Math.floor(maxDepth);
    warnings.push({ key: "warn.deskShallow", vars: { d: pd } });
  }
  const vMax = (D - rim - pd * sa) / ca;
  const modW = (W - 2 * rim - (cols - 1) * web) / cols;
  const modL = (vMax - vMin - (rows - 1) * web) / rows;
  if (pd < 8 || modW < 15 || modL < 15) throw new ParamError({ key: "err.deskTooSmall" });

  // Body: the side profile, cut to a rounded footprint.
  const side = draw([0, 0]).lineTo([D, 0]).lineTo([D, Hb]).lineTo([0, Hf]).close().sketchOnPlane("YZ").extrude(W) as Shape3D;
  const footprint = drawRoundedRectangle(W, D, radius).translate(W / 2, D / 2).sketchOnPlane("XY", -EPS).extrude(Hb + 1) as Shape3D;
  let body = side.intersect(footprint);
  body = chamferEdgesAt(body, 0, BED_CHAMFER);

  // Ribs: vertical grooves on all four sides, clear of the rounded corners.
  if (p.ribs === true) {
    const pitch = p.ribPitch as number;
    const groove = pitch / 2;
    const grooves: Shape3D[] = [];
    const along = (len: number) => {
      const n = Math.floor((len - 2 * radius - groove) / pitch) + 1;
      if (n < 1) return [];
      const start = (len - (n - 1) * pitch) / 2;
      return Array.from({ length: n }, (_, i) => start + i * pitch);
    };
    const z0 = RIB_MARGIN;
    for (const x of along(W)) {
      grooves.push(makeBox([x - groove / 2, -1, z0], [x + groove / 2, RIB_DEPTH, Hf - RIB_MARGIN]));
      grooves.push(makeBox([x - groove / 2, D - RIB_DEPTH, z0], [x + groove / 2, D + 1, Hb - RIB_MARGIN]));
    }
    for (const y of along(D)) {
      const zTop = Hf + (y - groove / 2) * Math.tan(a) - RIB_MARGIN;
      grooves.push(makeBox([-1, y - groove / 2, z0], [RIB_DEPTH, y + groove / 2, zTop]));
      grooves.push(makeBox([W - RIB_DEPTH, y - groove / 2, z0], [W + 1, y + groove / 2, zTop]));
    }
    if (grooves.length) body = body.cut(makeCompound(grooves) as unknown as Shape3D);
  }

  // Module slots, back row first, each row from left to right.
  const toWorld = (shape: Shape3D) => shape.rotate((a * 180) / Math.PI, [0, 0, 0], [1, 0, 0]).translate(0, 0, Hf);
  const slots: { u: number; v: number; kind: string; n: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c;
      if (n >= MAX_MODULES) break;
      slots.push({ u: rim + modW / 2 + c * (modW + web), v: vMax - modL / 2 - r * (modL + web), kind: String(p[`module${n + 1}`]), n: n + 1 });
    }
  }
  const pocket = drawRoundedRectangle(modW, modL, POCKET_RADIUS).sketchOnPlane("XY", -pd).extrude(pd + 5) as Shape3D;
  const tools = slots.map((s) => toWorld(pocket.clone().translate(s.u, s.v, 0)));
  pocket.delete();
  body = body.cut(makeCompound(tools) as unknown as Shape3D);
  // Round the edges of the top: around the outside and the pockets.
  body = roundEdgesIn(body, new Plane([0, 0, Hf], [1, 0, 0], [0, -sa, ca]), TOP_ROUND);

  const pieces: BuiltPiece[] = [{ name: "desk", shape: body, origin: [0, 0, 0], size: [W, D, Hb], grid: [0, 0] }];

  // Inlays, a little smaller than their pocket. In the assembled view they sit in it.
  const iw = modW - 2 * clearance;
  const il = modL - 2 * clearance;
  for (const s of slots) {
    const inlay = buildInlay(s.kind, iw, il, pd, p);
    if (!inlay) continue;
    // Corner of the inlay in the top's own frame, then turned like the top.
    const [lx, ly, lz] = [s.u - iw / 2, s.v - il / 2, -pd];
    pieces.push({
      name: `desk_inlay_${s.n}_${s.kind}`,
      shape: inlay,
      origin: [0, 0, 0],
      size: [iw, il, pd],
      grid: [0, 0],
      placement: { offset: [lx, ly * ca - lz * sa, Hf + ly * sa + lz * ca], rotX: a },
    });
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [
    { key: "fact.size", vars: { x: r1(W), y: r1(D), z: r1(Hb) } },
    { key: "fact.deskModules", vars: { n: slots.length, x: r1(modW), y: r1(modL), d: r1(pd) } },
  ];
  return { pieces, info: { size: [W, D, Hb], facts, warnings } };
}
