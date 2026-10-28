// Desk organizer: a block whose top slopes up towards the back, with upright
// pockets that take separately printed inlays (pen holes, an open pocket,
// card slots, ...). Pens and pockets go as deep as the block allows. The
// outside walls can carry a pattern, and the block is hollow under the
// shallow modules. Every face inside and out is printable without supports:
// downward faces are at least 45° steep.
import { draw, drawRoundedRectangle, makeCompound, Plane, type Shape3D } from "replicad";

type Vec = [number, number, number];
import { buildBox } from "../box/build";
import { boxSchema } from "../box/schema";
import type { BuiltPiece } from "../build-types";
import { chamferEdgesAt, roundEdgesIn } from "../edges";
import { buildInsert } from "../insert/build";
import { insertSchema, itemPresets } from "../insert/schema";
import { cutSlope } from "../slope";
import { defaults, ParamError, sanitize, type BuildInfo, type Params } from "../types";
import { deepKinds, MAX_MODULES } from "./schema";

const EPS = 0.01;
/** Material kept under the pockets and the hollows. */
const MIN_FLOOR = 3;
const BED_CHAMFER = 0.4;
/** Rounded edges around the sloped top and the pockets. */
const TOP_ROUND = 1.5;
const POCKET_RADIUS = 3;
/** Pattern on the walls: depth, and how far it stays from the bed and the top edge. */
const PATTERN_DEPTH = 1.2;
const PATTERN_MARGIN = 4;
const MAX_PATTERN = 180;
/** Inlays: floor under their openings, walls of the open pocket inlay, rounded top edges. */
const INLAY_FLOOR = 1.5;
const INLAY_WALL = 1.6;
const INLAY_ROUND = 0.6;
/** Pockets for small items are at least this deep, so their inlays sit firmly. */
const SHALLOW_MIN = 20;
/** The flat open pocket. */
const TRAY_DEPTH = 20;
/** Material between a shallow pocket and the hollow under it. */
const HOLLOW_ROOF = 2.4;
/** Hollows lower than this are left solid. */
const HOLLOW_MIN = 6;

/** Item presets used by the inlay kinds; null depth: the openings go down to the inlay's floor. */
const inlayItems: Record<string, { preset: Params; depth: number | null }> = {
  // Wide enough for ballpoint pens with a clip.
  pens: { preset: { opening: "round", size: 15, itemX: 15, gap: 4 }, depth: null },
  cards: { preset: itemPresets.sd, depth: itemPresets.sd.holeDepth as number },
  usb: { preset: itemPresets.usba, depth: itemPresets.usba.holeDepth as number },
  usbsd: { preset: { opening: "usbsd" }, depth: Math.max(itemPresets.usba.holeDepth as number, itemPresets.sd.holeDepth as number) },
  bits: { preset: itemPresets.hexbit, depth: itemPresets.hexbit.holeDepth as number },
  holes: { preset: { opening: "round", size: 22, itemX: 22, gap: 4 }, depth: null },
};

/** Pocket depth the kind wants (deep kinds: the depth field). */
function wantedDepth(kind: string, deep: number): number {
  if (deepKinds.includes(kind)) return deep;
  if (kind === "tray") return TRAY_DEPTH;
  return Math.max(SHALLOW_MIN, (inlayItems[kind]?.depth ?? 0) + INLAY_FLOOR + 2);
}

/**
 * Inlay for one module, `w` × `l`, `h` high at the front and rising by
 * `slope` towards the back like the organizer's top. Flat on the bed with
 * its corner at the origin.
 */
function buildInlay(kind: string, w: number, l: number, h: number, slope: number, p: Params): Shape3D | null {
  const bed = { bedX: p.bedX, bedY: p.bedY };
  let shape: Shape3D;
  if (kind === "pocket" || kind === "tray") {
    // An open box, cut along the slope.
    const height = h + l * slope + 2;
    const box = sanitize(boxSchema, { ...defaults(boxSchema), shape: "rect", sizeMode: "outer", width: w, depth: l, height, wall: INLAY_WALL, floor: INLAY_FLOOR, cornerRadius: POCKET_RADIUS, ...bed });
    const raw = buildBox(box).pieces[0].shape;
    const [[x0, y0, z0]] = raw.boundingBox.bounds;
    shape = cutSlope(raw.translate(-x0 - w / 2, -y0 - l / 2, -z0), w, l, h, slope, INLAY_ROUND);
  } else {
    const item = inlayItems[kind];
    if (!item) return null;
    const holeDepth = Math.min(item.depth ?? Infinity, h - INLAY_FLOOR);
    const insert = {
      ...sanitize(insertSchema, { ...defaults(insertSchema), ...item.preset, preset: "custom", form: "loose", width: w, length: l, cornerRadius: POCKET_RADIUS, sizeLabels: false, ...bed }),
      holeDepth,
      // The inlay is as high as its pocket; whatever the openings leave is floor.
      floor: h - holeDepth,
      topSlope: slope,
    };
    shape = buildInsert(insert).pieces[0].shape;
  }
  const [[x0, y0, z0]] = shape.boundingBox.bounds;
  return shape.translate(-x0, -y0, -z0);
}

/** One outside wall: where it starts, which way it runs and faces, and the height of its top edge. */
interface Wall {
  origin: Vec;
  along: Vec;
  out: Vec;
  length: number;
  top: (s: number) => number;
}

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Outline in wall coordinates (s along the wall, t up), cut `depth` into the wall. */
function recess(wall: Wall, outline: [number, number][]): Shape3D {
  const plane = new Plane(add(wall.origin, wall.out, -PATTERN_DEPTH), wall.along, wall.out);
  const [first, ...rest] = outline;
  let d = draw(first);
  for (const pt of rest) d = d.lineTo(pt);
  return d.close().sketchOnPlane(plane).extrude(PATTERN_DEPTH + 1) as Shape3D;
}

/**
 * The tools that cut the pattern into one wall, kept clear of the rounded
 * corners. Every recess closes at its top with edges at least 45° steep.
 */
function patternTools(wall: Wall, kind: string, pitch: number, corner: number): Shape3D[] {
  const s0 = corner + 1;
  const s1 = wall.length - corner - 1;
  if (s1 - s0 < pitch) return [];
  const z0 = PATTERN_MARGIN;
  const topAt = (a: number, b: number) => Math.min(wall.top(a), wall.top(b)) - PATTERN_MARGIN;
  const tools: Shape3D[] = [];
  // Evenly spaced positions between s0 and s1 for items `w` wide.
  const spread = (w: number, step: number) => {
    const n = Math.floor((s1 - s0 - w) / step) + 1;
    const start = (s0 + s1 - (n - 1) * step) / 2;
    return Array.from({ length: Math.max(0, n) }, (_, i) => start + i * step);
  };

  if (kind === "ribs") {
    // Upright grooves with a pointed top.
    const g = pitch / 2;
    for (const s of spread(g, pitch)) {
      const t1 = topAt(s - g / 2, s + g / 2);
      const tip = (g / 2) * Math.sqrt(3);
      if (t1 - tip - z0 < 3) continue;
      tools.push(recess(wall, [[s - g / 2, z0], [s + g / 2, z0], [s + g / 2, t1 - tip], [s, t1], [s - g / 2, t1 - tip]]));
    }
  } else if (kind === "grooves") {
    // Level V grooves around the walls. Their upper face is steeper than 45°.
    const h = Math.max(pitch / 2, 2 * PATTERN_DEPTH + 0.2);
    const step = Math.max(pitch, h + 1.5);
    const t1 = topAt(s0, s1);
    const k = h / 2 / PATTERN_DEPTH;
    const plane = new Plane(add(wall.origin, wall.along, s0), wall.out.map((v) => -v) as Vec, wall.along);
    for (let zc = z0 + h / 2; zc + h / 2 <= t1; zc += step) {
      const groove = draw([-0.5, zc - h / 2 - 0.5 * k])
        .lineTo([PATTERN_DEPTH, zc])
        .lineTo([-0.5, zc + h / 2 + 0.5 * k])
        .close()
        .sketchOnPlane(plane)
        .extrude(s1 - s0) as Shape3D;
      tools.push(groove);
    }
  } else if (kind === "hex" || kind === "diamonds") {
    // Honeycomb with the points up (60° edges), or diamonds standing on a point.
    const gap = Math.max(1.2, pitch / 5);
    const hex = kind === "hex";
    const r = pitch;
    const half = hex ? (r * Math.sqrt(3)) / 2 : pitch * 0.8;
    const tall = hex ? r : half * 1.6;
    const outline: [number, number][] = hex
      ? Array.from({ length: 6 }, (_, i) => {
          const a = Math.PI / 2 + (i * Math.PI) / 3;
          return [r * Math.cos(a), r * Math.sin(a)];
        })
      : [[0, -tall], [half, 0], [0, tall], [-half, 0]];
    const sx = 2 * half + gap;
    const sy = hex ? 1.5 * r + gap * 0.87 : tall + gap * 1.2;
    const proto = recess(wall, outline);
    // Odd rows sit between the items of the even rows.
    const even = spread(2 * half, sx);
    const odd = even.map((c) => c + sx / 2).filter((c) => c + half <= s1);
    for (let row = 0; ; row++) {
      const t = z0 + tall + row * sy;
      if (t + tall > Math.max(wall.top(s0), wall.top(s1)) - PATTERN_MARGIN) break;
      for (const c of row % 2 ? odd : even) {
        if (t + tall > topAt(c - half, c + half)) continue;
        tools.push(proto.clone().translate(add(add([0, 0, 0], wall.along, c), [0, 0, 1], t)));
      }
    }
    proto.delete();
  }
  return tools;
}

export function buildDesk(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const W = p.width as number;
  const D = p.depth as number;
  const Hf = p.frontHeight as number;
  const a = ((p.angle as number) * Math.PI) / 180;
  const slope = Math.tan(a);
  const Hb = Hf + D * slope;
  const rim = p.rim as number;
  const web = p.web as number;
  const cols = Math.round(p.cols as number);
  const rows = Math.round(p.rows as number);
  const clearance = p.clearance as number;
  const radius = Math.min(p.cornerRadius as number, W / 2 - 1, D / 2 - 1);
  const warnings: BuildInfo["warnings"] = [];
  const topAt = (y: number) => Hf + y * slope;

  // Upright pockets on a grid, as seen from above.
  const modW = (W - 2 * rim - (cols - 1) * web) / cols;
  const modL = (D - 2 * rim - (rows - 1) * web) / rows;
  if (modW < 15 || modL < 15) throw new ParamError({ key: "err.deskTooSmall" });

  // Module slots, back row first, each row from left to right. Pocket depth
  // counts from the top at the front edge of the pocket.
  const slots: { x: number; y: number; kind: string; n: number; depth: number; bottom: number }[] = [];
  let shallowPens = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c;
      if (n >= MAX_MODULES) break;
      const kind = String(p[`module${n + 1}`]);
      const x = rim + c * (modW + web);
      const y = D - rim - modL - r * (modL + web);
      const want = wantedDepth(kind, p.pocketDepth as number);
      const depth = Math.min(want, topAt(y) - MIN_FLOOR);
      if (kind === "pens" && depth < want - 0.5) shallowPens = Math.min(shallowPens, depth);
      slots.push({ x, y, kind, n: n + 1, depth, bottom: topAt(y) - depth });
    }
  }
  if (shallowPens < Infinity) warnings.push({ key: "warn.deskShallow", vars: { d: Math.floor(shallowPens) } });

  // Body: the side profile, cut to a rounded footprint.
  const side = draw([0, 0]).lineTo([D, 0]).lineTo([D, Hb]).lineTo([0, Hf]).close().sketchOnPlane("YZ").extrude(W) as Shape3D;
  const footprint = drawRoundedRectangle(W, D, radius).translate(W / 2, D / 2).sketchOnPlane("XY", -EPS).extrude(Hb + 1) as Shape3D;
  let body = side.intersect(footprint);
  body = chamferEdgesAt(body, 0, BED_CHAMFER);

  // Pattern on the four walls, each looked at from outside, left to right.
  const surface = String(p.surface);
  if (surface !== "smooth") {
    const walls: Wall[] = [
      { origin: [0, 0, 0], along: [1, 0, 0], out: [0, -1, 0], length: W, top: () => Hf },
      { origin: [W, 0, 0], along: [0, 1, 0], out: [1, 0, 0], length: D, top: (s) => topAt(s) },
      { origin: [W, D, 0], along: [-1, 0, 0], out: [0, 1, 0], length: W, top: () => Hb },
      { origin: [0, D, 0], along: [0, -1, 0], out: [-1, 0, 0], length: D, top: (s) => topAt(D - s) },
    ];
    // Booleans get slow with many recesses in one face: patterns with
    // more than MAX_PATTERN recesses are scaled up until they fit.
    let pitch = p.ribPitch as number;
    let tools = walls.flatMap((w) => patternTools(w, surface, pitch, radius));
    while (tools.length > MAX_PATTERN) {
      for (const t of tools) t.delete();
      pitch *= Math.max(1.1, Math.sqrt(tools.length / MAX_PATTERN));
      tools = walls.flatMap((w) => patternTools(w, surface, pitch, radius));
    }
    if (tools.length) body = body.cut(makeCompound(tools) as unknown as Shape3D);
  }

  // Pockets, then the rounded edges of the top: around the outside and the pockets.
  const tools = slots.map((s) =>
    drawRoundedRectangle(modW, modL, POCKET_RADIUS)
      .translate(s.x + modW / 2, s.y + modL / 2)
      .sketchOnPlane("XY", s.bottom)
      .extrude(Hb + 5 - s.bottom) as Shape3D,
  );
  body = body.cut(makeCompound(tools) as unknown as Shape3D);
  body = roundEdgesIn(body, new Plane([0, 0, Hf], [1, 0, 0], [0, -Math.sin(a), Math.cos(a)]), TOP_ROUND);

  // Hollows under the shallow pockets, with a 45° gable roof so they print without supports.
  if (p.hollow === true) {
    const hollows: Shape3D[] = [];
    for (const s of slots) {
      const roof = s.bottom - HOLLOW_ROOF;
      if (roof - MIN_FLOOR < HOLLOW_MIN) continue;
      const prism = drawRoundedRectangle(modW, modL, POCKET_RADIUS)
        .translate(s.x + modW / 2, s.y + modL / 2)
        .sketchOnPlane("XY", MIN_FLOOR)
        .extrude(roof - MIN_FLOOR) as Shape3D;
      // Ridge along the longer side; the roof drops by 1 mm per mm to both sides.
      const alongX = modW >= modL;
      const span = alongX ? modL : modW;
      const half = span / 2 + 1;
      const profile = draw([-half, MIN_FLOOR - 1])
        .lineTo([half, MIN_FLOOR - 1])
        .lineTo([half, roof - half])
        .lineTo([0, roof])
        .lineTo([-half, roof - half])
        .close();
      const gable = alongX
        ? (profile.translate(s.y + modL / 2, 0).sketchOnPlane("YZ", s.x - 1).extrude(modW + 2) as Shape3D)
        : (profile
            .translate(s.x + modW / 2, 0)
            .sketchOnPlane(new Plane([0, s.y + modL + 1, 0], [1, 0, 0], [0, -1, 0]))
            .extrude(modL + 2) as Shape3D);
      hollows.push(prism.intersect(gable));
    }
    if (hollows.length) body = body.cut(makeCompound(hollows) as unknown as Shape3D);
  }

  const pieces: BuiltPiece[] = [{ name: "desk", shape: body, origin: [0, 0, 0], size: [W, D, Hb], grid: [0, 0] }];

  // Inlays, a little smaller than their pocket, flush with the top. In the
  // assembled view they sit in their pocket.
  const iw = modW - 2 * clearance;
  const il = modL - 2 * clearance;
  for (const s of slots) {
    const h = topAt(s.y + clearance) - s.bottom;
    const inlay = buildInlay(s.kind, iw, il, h, slope, p);
    if (!inlay) continue;
    pieces.push({
      name: `desk_inlay_${s.n}_${s.kind}`,
      shape: inlay,
      origin: [0, 0, 0],
      size: [iw, il, h + il * slope],
      grid: [0, 0],
      placement: { offset: [s.x + clearance, s.y + clearance, s.bottom], rotX: 0 },
    });
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const facts: BuildInfo["facts"] = [
    { key: "fact.size", vars: { x: r1(W), y: r1(D), z: r1(Hb) } },
    { key: "fact.deskModules", vars: { n: slots.length, x: r1(modW), y: r1(modL), d: r1(Math.max(...slots.map((s) => s.depth))) } },
  ];
  return { pieces, info: { size: [W, D, Hb], facts, warnings } };
}
