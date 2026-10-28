import { baseplateSchema } from "../baseplate/schema";
import { binSchema } from "../bin/schema";
import { insertSchema } from "../insert/schema";
import { accentGroup, printerGroup } from "../printer";
import { defaults, sanitize, type Field, type ModelSchema, type Params } from "../types";

/** Models that can be placed in a drawer. */
export const placeable: Record<string, ModelSchema> = { bin: binSchema, insert: insertSchema };

/** One part in the drawer: its model, lower-left cell and own settings (only those that differ from the defaults). */
export interface DrawerItem {
  m: string;
  x: number;
  y: number;
  p: Params;
}

const hidden = () => false;
/** Baseplate settings that the drawer sets itself. */
const OWN = ["sizeMode", "gridX", "gridY", "drawerX", "drawerY"];
const baseplateFields = baseplateSchema.groups.slice(0, 2).flatMap((g) => g.fields.filter((f) => !OWN.includes(f.key)));

export const drawerSchema: ModelSchema = {
  id: "drawer",
  title: "model.drawer",
  groups: [
    {
      title: "group.drawer",
      tab: "main",
      fields: [
        { key: "drawerX", label: "drawer.width", type: "number", default: 300, min: 42, max: 2000, step: 0.5, unit: "mm" },
        { key: "drawerY", label: "drawer.depth", type: "number", default: 400, min: 42, max: 2000, step: 0.5, unit: "mm" },
        { key: "drawerZ", label: "drawer.height", type: "number", default: 60, min: 15, max: 500, step: 0.5, unit: "mm" },
        { key: "sizeMode", label: "bp.sizeMode", type: "select", default: "drawer", options: ["drawer"], visible: hidden },
        { key: "items", label: "drawer.items", type: "text", default: "[]", maxLength: 20000, visible: hidden },
      ],
    },
    { title: "group.baseplate", fields: baseplateFields as Field[] },
    accentGroup,
    printerGroup,
  ],
};

/** Settings a part's own form leaves out: the drawer decides them. */
const ITEM_OWN = ["form", "autoSize", "accent", "accentHeight", "bedX", "bedY"];

/** The form of a part in the drawer: its model's form without what the drawer sets. */
export function itemSchema(model: string): ModelSchema {
  const s = placeable[model];
  return {
    ...s,
    groups: s.groups
      .filter((g) => g.tab !== "print")
      .map((g) => ({ ...g, fields: g.fields.filter((f) => !ITEM_OWN.includes(f.key) && f.type !== "action") }))
      .filter((g) => g.fields.length),
  };
}

/** Full parameters of a part, with what the drawer decides. */
export function itemParams(item: DrawerItem, drawer: Params): Params {
  const s = placeable[item.m];
  return sanitize(s, { ...defaults(s), ...item.p, form: "bin", autoSize: false, accent: false, bedX: drawer.bedX, bedY: drawer.bedY });
}

/** Only the settings that differ from the defaults, to keep links short. */
export function itemDiff(model: string, p: Params): Params {
  const d = defaults(placeable[model]);
  return Object.fromEntries(Object.entries(p).filter(([k, v]) => !ITEM_OWN.includes(k) && d[k] !== v));
}

export function parseItems(text: unknown): DrawerItem[] {
  try {
    const raw = JSON.parse(String(text));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r) => r && typeof r === "object" && placeable[r.m] && Number.isFinite(r.x) && Number.isFinite(r.y))
      .slice(0, 200)
      .map((r) => ({ m: r.m, x: Math.round(r.x), y: Math.round(r.y), p: r.p && typeof r.p === "object" ? (r.p as Params) : {} }));
  } catch {
    return [];
  }
}

/** Cells a part covers. */
export const footprint = (item: DrawerItem, drawer: Params) => {
  const p = itemParams(item, drawer);
  return { x: item.x, y: item.y, w: Math.round(p.gridX as number), d: Math.round(p.gridY as number) };
};

/** Parts that leave the grid or overlap an earlier part, by index. */
export function conflicts(items: DrawerItem[], drawer: Params, cellsX: number, cellsY: number): { outside: number[]; overlap: number[] } {
  const taken = new Map<string, number>();
  const outside: number[] = [];
  const overlap: number[] = [];
  items.forEach((it, i) => {
    const f = footprint(it, drawer);
    if (f.x < 0 || f.y < 0 || f.x + f.w > cellsX || f.y + f.d > cellsY) outside.push(i);
    for (let x = f.x; x < f.x + f.w; x++) {
      for (let y = f.y; y < f.y + f.d; y++) {
        const k = `${x},${y}`;
        if (taken.has(k) && !overlap.includes(i)) overlap.push(i);
        taken.set(k, i);
      }
    }
  });
  return { outside, overlap };
}

/** First free spot for a part of `w` × `d` cells, scanning rows from the front left. */
export function freeSpot(items: DrawerItem[], drawer: Params, cellsX: number, cellsY: number, w: number, d: number): [number, number] | null {
  const taken = new Set<string>();
  for (const it of items) {
    const f = footprint(it, drawer);
    for (let x = f.x; x < f.x + f.w; x++) for (let y = f.y; y < f.y + f.d; y++) taken.add(`${x},${y}`);
  }
  for (let y = 0; y + d <= cellsY; y++) {
    for (let x = 0; x + w <= cellsX; x++) {
      let ok = true;
      for (let i = x; i < x + w && ok; i++) for (let j = y; j < y + d && ok; j++) ok = !taken.has(`${i},${j}`);
      if (ok) return [x, y];
    }
  }
  return null;
}
