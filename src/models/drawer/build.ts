// A whole drawer: a baseplate cut to the drawer plus every part placed on it,
// in drawer coordinates. Parts are built through the cache, so changing one
// only rebuilds that one.
import type { Shape3D } from "replicad";
import { buildBaseplate } from "../baseplate/build";
import { layoutBaseplate } from "../baseplate/layout";
import { baseplateSchema } from "../baseplate/schema";
import { buildBin } from "../bin/build";
import type { BuildFn, BuiltPiece } from "../build-types";
import { cachedBuild } from "../cache";
import { BIN_CLEARANCE, GRID, PLATE_HEIGHT } from "../gridfinity";
import { buildInsert } from "../insert/build";
import { sanitize, type BuildInfo, type Params } from "../types";
import { conflicts, footprint, itemParams, parseItems } from "./schema";

const builders: Record<string, BuildFn> = { bin: buildBin, insert: buildInsert };

/** Baseplate parameters for a drawer. */
export const drawerBaseplate = (p: Params) => sanitize(baseplateSchema, { ...p, sizeMode: "drawer" });

export function buildDrawer(p: Params): { pieces: BuiltPiece[]; info: BuildInfo } {
  const bp = drawerBaseplate(p);
  const layout = layoutBaseplate(bp);
  const floor = bp.style === "solid" ? (bp.floor as number) : 0;
  const base = cachedBuild("baseplate", buildBaseplate, bp);
  const pieces: BuiltPiece[] = base.pieces.map((piece) => ({ ...piece, name: piece.name.replace("baseplate", "drawer_baseplate") }));
  const warnings: BuildInfo["warnings"] = [...base.info.warnings];

  const items = parseItems(p.items);
  const { outside, overlap } = conflicts(items, p, layout.x.cells, layout.y.cells);
  if (outside.length) warnings.push({ key: "warn.drawerOutside", vars: { n: outside.length } });
  if (overlap.length) warnings.push({ key: "warn.drawerOverlap", vars: { n: overlap.length } });

  const names = new Map<string, number>();
  const tooTall: string[] = [];
  let top = floor + PLATE_HEIGHT;
  let used = 0;
  items.forEach((item, i) => {
    if (outside.includes(i) || overlap.includes(i)) return;
    const f = footprint(item, p);
    used += f.w * f.d;
    let built;
    try {
      built = cachedBuild(item.m, builders[item.m], itemParams(item, p));
    } catch {
      warnings.push({ key: "warn.drawerItemFailed", vars: { n: i + 1 } });
      return;
    }
    for (const w of built.info.warnings) if (!warnings.some((x) => x.key === w.key)) warnings.push(w);
    // Bins have their corner at the origin; they sit in the cell with their clearance all round.
    const dx = layout.x.padStart + f.x * GRID + BIN_CLEARANCE / 2;
    const dy = layout.y.padStart + f.y * GRID + BIN_CLEARANCE / 2;
    for (const piece of built.pieces) {
      const n = (names.get(piece.name) ?? 0) + 1;
      names.set(piece.name, n);
      const height = floor + piece.size[2];
      top = Math.max(top, height);
      if (height > (p.drawerZ as number) + 1e-6) tooTall.push(String(i + 1));
      pieces.push({
        ...piece,
        name: n > 1 ? `${piece.name}_${n}` : piece.name,
        shape: piece.shape.translate(dx, dy, floor) as Shape3D,
        labels: piece.labels?.translate(dx, dy, floor) as Shape3D | undefined,
        origin: [dx, dy, floor],
        grid: [0, 0],
      });
    }
  });
  if (tooTall.length) warnings.push({ key: "warn.drawerTooTall", vars: { parts: tooTall.join(", "), h: p.drawerZ as number } });

  const cells = layout.x.cells * layout.y.cells;
  const facts: BuildInfo["facts"] = [
    { key: "fact.drawer", vars: { x: layout.x.cells, y: layout.y.cells, n: pieces.length - base.pieces.length, free: cells - used } },
    ...base.info.facts.filter((f) => f.key !== "fact.cells"),
  ];
  return { pieces, info: { size: [layout.width, layout.depth, top], facts, warnings } };
}
