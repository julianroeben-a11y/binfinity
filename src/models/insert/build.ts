// Inserts: a solid block with holes or slots that hold small items upright,
// either as a Gridfinity bin or as a loose block that drops into a box.
import { draw, drawRoundedRectangle, makeCompound, type Point, type Shape3D } from "replicad";
import { cellCentres, foot, footHoles, lipTool, LIP_ROUND } from "../bin/build";
import { chamferEdgesAt, roundEdgesAt } from "../edges";
import { cutSlope } from "../slope";
import { BIN_CLEARANCE, BIN_FOOT_HEIGHT, BIN_RADIUS, GRID, HEIGHT_UNIT, LIP_HEIGHT, LIP_INSET } from "../gridfinity";
import { planarLoft } from "../solids";
import { engrave, textWidth, type TextItem } from "../text";
import type { BuiltPiece } from "../build-types";
import { ParamError, type BuildInfo, type Params } from "../types";
import { fitsBlocks, layoutBlocks, type BlockKind } from "./blocks";
import { layoutItems, layoutShelves, parseSizes } from "./layout";
import { itemPresets, mixItems } from "./schema";

const EPS = 0.01;
/** Material kept between neighbouring openings at least. */
const WEB = 1.6;
/** Items keep at least this much distance from the outer edge (or the lip). */
const EDGE = 1.5;
/** 45° entry chamfer on the openings, so items find their way in. */
const ENTRY = 0.8;
/** Loose inserts: corners up to this radius need no extra room. */
const LOOSE_SAFE_RADIUS = 2;
/** Loose inserts: bottom chamfer and rounded top edge. */
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
function openingTool(kind: string, x: number, y: number, z0: number, top: number, c: number, over = 0): Shape3D {
  const zc = top - c;
  if (kind === "round") {
    // Revolving the profile gives true cylinder and cone faces.
    const r = x / 2;
    let profile = draw([0, z0])
      .lineTo([r, z0])
      .lineTo([r, zc])
      .lineTo([r + c + EPS, top + EPS]);
    if (over > 0) profile = profile.lineTo([r + c + EPS, top + over]);
    return profile
      .lineTo([0, top + Math.max(over, EPS)])
      .close()
      .sketchOnPlane("XZ")
      .revolve() as Shape3D;
  }
  const ring = kind === "hex" ? (g: number, z: number) => hexRing(x + 2 * g, z) : (g: number, z: number) => rectRing(x + 2 * g, y + 2 * g, z);
  // `over` carries the opening on up through a sloped top.
  return planarLoft([ring(0, z0), ring(0, zc), ring(c + EPS, top + EPS), ...(over > 0 ? [ring(c + EPS, top + over)] : [])]);
}

export interface Opening {
  x: number;
  y: number;
  kind: string;
  /** Size of the opening along X and Y. */
  x0: number;
  y0: number;
  depth: number;
  chamfer: number;
}

interface ItemSpec {
  kind: string;
  /** Opening along X and Y (slots with their long side along X). */
  ox: number;
  oy: number;
  /** Room the item takes along X and Y. */
  footX: number;
  footY: number;
  /** Free space towards the neighbours along X and Y. */
  gapX: number;
  gapY: number;
  depth: number;
}

/**
 * Slots: sticks and cards are gripped on their broad faces, so the finger
 * gap goes there; side by side along their length they only need this much.
 */
const SLOT_END_GAP = 2;

/** Opening and room of one kind of item, from the item fields (or a preset). */
function itemSpec(v: Params, clearance: number): ItemSpec {
  const kind = v.opening as string;
  let ox = (v.size as number) + clearance;
  let oy = kind === "slot" ? (v.slotWidth as number) + clearance : kind === "hex" ? (ox * 2) / Math.sqrt(3) : ox;
  if (kind === "slot" && oy > ox) [ox, oy] = [oy, ox];
  const item = v.itemX as number;
  const gap = v.gap as number;
  const footX = Math.max(ox, item + clearance);
  const footY = Math.max(oy, (kind === "slot" ? (v.itemY as number) : item) + clearance);
  // Openings always keep at least a web of material between them.
  return {
    kind,
    ox,
    oy,
    footX,
    footY,
    gapX: Math.max(kind === "slot" ? Math.min(gap, SLOT_END_GAP) : gap, ox + WEB - footX),
    gapY: Math.max(gap, oy + WEB - footY),
    depth: v.holeDepth as number,
  };
}

const r2 = (n: number) => Math.round(n * 10) / 10;
/** Size labels in front of the holes of a set: cap height and distance to the hole. */
const SIZE_LABEL_CAP = 2.5;
const SIZE_LABEL_GAP = 1.2;
const sizeText = (s: number) => String(Math.round(s * 100) / 100);
const entry = (gap: number) => Math.max(0, Math.min(ENTRY, (gap - WEB) / 2));
/** Entry chamfer that keeps a web of material to every neighbour. */
const specEntry = (s: ItemSpec) => Math.max(0, Math.min(ENTRY, (s.footX - s.ox + s.gapX - WEB) / 2, (s.footY - s.oy + s.gapY - WEB) / 2));

export interface Plan {
  holes: Opening[];
  /** Labels on the top face (z is filled in later). */
  texts: Omit<TextItem, "z">[];
  /** Deepest opening wanted. */
  depth: number;
  warnings: BuildInfo["warnings"];
  facts: (depth: number) => BuildInfo["facts"];
}

/** Where the openings go inside an area of `ax` × `ay`, centred on the origin. */
export function planOpenings(p: Params, ax: number, ay: number): Plan {
  const kind = p.opening as string;
  const clearance = p.clearance as number;
  const gap = p.gap as number;
  const depth = p.holeDepth as number;

  if (kind === "set") {
    // Different sizes: each hole is as wide as its item, neighbours keep the gap.
    // With labels each hole gets a strip in front of it for its size.
    const g = Math.max(gap, WEB);
    const sizes = parseSizes(String(p.sizes), 0.5, 100);
    const labelled = p.sizeLabels === true;
    const band = labelled ? SIZE_LABEL_GAP + SIZE_LABEL_CAP : 0;
    const names = sizes.map(sizeText);
    // Hex keys: the size is across flats, the room is across corners.
    const hex = p.setShape === "hex";
    const across = (s: number) => (hex ? ((s + clearance) * 2) / Math.sqrt(3) : s + clearance);
    const items = sizes.map((s, i) => ({ w: Math.max(across(s), labelled ? textWidth(names[i], SIZE_LABEL_CAP) : 0), d: across(s) + band, gap: g }));
    const { placed, missing } = layoutShelves(ax, ay, items);
    const holes = placed.map(({ x, y, index }) => {
      const size = sizes[index] + clearance;
      return { x, y: y + band / 2, kind: hex ? "hex" : "round", x0: size, y0: size, depth, chamfer: entry(g) };
    });
    const texts = labelled
      ? placed.map(({ x, y, index }) => ({ text: names[index], x, y: y - items[index].d / 2 + SIZE_LABEL_CAP / 2, maxW: items[index].w, cap: SIZE_LABEL_CAP }))
      : [];
    return {
      holes,
      texts,
      depth,
      warnings: missing.length ? [{ key: "warn.insertMissing", vars: { sizes: missing.map((i) => r2(sizes[i])).join(", ") } }] : [],
      facts: (d) => (holes.length ? [{ key: "fact.insertSet", vars: { n: holes.length, from: r2(sizes[0]), to: r2(sizes[holes.length - 1]), d: r2(d) } }] : []),
    };
  }

  if (kind === "mix") {
    // Several kinds of items, each in a block of its own.
    const keys = mixItems.filter((k) => Math.round(p[`count_${k}`] as number) > 0);
    const specs = keys.map((k) => itemSpec(itemPresets[k], clearance));
    const counts = keys.map((k) => Math.round(p[`count_${k}`] as number));
    const { holes, placed } = blockHoles(ax, ay, specs.map((s, i) => blockKind(s, counts[i])), specs);
    const missing = counts.reduce((a, b) => a + b, 0) - placed;
    return {
      holes,
      texts: [],
      depth: Math.max(0, ...specs.map((s) => s.depth)),
      warnings: missing ? [{ key: "warn.insertMixMissing", vars: { n: missing } }] : [],
      facts: () => [{ key: "fact.insertMix", vars: { n: holes.length, kinds: keys.length } }],
    };
  }

  if (kind === "usbsd") return planCombo(ax, ay, clearance);

  const { ox, oy, footX, footY, gapX, gapY } = itemSpec(p, clearance);

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
  const holes = layout.centres.map(([x, y]) => ({ x, y, kind, x0: lx, y0: ly, depth, chamfer }));
  return {
    holes,
    texts: [],
    depth,
    warnings: [],
    facts: (d): BuildInfo["facts"] => [
      { key: "fact.insertItems", vars: { n: holes.length, x: r2(px), y: r2(py) } },
      kind === "slot"
        ? { key: "fact.insertSlot", vars: { x: r2(ox), y: r2(oy), d: r2(d) } }
        : { key: "fact.insertHole", vars: { x: r2(ox), d: r2(d) } },
    ],
  };
}

/** A kind of item as a block of the mixed layout. */
function blockKind(s: ItemSpec, n: number, extra: Partial<BlockKind> = {}): BlockKind {
  return { footX: s.footX, footY: s.footY, ox: s.ox, oy: s.oy, gapX: s.gapX, gapY: s.gapY, finger: Math.max(s.gapX, s.gapY), n, turnable: s.kind === "slot", ...extra };
}

/** Openings for a mixed layout; `specs` belong to the kinds by index. */
function blockHoles(ax: number, ay: number, kinds: BlockKind[], specs: ItemSpec[]): { holes: Opening[]; counts: number[]; placed: number } {
  const { placed, counts } = layoutBlocks(ax, ay, kinds);
  const holes = placed.map(({ kind, x, y, turned }) => {
    const s = specs[kind];
    const t = turned ? { ...s, ox: s.oy, oy: s.ox, footX: s.footY, footY: s.footX, gapX: s.gapY, gapY: s.gapX } : s;
    return { x, y, kind: s.kind, x0: t.ox, y0: t.oy, depth: s.depth, chamfer: specEntry(t) };
  });
  return { holes, counts, placed: placed.length };
}

/** Four USB sticks in a 2 × 2 block and as many SD cards as fit in one line beside or in front of them. */
function planCombo(ax: number, ay: number, clearance: number): Plan {
  const usb = itemSpec(itemPresets.usba, clearance);
  const sd = itemSpec(itemPresets.sd, clearance);
  const kinds = (n: number) => [blockKind(usb, 4, { cols: 2 }), blockKind(sd, n, { oneRow: true })];
  // Most cards that fit next to all four sticks.
  let n = Math.floor(Math.max(ax, ay) / (sd.footY + sd.gapY)) + 1;
  while (n > 0 && !fitsBlocks(ax, ay, kinds(n))) n--;
  const { holes, counts } = blockHoles(ax, ay, kinds(n), [usb, sd]);
  return {
    holes,
    texts: [],
    depth: Math.max(usb.depth, sd.depth),
    warnings: counts[0] < 4 || n === 0 ? [{ key: "warn.insertMixMissing", vars: { n: 4 - counts[0] + (n ? 0 : 1) } }] : [],
    facts: () => [{ key: "fact.insertCombo", vars: { usb: counts[0], sd: counts[1] } }],
  };
}

/** Grid sizes from small to large, square-ish first. */
const GRID_SIZES = Array.from({ length: 100 }, (_, i): [number, number] => [(i % 10) + 1, Math.floor(i / 10) + 1]).sort(
  ([ax, ay], [bx, by]) => ax * ay - bx * by || Math.abs(ax - ay) - Math.abs(bx - by) || ay - by,
);

export function buildInsert(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const kind = p.opening as string;
  const isBin = p.form === "bin";
  const floor = p.floor as number;
  // Loose inserts for the desk organizer follow its sloped top (rise per mm towards +Y).
  const slope = isBin ? 0 : Math.max(0, (p.topSlope as number | undefined) ?? 0);
  const warnings: BuildInfo["warnings"] = [];

  // Outer size, and the free area the items have to stay inside.
  const binArea = (gx: number, gy: number) => {
    const w = gx * GRID - BIN_CLEARANCE;
    const d = gy * GRID - BIN_CLEARANCE;
    // Items stick out above the block, so they must clear the stacking lip.
    const inset = (p.lip === true ? LIP_INSET : 0) + EDGE;
    return { w, d, plan: planOpenings(p, w - 2 * inset, d - 2 * inset) };
  };
  let gx = Math.round(p.gridX as number);
  let gy = Math.round(p.gridY as number);
  let w: number;
  let d: number;
  let plan: Plan;
  if (isBin) {
    if (kind === "mix" && p.autoSize === true) {
      // Smallest bin that takes everything, else the largest one.
      [gx, gy] = GRID_SIZES.find(([x, y]) => !binArea(x, y).plan.warnings.length) ?? [10, 10];
    }
    ({ w, d, plan } = binArea(gx, gy));
  } else {
    w = p.width as number;
    d = p.length as number;
    // Large corner radii take room from the items in the corners.
    const edge = EDGE + Math.max(0, (p.cornerRadius as number) - LOOSE_SAFE_RADIUS) * (1 - Math.SQRT1_2);
    plan = planOpenings(p, w - 2 * edge, d - 2 * edge);
  }
  if (!plan.holes.length) throw new ParamError({ key: kind === "mix" && plan.depth === 0 ? "err.insertEmpty" : "err.insertNoFit" });
  warnings.push(...plan.warnings);

  // Height: the openings go down from the top face, the floor stays below.
  const base = isBin ? BIN_FOOT_HEIGHT : 0;
  let holeDepth = plan.depth;
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
    const r = Math.min(p.cornerRadius as number, w / 2 - 0.1, d / 2 - 0.1);
    shape = drawRoundedRectangle(w, d, r).sketchOnPlane("XY").extrude(top + d * slope) as Shape3D;
    shape = chamferEdgesAt(shape, 0, LOOSE_CHAMFER);
    shape = slope ? cutSlope(shape, w, d, top, slope, TOP_ROUND) : roundEdgesAt(shape, top, TOP_ROUND);
  }

  // The openings, one tool per kind and size.
  const protos = new Map<string, Shape3D>();
  const tools = plan.holes.map((h) => {
    const key = `${h.kind}/${h.x0}/${h.y0}/${h.depth}/${h.chamfer}`;
    let proto = protos.get(key);
    if (!proto) {
      proto = openingTool(h.kind, h.x0, h.y0, surface - Math.min(h.depth, holeDepth), surface, h.chamfer, slope ? (h.y0 / 2 + h.chamfer) * slope + 1 : 0);
      protos.set(key, proto);
    }
    // On a sloped top each opening starts at the top above its centre.
    return proto.clone().translate(h.x, h.y, (h.y + d / 2) * slope);
  });
  for (const t of protos.values()) t.delete();
  shape = shape.cut(makeCompound(tools) as unknown as Shape3D);

  const engraved = engrave(
    shape,
    slope ? [] : plan.texts.map((t) => ({ ...t, z: surface })),
  );
  shape = engraved.shape;
  if (engraved.skipped.length) warnings.push({ key: "warn.labelSkipped", vars: { texts: engraved.skipped.join(", ") } });

  // Corner at the origin, like bins and boxes.
  shape = shape.translate(w / 2, d / 2, 0);
  const labels = engraved.labels?.translate(w / 2, d / 2, 0);

  const facts: BuildInfo["facts"] = [{ key: "fact.size", vars: { x: r2(w), y: r2(d), z: r2(top + d * slope) } }, ...plan.facts(holeDepth)];
  const name = isBin ? `insert_${gx}x${gy}x${unitsLabel}` : `insert_${r2(w)}x${r2(d)}`;
  return {
    pieces: [{ name, shape, labels, origin: [0, 0, 0], size: [w, d, top + d * slope], grid: [0, 0] }],
    info: { size: [w, d, top + d * slope], facts, warnings },
  };
}
